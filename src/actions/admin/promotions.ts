"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { PromotionDocument } from "@/types/firestore";
import { z } from "zod/v4";

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

const promotionSchema = z.object({
  code: z.string().min(3).toUpperCase(),
  type: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive("Giá trị giảm phải lớn hơn 0"),
  maxDiscountAmount: z.number().optional(),
  minOrderValue: z.number().optional(),
  maxUses: z.number().int().positive(),
  maxUsesPerUser: z.number().int().positive().optional(),
  startAt: z.string().optional(), // ISO date string
  endAt: z.string().optional(),
});

export type PromotionFormData = z.infer<typeof promotionSchema>;

// ─── Get All Promotions ───────────────────────────────────────────────────────
export async function getPromotions(): Promise<PromotionDocument[]> {
  await requireAdmin();

  const snap = await adminDb
    .collection(COLLECTIONS.PROMOTIONS)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<PromotionDocument, "id">),
  }));
}

// ─── Create Promotion ─────────────────────────────────────────────────────────
export async function createPromotion(
  data: PromotionFormData
): Promise<AdminActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = promotionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  // Code uniqueness check
  const existing = await adminDb
    .collection(COLLECTIONS.PROMOTIONS)
    .where("code", "==", parsed.data.code)
    .get();

  if (!existing.empty) {
    return { success: false, error: `Mã "${parsed.data.code}" đã tồn tại` };
  }

  const now = Timestamp.now();
  const ref = await adminDb.collection(COLLECTIONS.PROMOTIONS).add({
    ...parsed.data,
    startAt: parsed.data.startAt
      ? Timestamp.fromDate(new Date(parsed.data.startAt))
      : null,
    endAt: parsed.data.endAt
      ? Timestamp.fromDate(new Date(parsed.data.endAt))
      : null,
    usedCount: 0,
    status: "active",
    createdBy: session.uid,
    createdAt: now,
    updatedAt: now,
  });

  return { success: true, data: { id: ref.id } };
}

// ─── Update Promotion ─────────────────────────────────────────────────────────
export async function updatePromotion(
  id: string,
  data: Partial<PromotionFormData>
): Promise<AdminActionResult> {
  await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PROMOTIONS)
    .doc(id)
    .update({ ...data, updatedAt: Timestamp.now() });

  return { success: true };
}

// ─── Deactivate Promotion ─────────────────────────────────────────────────────
export async function deactivatePromotion(
  id: string
): Promise<AdminActionResult> {
  await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PROMOTIONS)
    .doc(id)
    .update({ status: "inactive", updatedAt: Timestamp.now() });

  return { success: true };
}
