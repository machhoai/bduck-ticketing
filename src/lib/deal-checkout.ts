"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type {
    DealSectionDocument,
    DealItemDocument,
    OrderDocument,
    VoucherTemplateDocument,
} from "@/types/firestore";
import { checkDealSectionTimeGate } from "@/lib/dealUtils";
import { registerAndClaimVoucher } from "@/lib/event-gacha";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DealValidationError {
    errorKey: string;
    message?: string;
}

/** Resolved deal info for a cart item that's a deal product */
export interface ResolvedDealItem {
    sectionId: string;
    section: DealSectionDocument;
    item: DealItemDocument;
}

// ─── Lazy Daily Stock Reset ───────────────────────────────────────────────────

/**
 * Check if a deal item needs daily stock reset and return effective soldCount.
 * Uses `lastStockResetDate` + `stockResetHour/Minute` for lazy (no cron) reset.
 */
function getEffectiveSoldCount(item: DealItemDocument): number {
    if (item.stockResetPeriod !== "daily") return item.soldCount;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

    // Determine reset time
    const resetH = item.stockResetHour ?? 0;
    const resetM = item.stockResetMinute ?? 0;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const resetMinutes = resetH * 60 + resetM;

    // If today has already passed reset time and lastResetDate is before today → reset
    if (nowMinutes >= resetMinutes && item.lastStockResetDate !== todayStr) {
        return 0; // stock has been reset
    }

    // If we haven't passed reset time yet, check yesterday
    if (nowMinutes < resetMinutes) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);
        // If last reset was before yesterday, soldCount should be from yesterday (still valid)
        if (item.lastStockResetDate !== yesterdayStr && item.lastStockResetDate !== todayStr) {
            return 0;
        }
    }

    return item.soldCount;
}

// ─── Validate Deal Items ──────────────────────────────────────────────────────

/**
 * For each cart item that belongs to a deal section (via dealSectionId on product),
 * validate: time gate, stock, maxQtyPerOrder.
 *
 * Returns the resolved deal mappings for downstream use (voucher issuance).
 */
export async function validateDealItems(
    productDealMap: Map<string, { sectionId: string; dealItemId: string }>,
    cartQuantities: Map<string, number>
): Promise<{ errors: DealValidationError[]; resolved: Map<string, ResolvedDealItem> }> {
    const errors: DealValidationError[] = [];
    const resolved = new Map<string, ResolvedDealItem>();

    // Group by section to batch-fetch
    const sectionIds = new Set<string>();
    for (const { sectionId } of productDealMap.values()) {
        sectionIds.add(sectionId);
    }

    // Fetch all relevant sections
    const sectionMap = new Map<string, DealSectionDocument>();
    for (const sid of sectionIds) {
        const doc = await adminDb.collection(COLLECTIONS.DEAL_SECTIONS).doc(sid).get();
        if (doc.exists) {
            sectionMap.set(sid, { id: doc.id, ...doc.data() } as DealSectionDocument);
        }
    }

    for (const [productId, { sectionId, dealItemId }] of productDealMap) {
        const section = sectionMap.get(sectionId);
        if (!section) {
            errors.push({ errorKey: "deal.section_not_found", message: sectionId });
            continue;
        }

        // Time gate check
        const { isOpen } = checkDealSectionTimeGate(section);
        if (!isOpen) {
            errors.push({ errorKey: "deal.not_open_yet", message: section.title });
            continue;
        }

        // Find the deal item
        const dealItem = section.items.find((i) => i.id === dealItemId);
        if (!dealItem || !dealItem.isActive) {
            errors.push({ errorKey: "deal.item_not_found", message: productId });
            continue;
        }

        const qty = cartQuantities.get(productId) ?? 1;

        // maxQtyPerOrder check
        if (qty > dealItem.maxQtyPerOrder) {
            errors.push({
                errorKey: "deal.max_qty_exceeded",
                message: `${dealItem.name}: tối đa ${dealItem.maxQtyPerOrder}/đơn`,
            });
            continue;
        }

        // Stock check with lazy daily reset
        if (dealItem.totalStock !== undefined) {
            const effectiveSold = getEffectiveSoldCount(dealItem);
            if (effectiveSold + qty > dealItem.totalStock) {
                errors.push({ errorKey: "deal.stock_exhausted", message: dealItem.name });
                continue;
            }
        }

        resolved.set(productId, { sectionId, section, item: dealItem });
    }

    return { errors, resolved };
}

// ─── Validate Section Constraints ─────────────────────────────────────────────

/**
 * Check section-level constraints:
 * - maxPromoItemsPerOrder: total qty of all deal items from one section
 * - maxPromoVariantsPerOrder: max distinct deal item types from one section
 */
export async function validateDealSectionConstraints(
    resolved: Map<string, ResolvedDealItem>,
    cartQuantities: Map<string, number>
): Promise<DealValidationError[]> {
    const errors: DealValidationError[] = [];

    // Group by section
    const sectionGroups = new Map<string, { totalQty: number; variantCount: number; title: string }>();
    for (const [productId, deal] of resolved) {
        const qty = cartQuantities.get(productId) ?? 1;
        const existing = sectionGroups.get(deal.sectionId);
        if (existing) {
            existing.totalQty += qty;
            existing.variantCount += 1;
        } else {
            sectionGroups.set(deal.sectionId, {
                totalQty: qty,
                variantCount: 1,
                title: deal.section.title,
            });
        }
    }

    for (const [sectionId, group] of sectionGroups) {
        const section = resolved.values().next().value?.section;
        if (!section) continue;
        const sec = Array.from(resolved.values()).find((r) => r.sectionId === sectionId)?.section;
        if (!sec) continue;

        if (sec.maxPromoItemsPerOrder && group.totalQty > sec.maxPromoItemsPerOrder) {
            errors.push({
                errorKey: "deal.section_max_items",
                message: `${sec.title}: tối đa ${sec.maxPromoItemsPerOrder} sản phẩm deal/đơn`,
            });
        }

        if (sec.maxPromoVariantsPerOrder && group.variantCount > sec.maxPromoVariantsPerOrder) {
            errors.push({
                errorKey: "deal.section_max_variants",
                message: `${sec.title}: tối đa ${sec.maxPromoVariantsPerOrder} loại deal/đơn`,
            });
        }
    }

    return errors;
}

// ─── Generate Voucher Code ────────────────────────────────────────────────────

/**
 * Generate a unique voucher code: {prefix}{randomChars}{suffix}
 * Checks uniqueness against bduck_issuedVouchers collection.
 */
export async function generateVoucherCode(
    template: VoucherTemplateDocument
): Promise<string> {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const length = template.codeLength || 6;
    const prefix = template.codePrefix || "";
    const suffix = template.codeSuffix || "";

    for (let attempt = 0; attempt < 5; attempt++) {
        let middle = "";
        for (let i = 0; i < length; i++) {
            middle += chars[Math.floor(Math.random() * chars.length)];
        }
        const code = `${prefix}${middle}${suffix}`;

        // Check uniqueness
        const existing = await adminDb
            .collection(COLLECTIONS.ISSUED_VOUCHERS)
            .where("code", "==", code)
            .limit(1)
            .get();

        if (existing.empty) return code;
    }

    // Fallback: use timestamp-based code
    const ts = Date.now().toString(36).toUpperCase().slice(-6);
    return `${prefix}${ts}${suffix}`;
}

// ─── Voucher Email Info (for embedding in ticket email) ──────────────────────

export interface VoucherEmailInfo {
    templateName: string;
    code: string;
    /** "WON_VOUCHER" | "LUCK_NEXT_TIME" | "ERROR" for gacha, "ISSUED" for standard */
    status: string;
    /** Human-readable message for the customer */
    message: string;
}

// ─── Issue Vouchers Post-Payment ──────────────────────────────────────────────

/**
 * After order is confirmed paid, issue vouchers for all deal items that have giftVoucher config.
 * Handles event_gacha vouchers by calling register + gacha roll to get real voucher codes.
 *
 * Returns VoucherEmailInfo[] so callers can embed voucher details in the ticket email.
 *
 * This runs OUTSIDE the main transaction (fire-and-forget with error logging)
 * because it involves external API calls that shouldn't block order completion.
 */
export async function issueVouchersForOrder(
    order: OrderDocument,
    resolved: Map<string, ResolvedDealItem>
): Promise<{ issuedIds: string[]; vouchers: VoucherEmailInfo[] }> {
    const issuedIds: string[] = [];
    const vouchers: VoucherEmailInfo[] = [];
    const now = Timestamp.now();

    for (const [productId, deal] of resolved) {
        const giftVoucher = deal.item.giftVoucher;
        if (!giftVoucher) continue;

        // Fetch the template
        const templateDoc = await adminDb
            .collection(COLLECTIONS.VOUCHER_TEMPLATES)
            .doc(giftVoucher.templateId)
            .get();

        if (!templateDoc.exists) {
            console.error(`[deal-checkout] Voucher template not found: ${giftVoucher.templateId}`);
            continue;
        }

        const template = { id: templateDoc.id, ...templateDoc.data() } as VoucherTemplateDocument;

        // Determine quantity: perProduct → qty × voucher, perOrder → 1 voucher
        const orderItem = order.items.find((i) => i.productId === productId);
        const qty = giftVoucher.distribution === "perProduct"
            ? (orderItem?.quantity ?? 1)
            : 1;

        for (let i = 0; i < qty; i++) {
            try {
                if (template.voucherType === "event_gacha" && template.eventGachaConfig) {
                    // ── Event Gacha: register + roll to get actual voucher code ──
                    console.log(`[deal-checkout] 🎰 Calling gacha for product ${productId} | eventId=${template.eventGachaConfig.eventId} | phone=${order.customerPhone || "(empty)"}`);

                    const result = await registerAndClaimVoucher({
                        apiBaseUrl: template.eventGachaConfig.apiBaseUrl,
                        eventId: template.eventGachaConfig.eventId,
                        customer: {
                            phone: order.customerPhone || "",
                            fullName: order.customerName,
                            dob: "2000-01-01", // placeholder
                            email: order.customerEmail,
                        },
                        source: template.eventGachaConfig.source,
                    });

                    console.log(`[deal-checkout] 🎰 Gacha result: success=${result.success} status=${result.status} code=${result.voucherCode || "none"} error=${result.error || "none"}`);

                    // Use real voucher code if won, otherwise placeholder
                    const voucherCode = result.success && result.voucherCode
                        ? result.voucherCode
                        : `PENDING-${order.orderNumber}-${i + 1}`;

                    // Create issued voucher record
                    const voucherRef = adminDb.collection(COLLECTIONS.ISSUED_VOUCHERS).doc();
                    const voucherData: Record<string, unknown> = {
                        templateId: template.id,
                        templateName: template.name,
                        voucherType: template.voucherType,
                        code: voucherCode,
                        customerId: order.customerId || "",
                        customerEmail: order.customerEmail,
                        customerPhone: order.customerPhone || "",
                        customerName: order.customerName,
                        orderId: order.id || "",
                        orderNumber: order.orderNumber,
                        dealSectionId: deal.sectionId,
                        dealItemId: deal.item.id,
                        issuedAt: now,
                        expiresAt: now, // N/A for gacha vouchers
                        status: result.success ? "active" : "pending",
                        createdAt: now,
                        updatedAt: now,
                    };

                    // Store API result metadata
                    if (result.success) {
                        voucherData.eventGachaResult = {
                            voucherCode: result.voucherCode,
                            campaignName: result.campaignName,
                            rewardType: result.rewardType,
                            rewardValue: result.rewardValue,
                            message: result.message,
                        };
                    } else {
                        voucherData.eventGachaError = result.error;
                    }

                    await voucherRef.set(voucherData);
                    issuedIds.push(voucherRef.id);

                    // Collect for ticket email
                    vouchers.push({
                        templateName: template.name,
                        code: voucherCode,
                        status: result.success ? "WON_VOUCHER" : (result.status || "ERROR"),
                        message: result.success
                            ? `🎉 Mã voucher: ${voucherCode}`
                            : "Vui lòng đến quầy để được hỗ trợ nhận voucher.",
                    });

                    // Increment template counter
                    await adminDb.collection(COLLECTIONS.VOUCHER_TEMPLATES).doc(template.id).update({
                        totalIssued: FieldValue.increment(1),
                    });
                } else {
                    // ── Standard voucher: generate code ──
                    const code = await generateVoucherCode(template);
                    const expiresAt = Timestamp.fromMillis(
                        now.toMillis() + (template.validDays || 30) * 86400 * 1000
                    );

                    const voucherRef = adminDb.collection(COLLECTIONS.ISSUED_VOUCHERS).doc();
                    const voucherData: Record<string, unknown> = {
                        templateId: template.id,
                        templateName: template.name,
                        voucherType: template.voucherType,
                        code,
                        customerId: order.customerId || "",
                        customerEmail: order.customerEmail,
                        customerPhone: order.customerPhone || "",
                        customerName: order.customerName,
                        orderId: order.id || "",
                        orderNumber: order.orderNumber,
                        dealSectionId: deal.sectionId,
                        dealItemId: deal.item.id,
                        issuedAt: now,
                        expiresAt,
                        status: "active",
                        createdAt: now,
                        updatedAt: now,
                    };

                    await voucherRef.set(voucherData);
                    issuedIds.push(voucherRef.id);

                    const expDateStr = new Date(expiresAt.toMillis()).toLocaleDateString("vi-VN");
                    vouchers.push({
                        templateName: template.name,
                        code,
                        status: "ISSUED",
                        message: `Mã voucher: ${code} — HSD: ${expDateStr}`,
                    });

                    // Increment template counter
                    await adminDb.collection(COLLECTIONS.VOUCHER_TEMPLATES).doc(template.id).update({
                        totalIssued: FieldValue.increment(1),
                    });
                }
            } catch (err) {
                console.error(`[deal-checkout] Failed to issue voucher for ${productId}:`, err);
            }
        }
    }

    return { issuedIds, vouchers };
}

// ─── Update Deal Item Stock (Inside Transaction) ──────────────────────────────

/**
 * Increment soldCount on deal items inside a Firestore transaction.
 * Also performs lazy daily reset if needed.
 */
export async function updateDealStockInTransaction(
    tx: FirebaseFirestore.Transaction,
    resolved: Map<string, ResolvedDealItem>,
    cartQuantities: Map<string, number>
): Promise<void> {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    // Group updates by section
    const sectionUpdates = new Map<string, { items: DealItemDocument[] }>();
    for (const [, deal] of resolved) {
        if (!sectionUpdates.has(deal.sectionId)) {
            sectionUpdates.set(deal.sectionId, { items: [...deal.section.items] });
        }
    }

    for (const [productId, deal] of resolved) {
        const qty = cartQuantities.get(productId) ?? 1;
        const sectionData = sectionUpdates.get(deal.sectionId)!;

        // Find and update the item in the section's items array
        const itemIdx = sectionData.items.findIndex((i) => i.id === deal.item.id);
        if (itemIdx === -1) continue;

        const item = sectionData.items[itemIdx];
        const needsReset = item.stockResetPeriod === "daily" && item.lastStockResetDate !== todayStr;

        sectionData.items[itemIdx] = {
            ...item,
            soldCount: needsReset ? qty : item.soldCount + qty,
            lastStockResetDate: needsReset ? todayStr : item.lastStockResetDate,
        };
    }

    // Write section updates
    for (const [sectionId, data] of sectionUpdates) {
        const sectionRef = adminDb.collection(COLLECTIONS.DEAL_SECTIONS).doc(sectionId);
        tx.update(sectionRef, {
            items: data.items,
            updatedAt: FieldValue.serverTimestamp(),
        });
    }
}

/**
 * Standalone convenience wrapper: runs deal stock update in its own transaction.
 * Use this from checkout flows that don't already have a Firestore transaction.
 */
export async function updateDealStock(
    resolved: Map<string, ResolvedDealItem>,
    cartQuantities: Map<string, number>
): Promise<void> {
    if (resolved.size === 0) return;
    await adminDb.runTransaction(async (tx) => {
        // Re-read sections inside the transaction for consistency
        const freshResolved = new Map<string, ResolvedDealItem>();
        const sectionCache = new Map<string, DealSectionDocument>();

        for (const [productId, deal] of resolved) {
            if (!sectionCache.has(deal.sectionId)) {
                const sectionRef = adminDb.collection(COLLECTIONS.DEAL_SECTIONS).doc(deal.sectionId);
                const snap = await tx.get(sectionRef);
                if (!snap.exists) continue;
                sectionCache.set(deal.sectionId, { id: snap.id, ...snap.data() } as DealSectionDocument);
            }
            const freshSection = sectionCache.get(deal.sectionId)!;
            const freshItem = freshSection.items.find((i) => i.id === deal.item.id);
            if (!freshItem) continue;
            freshResolved.set(productId, { sectionId: deal.sectionId, section: freshSection, item: freshItem });
        }

        await updateDealStockInTransaction(tx, freshResolved, cartQuantities);
    });
}

// ─── Issue Vouchers From Order Items ──────────────────────────────────────────

/**
 * Convenience wrapper: reconstructs the resolved deal map from order items
 * that have dealSectionId/dealItemId, then calls issueVouchersForOrder.
 *
 * Used in mock-pay and approveBankTransfer where the original resolved map
 * is no longer available.
 */
export async function issueVouchersFromOrderItems(
    order: OrderDocument
): Promise<{ issuedIds: string[]; vouchers: VoucherEmailInfo[] }> {
    console.log(`[deal-checkout] issueVouchersFromOrderItems called for order: ${order.id}, items: ${order.items.length}`);

    // Rebuild resolved map from order items
    const resolved = new Map<string, ResolvedDealItem>();

    for (const item of order.items) {
        console.log(`[deal-checkout] Item: ${item.productName} | isDealItem=${item.isDealItem} | dealSectionId=${item.dealSectionId} | dealItemId=${item.dealItemId}`);
        if (!item.isDealItem || !item.dealSectionId || !item.dealItemId) continue;

        // Fetch section if not already cached
        if (!resolved.has(item.productId)) {
            const sectionDoc = await adminDb
                .collection(COLLECTIONS.DEAL_SECTIONS)
                .doc(item.dealSectionId)
                .get();

            if (!sectionDoc.exists) {
                console.error(`[deal-checkout] Section not found: ${item.dealSectionId}`);
                continue;
            }

            const section = { id: sectionDoc.id, ...sectionDoc.data() } as DealSectionDocument;
            const dealItem = section.items.find((di) => di.id === item.dealItemId);
            if (!dealItem) {
                console.error(`[deal-checkout] DealItem not found in section: ${item.dealItemId}`);
                continue;
            }

            console.log(`[deal-checkout] Resolved deal item: ${dealItem.name} | giftVoucher=${JSON.stringify(dealItem.giftVoucher || null)}`);
            resolved.set(item.productId, { sectionId: item.dealSectionId, section, item: dealItem });
        }
    }

    if (resolved.size === 0) {
        console.log("[deal-checkout] No deal items with voucher config found — returning empty");
        return { issuedIds: [], vouchers: [] };
    }

    console.log(`[deal-checkout] Proceeding with ${resolved.size} resolved deal items`);
    return issueVouchersForOrder(order, resolved);
}
