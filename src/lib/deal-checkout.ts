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
import { registerEventCustomer } from "@/lib/event-gacha";
import { sendVoucherNotificationEmail, type IssuedVoucherInfo } from "@/lib/email/voucher-notification";

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

// ─── Issue Vouchers Post-Payment ──────────────────────────────────────────────

/**
 * After order is confirmed paid, issue vouchers for all deal items that have giftVoucher config.
 * Also handles event_gacha vouchers by calling the external API.
 *
 * This runs OUTSIDE the main transaction (fire-and-forget with error logging)
 * because it involves external API calls that shouldn't block order completion.
 */
export async function issueVouchersForOrder(
    order: OrderDocument,
    resolved: Map<string, ResolvedDealItem>
): Promise<string[]> {
    const issuedIds: string[] = [];
    const issuedVouchers: IssuedVoucherInfo[] = [];
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
                    // ── Event Gacha: call external API ──
                    const result = await registerEventCustomer({
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

                    // Create issued voucher record (for audit trail)
                    const voucherRef = adminDb.collection(COLLECTIONS.ISSUED_VOUCHERS).doc();
                    const voucherData: Record<string, unknown> = {
                        templateId: template.id,
                        templateName: template.name,
                        voucherType: template.voucherType,
                        code: `GACHA-${order.orderNumber}-${i + 1}`, // internal reference
                        customerId: order.customerId || "",
                        customerEmail: order.customerEmail,
                        customerPhone: order.customerPhone || "",
                        customerName: order.customerName,
                        orderId: order.id,
                        orderNumber: order.orderNumber,
                        dealSectionId: deal.sectionId,
                        dealItemId: deal.item.id,
                        issuedAt: now,
                        expiresAt: now, // N/A for gacha
                        status: result.success ? "active" : "pending_registration",
                        createdAt: now,
                        updatedAt: now,
                    };

                    // Store API result metadata
                    if (result.success) {
                        voucherData.eventGachaResult = {
                            spinsRemaining: result.spinsRemaining,
                            isNewUser: result.isNewUser,
                            message: result.message,
                        };
                    } else {
                        voucherData.eventGachaError = result.error;
                    }

                    await voucherRef.set(voucherData);
                    issuedIds.push(voucherRef.id);

                    // Collect for email notification
                    issuedVouchers.push({
                        templateName: template.name,
                        voucherType: "event_gacha",
                        code: `GACHA-${order.orderNumber}-${i + 1}`,
                        gachaSpinsRemaining: result.success ? result.spinsRemaining : undefined,
                        gachaMessage: result.success ? (result.message || "Đăng ký thành công!") : undefined,
                        gachaPlayUrl: template.eventGachaConfig?.apiBaseUrl
                            ? `${template.eventGachaConfig.apiBaseUrl}/event/${template.eventGachaConfig.eventId}`
                            : undefined,
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
                        orderId: order.id,
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

                    // Collect for email notification
                    issuedVouchers.push({
                        templateName: template.name,
                        voucherType: "standard",
                        code,
                        expiresAt: new Date(expiresAt.toMillis()).toISOString(),
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

    // ── Send voucher notification email ──
    if (issuedVouchers.length > 0 && order.customerEmail) {
        sendVoucherNotificationEmail({
            to: order.customerEmail,
            customerName: order.customerName,
            orderNumber: order.orderNumber,
            vouchers: issuedVouchers,
        }).catch((err) =>
            console.error("[deal-checkout] Voucher email failed (non-fatal):", err)
        );
    }

    return issuedIds;
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
): Promise<string[]> {
    // Rebuild resolved map from order items
    const resolved = new Map<string, ResolvedDealItem>();

    for (const item of order.items) {
        if (!item.isDealItem || !item.dealSectionId || !item.dealItemId) continue;

        // Fetch section if not already cached
        if (!resolved.has(item.productId)) {
            const sectionDoc = await adminDb
                .collection(COLLECTIONS.DEAL_SECTIONS)
                .doc(item.dealSectionId)
                .get();

            if (!sectionDoc.exists) continue;

            const section = { id: sectionDoc.id, ...sectionDoc.data() } as DealSectionDocument;
            const dealItem = section.items.find((di) => di.id === item.dealItemId);
            if (!dealItem) continue;

            resolved.set(item.productId, { sectionId: item.dealSectionId, section, item: dealItem });
        }
    }

    if (resolved.size === 0) return [];
    return issueVouchersForOrder(order, resolved);
}
