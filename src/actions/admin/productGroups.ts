"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { revalidateTag } from "next/cache";
import { PRODUCT_GROUP_CACHE_TAG } from "@/actions/products";
import { Timestamp } from "firebase-admin/firestore";
import type { ProductGroupDocument } from "@/types/firestore";

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Get All (including inactive) ────────────────────────────────────────────
export async function getProductGroupsAdmin(): Promise<ProductGroupDocument[]> {
  await requireAdmin();

  const snap = await adminDb
    .collection(COLLECTIONS.PRODUCT_GROUPS)
    .orderBy("order", "asc")
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ProductGroupDocument, "id">),
  }));
}

// ─── Create ───────────────────────────────────────────────────────────────────
export async function createProductGroup(data: {
  name: string;
  slug: string;
  order: number;
}): Promise<AdminActionResult<{ id: string }>> {
  const session = await requireAdmin();

  // Slug uniqueness check
  const existing = await adminDb
    .collection(COLLECTIONS.PRODUCT_GROUPS)
    .where("slug", "==", data.slug)
    .get();

  if (!existing.empty) {
    return { success: false, error: "Slug đã tồn tại, hãy chọn slug khác" };
  }

  const now = Timestamp.now();
  const ref = await adminDb.collection(COLLECTIONS.PRODUCT_GROUPS).add({
    name: data.name,
    slug: data.slug,
    order: data.order,
    isActive: true,
    createdBy: session.uid,
    createdAt: now,
    updatedAt: now,
  });

  revalidateTag(PRODUCT_GROUP_CACHE_TAG, "default");
  return { success: true, data: { id: ref.id } };
}

// ─── Update ───────────────────────────────────────────────────────────────────
export async function updateProductGroup(
  id: string,
  data: Partial<Pick<ProductGroupDocument, "name" | "slug" | "order">>
): Promise<AdminActionResult> {
  await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PRODUCT_GROUPS)
    .doc(id)
    .update({ ...data, updatedAt: Timestamp.now() });

  revalidateTag(PRODUCT_GROUP_CACHE_TAG, "default");
  return { success: true };
}

// ─── Toggle Active ────────────────────────────────────────────────────────────
export async function toggleProductGroupActive(
  id: string,
  currentActive: boolean
): Promise<AdminActionResult> {
  await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PRODUCT_GROUPS)
    .doc(id)
    .update({ isActive: !currentActive, updatedAt: Timestamp.now() });

  revalidateTag(PRODUCT_GROUP_CACHE_TAG, "default");
  return { success: true };
}

// ─── Move Up/Down (reorder) ───────────────────────────────────────────────────
/**
 * Swaps the `order` field of two adjacent groups.
 * Called by Up/Down arrow buttons in the admin UI.
 */
export async function swapProductGroupOrder(
  idA: string,
  orderA: number,
  idB: string,
  orderB: number
): Promise<AdminActionResult> {
  await requireAdmin();

  const batch = adminDb.batch();
  const now = Timestamp.now();

  batch.update(adminDb.collection(COLLECTIONS.PRODUCT_GROUPS).doc(idA), {
    order: orderB,
    updatedAt: now,
  });
  batch.update(adminDb.collection(COLLECTIONS.PRODUCT_GROUPS).doc(idB), {
    order: orderA,
    updatedAt: now,
  });

  await batch.commit();

  revalidateTag(PRODUCT_GROUP_CACHE_TAG, "default");
  return { success: true };
}
