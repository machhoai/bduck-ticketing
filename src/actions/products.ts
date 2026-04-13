import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { ProductDocument, ProductGroupDocument } from "@/types/firestore";

// ─── Cache Tags ───────────────────────────────────────────────────────────────
export const PRODUCT_CACHE_TAG = "products";
export const PRODUCT_GROUP_CACHE_TAG = "product-groups";

// ─── Get Product Groups ───────────────────────────────────────────────────────
/**
 * Fetches all active product groups ordered by `order` field.
 * Used to render the tab navigation on the home page.
 * Cached for 60 seconds; invalidate with revalidateTag('product-groups').
 */
export const getProductGroups = unstable_cache(
  async (): Promise<ProductGroupDocument[]> => {
    const snap = await adminDb
      .collection(COLLECTIONS.PRODUCT_GROUPS)
      .where("isActive", "==", true)
      .orderBy("order", "asc")
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...JSON.parse(JSON.stringify(doc.data())),
    })) as ProductGroupDocument[];
  },
  [PRODUCT_GROUP_CACHE_TAG],
  { tags: [PRODUCT_GROUP_CACHE_TAG], revalidate: 60 }
);

// ─── Get Products ─────────────────────────────────────────────────────────────
/**
 * Fetches active products, optionally filtered by groupId.
 * Cached per groupId for 60 seconds.
 */
export const getProducts = unstable_cache(
  async (groupId?: string): Promise<ProductDocument[]> => {
    let query = adminDb
      .collection(COLLECTIONS.PRODUCTS)
      .where("status", "==", "active");

    if (groupId) {
      query = query.where("groupId", "==", groupId);
    }

    const snap = await query.orderBy("createdAt", "desc").get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...JSON.parse(JSON.stringify(doc.data())),
    })) as ProductDocument[];
  },
  [PRODUCT_CACHE_TAG],
  { tags: [PRODUCT_CACHE_TAG], revalidate: 60 }
);

// ─── Get Product By ID ────────────────────────────────────────────────────────
/**
 * Fetches a single product by ID.
 * Wrapped in React cache() for request-level deduplication within SSR.
 * Also wrapped in unstable_cache for cross-request caching.
 */
export const getProductById = cache(
  unstable_cache(
    async (id: string): Promise<ProductDocument | null> => {
      const doc = await adminDb.collection(COLLECTIONS.PRODUCTS).doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...(doc.data() as Omit<ProductDocument, "id">) };
    },
    [PRODUCT_CACHE_TAG],
    { tags: [PRODUCT_CACHE_TAG], revalidate: 60 }
  )
);

// ─── Get Effective Price ──────────────────────────────────────────────────────
/**
 * Returns the effective price for a product, accounting for active flash sales.
 * Used server-side only (D5: server re-fetches prices).
 */
export function getEffectivePrice(product: ProductDocument): number {
  if (!product.flashSale) return product.price;

  const now = Date.now();
  const start = product.flashSale.startAt.toMillis();
  const end = product.flashSale.endAt.toMillis();

  if (now >= start && now <= end) {
    return product.flashSale.salePrice;
  }

  return product.price;
}
