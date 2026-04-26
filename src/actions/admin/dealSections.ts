"use server";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import type {
    DealSectionDocument,
    DealItemDocument,
    DealType,
    DealBonusOverride,
    GiftVoucherConfig,
    MembershipConfig,
    ProductType,
} from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateDealSectionInput {
    title: string;
    description?: string;
    badgeLabel?: string;
    dailyOpenHour?: number;
    dailyOpenMinute?: number;
    startAt?: Date;
    endAt?: Date;
    maxPromoItemsPerOrder?: number;
    maxPromoVariantsPerOrder?: number;
    isActive: boolean;
    order: number;
}

export interface CreateDealItemInput {
    linkedProductId?: string;
    name: string;
    description?: string;
    thumbnailUrl: string;
    productType: ProductType;
    originalPrice: number;
    dealType: DealType;
    discountValue: number;
    effectivePrice: number;
    membershipConfig?: MembershipConfig;
    membershipBonusOverride?: DealBonusOverride;
    giftVoucher?: GiftVoucherConfig;
    giftMerch?: string;
    totalStock?: number;
    stockResetPeriod?: "daily" | "none";
    stockResetHour?: number;
    stockResetMinute?: number;
    maxQtyPerOrder: number;
    isActive: boolean;
    order: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function col() {
    return adminDb.collection(COLLECTIONS.DEAL_SECTIONS);
}

function toTimestamp(date: Date | undefined) {
    if (!date) return undefined;
    const { Timestamp } = require("firebase-admin/firestore");
    return Timestamp.fromDate(date);
}

// ─── Section CRUD ─────────────────────────────────────────────────────────────

export async function getAdminDealSections(): Promise<DealSectionDocument[]> {
    await requireAdmin();
    const snap = await col().orderBy("order", "asc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DealSectionDocument));
}

export async function getAdminDealSection(id: string): Promise<DealSectionDocument | null> {
    await requireAdmin();
    const doc = await col().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as DealSectionDocument;
}

export async function createDealSection(
    input: CreateDealSectionInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
    try {
        const admin = await requireAdmin();
        const now = FieldValue.serverTimestamp();

        // Build payload without undefined fields — Firestore Admin SDK rejects undefined values
        const payload: Record<string, unknown> = {
            title: input.title.trim(),
            dailyOpenMinute: input.dailyOpenMinute ?? 0,
            isActive: input.isActive,
            order: input.order,
            items: [],
            createdBy: admin.uid,
            createdAt: now,
            updatedAt: now,
        };

        // Optional fields — only set when provided
        if (input.description?.trim()) payload.description = input.description.trim();
        if (input.badgeLabel?.trim()) payload.badgeLabel = input.badgeLabel.trim();
        if (input.dailyOpenHour !== undefined) payload.dailyOpenHour = input.dailyOpenHour;
        if (input.startAt) payload.startAt = toTimestamp(input.startAt);
        if (input.endAt) payload.endAt = toTimestamp(input.endAt);
        if (input.maxPromoItemsPerOrder !== undefined) payload.maxPromoItemsPerOrder = input.maxPromoItemsPerOrder;
        if (input.maxPromoVariantsPerOrder !== undefined) payload.maxPromoVariantsPerOrder = input.maxPromoVariantsPerOrder;

        const ref = await col().add(payload);
        revalidatePath("/admin/deal-sections");
        return { success: true, id: ref.id };
    } catch (err) {
        console.error("[dealSections] createDealSection:", err);
        return { success: false, error: "Không thể tạo Deal Section." };
    }
}

export async function updateDealSection(
    id: string,
    input: Partial<CreateDealSectionInput>
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();
        const updates: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (input.title !== undefined) updates.title = input.title.trim();
        if (input.description !== undefined) updates.description = input.description.trim();
        if (input.badgeLabel !== undefined) updates.badgeLabel = input.badgeLabel.trim();
        if (input.dailyOpenHour !== undefined) updates.dailyOpenHour = input.dailyOpenHour;
        if (input.dailyOpenMinute !== undefined) updates.dailyOpenMinute = input.dailyOpenMinute;
        if (input.startAt !== undefined) updates.startAt = toTimestamp(input.startAt);
        if (input.endAt !== undefined) updates.endAt = toTimestamp(input.endAt);
        if (input.maxPromoItemsPerOrder !== undefined) updates.maxPromoItemsPerOrder = input.maxPromoItemsPerOrder;
        if (input.maxPromoVariantsPerOrder !== undefined) updates.maxPromoVariantsPerOrder = input.maxPromoVariantsPerOrder;
        if (input.isActive !== undefined) updates.isActive = input.isActive;
        if (input.order !== undefined) updates.order = input.order;

        await col().doc(id).update(updates);
        revalidatePath("/admin/deal-sections");
        revalidatePath(`/admin/deal-sections/${id}`);
        return { success: true };
    } catch (err) {
        console.error("[dealSections] updateDealSection:", err);
        return { success: false, error: "Không thể cập nhật Deal Section." };
    }
}

export async function toggleDealSectionStatus(
    id: string,
    isActive: boolean
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();
        await col().doc(id).update({ isActive, updatedAt: FieldValue.serverTimestamp() });
        revalidatePath("/admin/deal-sections");
        return { success: true };
    } catch (err) {
        console.error("[dealSections] toggleStatus:", err);
        return { success: false, error: "Không thể thay đổi trạng thái." };
    }
}

export async function deleteDealSection(
    id: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();
        await col().doc(id).delete();
        revalidatePath("/admin/deal-sections");
        return { success: true };
    } catch (err) {
        console.error("[dealSections] deleteDealSection:", err);
        return { success: false, error: "Không thể xoá Deal Section." };
    }
}

// ─── Deal Item CRUD (embedded in section) ─────────────────────────────────────

export async function addDealItem(
    sectionId: string,
    input: CreateDealItemInput
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();

        // Build item payload without any undefined fields — Firestore rejects them
        const newItem: Record<string, unknown> = {
            id: randomUUID(),
            name: input.name.trim(),
            thumbnailUrl: input.thumbnailUrl,
            productType: input.productType,
            originalPrice: input.originalPrice,
            dealType: input.dealType,
            discountValue: input.discountValue,
            effectivePrice: input.effectivePrice,
            stockResetPeriod: input.stockResetPeriod ?? "none",
            soldCount: 0,
            maxQtyPerOrder: input.maxQtyPerOrder,
            isActive: input.isActive,
            order: input.order,
        };

        // Optional fields — only include when defined
        if (input.linkedProductId) newItem.linkedProductId = input.linkedProductId;
        if (input.description?.trim()) newItem.description = input.description.trim();
        if (input.membershipConfig) newItem.membershipConfig = input.membershipConfig;
        if (input.membershipBonusOverride) newItem.membershipBonusOverride = input.membershipBonusOverride;
        if (input.giftVoucher) newItem.giftVoucher = input.giftVoucher;
        if (input.giftMerch?.trim()) newItem.giftMerch = input.giftMerch.trim();
        if (input.totalStock !== undefined) newItem.totalStock = input.totalStock;
        if (input.stockResetHour !== undefined) newItem.stockResetHour = input.stockResetHour;
        if (input.stockResetMinute !== undefined) newItem.stockResetMinute = input.stockResetMinute;

        // Append to items array atomically
        await col().doc(sectionId).update({
            items: FieldValue.arrayUnion(newItem),
            updatedAt: FieldValue.serverTimestamp(),
        });

        revalidatePath(`/admin/deal-sections/${sectionId}`);
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[dealSections] addDealItem:", err);
        // Return actual error so UI can display it
        return { success: false, error: `Lỗi: ${message}` };
    }
}

export async function updateDealItem(
    sectionId: string,
    itemId: string,
    input: Partial<CreateDealItemInput>
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();

        // Read-modify-write (section doc is small enough)
        const sectionDoc = await col().doc(sectionId).get();
        if (!sectionDoc.exists) return { success: false, error: "Section không tồn tại." };

        const section = sectionDoc.data() as DealSectionDocument;
        const itemIndex = section.items.findIndex((i) => i.id === itemId);
        if (itemIndex === -1) return { success: false, error: "Item không tồn tại." };

        const updatedItems = [...section.items];
        updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...input };

        await col().doc(sectionId).update({
            items: updatedItems,
            updatedAt: FieldValue.serverTimestamp(),
        });

        revalidatePath(`/admin/deal-sections/${sectionId}`);
        return { success: true };
    } catch (err) {
        console.error("[dealSections] updateDealItem:", err);
        return { success: false, error: "Không thể cập nhật deal item." };
    }
}

export async function removeDealItem(
    sectionId: string,
    itemId: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();

        const sectionDoc = await col().doc(sectionId).get();
        if (!sectionDoc.exists) return { success: false, error: "Section không tồn tại." };

        const section = sectionDoc.data() as DealSectionDocument;
        const updatedItems = section.items.filter((i) => i.id !== itemId);

        await col().doc(sectionId).update({
            items: updatedItems,
            updatedAt: FieldValue.serverTimestamp(),
        });

        revalidatePath(`/admin/deal-sections/${sectionId}`);
        return { success: true };
    } catch (err) {
        console.error("[dealSections] removeDealItem:", err);
        return { success: false, error: "Không thể xoá deal item." };
    }
}

/** Reorder items by providing a new ordered array of item IDs */
export async function reorderDealItems(
    sectionId: string,
    orderedItemIds: string[]
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();

        const sectionDoc = await col().doc(sectionId).get();
        if (!sectionDoc.exists) return { success: false, error: "Section không tồn tại." };

        const section = sectionDoc.data() as DealSectionDocument;
        const itemMap = new Map(section.items.map((i) => [i.id, i]));

        const reordered = orderedItemIds
            .map((id, idx) => {
                const item = itemMap.get(id);
                return item ? { ...item, order: idx } : null;
            })
            .filter(Boolean) as DealItemDocument[];

        await col().doc(sectionId).update({
            items: reordered,
            updatedAt: FieldValue.serverTimestamp(),
        });

        revalidatePath(`/admin/deal-sections/${sectionId}`);
        return { success: true };
    } catch (err) {
        console.error("[dealSections] reorderDealItems:", err);
        return { success: false, error: "Không thể sắp xếp lại items." };
    }
}
