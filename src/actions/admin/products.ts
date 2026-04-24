"use server";

import "server-only";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { revalidateTag } from "next/cache";
import { PRODUCT_CACHE_TAG, PRODUCT_GROUP_CACHE_TAG } from "@/actions/products";
import { Timestamp } from "firebase-admin/firestore";
import type { ProductDocument, ProductStatus } from "@/types/firestore";
import { z } from "zod/v4";

// ─── Validation Schemas ───────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(2, "Tên sản phẩm tối thiểu 2 ký tự"),
  nameLocales: z.record(z.string(), z.string()).optional(),
  description: z.string().optional(),
  descriptionLocales: z.record(z.string(), z.string()).optional(),
  type: z.enum(["ticket", "combo", "membership"]),
  price: z.number().positive("Giá phải lớn hơn 0"),
  thumbnailUrl: z.string().url("URL ảnh không hợp lệ"),
  groupId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  totalStock: z.number().int().positive().optional(),
  stockResetPeriod: z.enum(["none", "daily", "monthly"]).optional(),
  validityConfig: z.object({
    type: z.enum(["date-specific", "date-range", "open-dated"]),
    validDaysFromPurchase: z.number().optional(),
    specificDate: z.any().optional(),
    overallExpiresAt: z.any().optional(),
  }),
  comboItems: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
  commissionRate: z.number().min(0).max(1).optional(),
  // Membership config — only relevant when type = 'membership'
  membershipConfig: z.object({
    packageName: z.string().optional(),
    basePoints: z.number().int().min(0),
    bonusPoints: z.number().int().min(0),
    merch: z.string().optional(),
  }).optional(),
});

export type ProductFormData = z.infer<typeof productSchema>;

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Upload Thumbnail (Option B: Server Action + Admin SDK) ───────────────────
/**
 * Validates and uploads a product thumbnail via the Admin SDK.
 * File never hits client-side Firebase Storage rules.
 */
export async function uploadThumbnail(
  formData: FormData
): Promise<AdminActionResult<{ url: string }>> {
  await requireAdmin();

  const file = formData.get("thumbnail") as File | null;
  if (!file) return { success: false, error: "Không có file được chọn" };

  // Client always converts to WebP before calling this action
  if (file.type !== "image/webp") {
    return { success: false, error: "Chỉ chấp nhận ảnh WebP (đã được chuyển đổi tự động)" };
  }

  // 20 MB ceiling (post-compression WebP is always much smaller)
  const MAX_BYTES = 20 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return { success: false, error: "Ảnh không được vượt quá 20MB" };
  }

  try {
    const filename = `products/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.webp`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(filename);

    await fileRef.save(buffer, { contentType: "image/webp" });
    await fileRef.makePublic();

    const url = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    return { success: true, data: { url } };
  } catch (err) {
    console.error("[uploadThumbnail]", err);
    return { success: false, error: "Upload thất bại, vui lòng thử lại" };
  }
}

// ─── Get Products (Admin — all statuses) ─────────────────────────────────────
export async function getAdminProducts(): Promise<ProductDocument[]> {
  await requireAdmin();

  const snap = await adminDb
    .collection(COLLECTIONS.PRODUCTS)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ProductDocument, "id">),
  }));
}

// ─── Create Product ───────────────────────────────────────────────────────────
export async function createProduct(
  data: ProductFormData
): Promise<AdminActionResult<{ id: string }>> {
  const session = await requireAdmin();

  const parsed = productSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  const now = Timestamp.now();
  const docRef = await adminDb.collection(COLLECTIONS.PRODUCTS).add({
    ...parsed.data,
    status: "active" as ProductStatus,
    soldCount: 0,
    createdBy: session.uid,
    createdAt: now,
    updatedAt: now,
  });

  revalidateTag(PRODUCT_CACHE_TAG, "default");
  return { success: true, data: { id: docRef.id } };
}

// ─── Update Product ───────────────────────────────────────────────────────────
export async function updateProduct(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Partial<ProductFormData & { status: ProductStatus; flashSale: any }>
): Promise<AdminActionResult> {
  await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PRODUCTS)
    .doc(id)
    .update({ ...data, updatedAt: Timestamp.now() });

  revalidateTag(PRODUCT_CACHE_TAG, "default");
  return { success: true };
}

// ─── Toggle Status ────────────────────────────────────────────────────────────
export async function toggleProductStatus(
  id: string,
  currentStatus: ProductStatus
): Promise<AdminActionResult> {
  await requireAdmin();

  const next: ProductStatus =
    currentStatus === "active" ? "sold-out" : "active";

  await adminDb
    .collection(COLLECTIONS.PRODUCTS)
    .doc(id)
    .update({ status: next, updatedAt: Timestamp.now() });

  revalidateTag(PRODUCT_CACHE_TAG, "default");
  return { success: true };
}

// ─── Delete (soft — set hidden) ───────────────────────────────────────────────
export async function deleteProduct(id: string): Promise<AdminActionResult> {
  await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PRODUCTS)
    .doc(id)
    .update({ status: "hidden" as ProductStatus, updatedAt: Timestamp.now() });

  revalidateTag(PRODUCT_CACHE_TAG, "default");
  return { success: true };
}
