"use server";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import type {
    VoucherTemplateDocument,
    VoucherType,
    OnlineDiscountConfig,
} from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateVoucherTemplateInput {
    name: string;
    description?: string;
    imageUrl?: string;
    voucherType: VoucherType;
    codePrefix?: string;
    codeSuffix?: string;
    codeLength: number;
    validDays: number;
    // online_discount
    onlineDiscount?: OnlineDiscountConfig;
    // instore
    instoreDescription?: string;
    instorePoints?: number;
    isActive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function col() {
    return adminDb.collection(COLLECTIONS.VOUCHER_TEMPLATES);
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Fetch all voucher templates for admin — ordered by createdAt desc */
export async function getAdminVoucherTemplates(): Promise<VoucherTemplateDocument[]> {
    await requireAdmin();
    const snap = await col().orderBy("createdAt", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as VoucherTemplateDocument));
}

/** Fetch a single template by ID */
export async function getAdminVoucherTemplate(
    id: string
): Promise<VoucherTemplateDocument | null> {
    await requireAdmin();
    const doc = await col().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as VoucherTemplateDocument;
}

/** Create a new voucher template */
export async function createVoucherTemplate(
    input: CreateVoucherTemplateInput
): Promise<{ success: true; id: string } | { success: false; error: string }> {
    try {
        const admin = await requireAdmin();
        const now = FieldValue.serverTimestamp();

        const payload: Omit<VoucherTemplateDocument, "id"> = {
            name: input.name.trim(),
            description: input.description?.trim(),
            imageUrl: input.imageUrl?.trim() || undefined,
            voucherType: input.voucherType,
            codePrefix: input.codePrefix?.trim().toUpperCase() || undefined,
            codeSuffix: input.codeSuffix?.trim().toUpperCase() || undefined,
            codeLength: input.codeLength,
            validDays: input.validDays,
            onlineDiscount: input.voucherType === "online_discount" ? input.onlineDiscount : undefined,
            instoreDescription: input.voucherType !== "online_discount" ? input.instoreDescription?.trim() : undefined,
            instorePoints: input.voucherType === "instore_points" ? input.instorePoints : undefined,
            isActive: input.isActive,
            totalIssued: 0,
            totalRedeemed: 0,
            createdBy: admin.uid,
            createdAt: now as any,
            updatedAt: now as any,
        };

        const ref = await col().add(payload);
        revalidatePath("/admin/voucher-templates");
        return { success: true, id: ref.id };
    } catch (err) {
        console.error("[voucherTemplates] createVoucherTemplate:", err);
        return { success: false, error: "Không thể tạo mẫu voucher. Vui lòng thử lại." };
    }
}

/** Update an existing template */
export async function updateVoucherTemplate(
    id: string,
    input: Partial<CreateVoucherTemplateInput>
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();

        const updates: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (input.name !== undefined) updates.name = input.name.trim();
        if (input.description !== undefined) updates.description = input.description.trim();
        if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl.trim() || null;
        if (input.voucherType !== undefined) updates.voucherType = input.voucherType;
        if (input.codePrefix !== undefined) updates.codePrefix = input.codePrefix.trim().toUpperCase() || null;
        if (input.codeSuffix !== undefined) updates.codeSuffix = input.codeSuffix.trim().toUpperCase() || null;
        if (input.codeLength !== undefined) updates.codeLength = input.codeLength;
        if (input.validDays !== undefined) updates.validDays = input.validDays;
        if (input.onlineDiscount !== undefined) updates.onlineDiscount = input.onlineDiscount;
        if (input.instoreDescription !== undefined) updates.instoreDescription = input.instoreDescription.trim();
        if (input.instorePoints !== undefined) updates.instorePoints = input.instorePoints;
        if (input.isActive !== undefined) updates.isActive = input.isActive;

        await col().doc(id).update(updates);
        revalidatePath("/admin/voucher-templates");
        revalidatePath(`/admin/voucher-templates/${id}`);
        return { success: true };
    } catch (err) {
        console.error("[voucherTemplates] updateVoucherTemplate:", err);
        return { success: false, error: "Không thể cập nhật mẫu voucher." };
    }
}

/** Toggle active status */
export async function toggleVoucherTemplateStatus(
    id: string,
    isActive: boolean
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();
        await col().doc(id).update({ isActive, updatedAt: FieldValue.serverTimestamp() });
        revalidatePath("/admin/voucher-templates");
        return { success: true };
    } catch (err) {
        console.error("[voucherTemplates] toggleStatus:", err);
        return { success: false, error: "Không thể thay đổi trạng thái." };
    }
}

/** Delete a template — only allowed if totalIssued = 0 */
export async function deleteVoucherTemplate(
    id: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await requireAdmin();
        const doc = await col().doc(id).get();
        if (!doc.exists) return { success: false, error: "Không tìm thấy mẫu voucher." };

        const data = doc.data() as VoucherTemplateDocument;
        if (data.totalIssued > 0) {
            return {
                success: false,
                error: `Không thể xoá — đã phát ${data.totalIssued} voucher từ mẫu này.`,
            };
        }

        await col().doc(id).delete();
        revalidatePath("/admin/voucher-templates");
        return { success: true };
    } catch (err) {
        console.error("[voucherTemplates] deleteVoucherTemplate:", err);
        return { success: false, error: "Không thể xoá mẫu voucher." };
    }
}

/** Fetch issued vouchers for a specific template — paginated, newest first */
export async function getIssuedVouchersForTemplate(
    templateId: string,
    limit = 50
) {
    await requireAdmin();
    const snap = await adminDb
        .collection(COLLECTIONS.ISSUED_VOUCHERS)
        .where("templateId", "==", templateId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
