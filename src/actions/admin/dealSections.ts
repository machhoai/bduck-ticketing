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

        const payload: Omit<DealSectionDocument, "id"> = {
            title: input.title.trim(),
            description: input.description?.trim(),
            badgeLabel: input.badgeLabel?.trim(),
            dailyOpenHour: input.dailyOpenHour,
            dailyOpenMinute: input.dailyOpenMinute ?? 0,
            startAt: toTimestamp(input.startAt) as any,
            endAt: toTimestamp(input.endAt) as any,
            maxPromoItemsPerOrder: input.maxPromoItemsPerOrder,
            maxPromoVariantsPerOrder: input.maxPromoVariantsPerOrder,
            isActive: input.isActive,
            order: input.order,
            items: [],
            createdBy: admin.uid,
            createdAt: now as any,
            updatedAt: now as any,
        };

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

        const newItem: DealItemDocument = {
            id: randomUUID(),
            linkedProductId: input.linkedProductId,
            name: input.name.trim(),
            description: input.description?.trim(),
            thumbnailUrl: input.thumbnailUrl,
            productType: input.productType,
            originalPrice: input.originalPrice,
            dealType: input.dealType,
            discountValue: input.discountValue,
            effectivePrice: input.effectivePrice,
            membershipConfig: input.membershipConfig,
            membershipBonusOverride: input.membershipBonusOverride,
            giftVoucher: input.giftVoucher,
            giftMerch: input.giftMerch?.trim(),
            totalStock: input.totalStock,
            stockResetPeriod: input.stockResetPeriod ?? "none",
            soldCount: 0,
            lastStockResetDate: undefined,
            maxQtyPerOrder: input.maxQtyPerOrder,
            isActive: input.isActive,
            order: input.order,
        };

        // Append to items array atomically
        await col().doc(sectionId).update({
            items: FieldValue.arrayUnion(newItem),
            updatedAt: FieldValue.serverTimestamp(),
        });

        revalidatePath(`/admin/deal-sections/${sectionId}`);
        return { success: true };
    } catch (err) {
        console.error("[dealSections] addDealItem:", err);
        return { success: false, error: "Không thể thêm deal item." };
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
