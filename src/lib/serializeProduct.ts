/**
 * Serializable product types for RSC → Client Component boundaries.
 * Replaces Firestore Timestamps with plain millisecond numbers.
 *
 * Use `serializeProduct()` in RSC pages before passing to any Client Component.
 */

import type { ProductDocument, ProductType, ProductStatus } from "@/types/firestore";

// ─── Serializable Types ───────────────────────────────────────────────────────

export interface ClientFlashSale {
  salePrice: number;
  /** Unix ms — replaces Firestore Timestamp */
  startAtMs: number;
  /** Unix ms — replaces Firestore Timestamp */
  endAtMs: number;
}

/**
 * Client-safe variant of ProductDocument:
 *  - All Firestore Timestamps removed or converted to numbers
 *  - Safe to pass from RSC to Client Components
 *  - Safe for localStorage persistence via Zustand
 */
export interface ClientProduct {
  id: string;
  name: string;
  nameLocales?: Record<string, string>;
  description: string;
  descriptionLocales?: Record<string, string>;
  type: ProductType;
  price: number;
  thumbnailUrl: string;
  status: ProductStatus;
  groupId?: string;
  dealSectionId?: string;
  soldCount: number;
  totalStock?: number;
  stockResetPeriod?: "none" | "daily" | "monthly";
  commissionRate?: number;
  tags?: string[];
  flashSale?: ClientFlashSale;
}

// ─── Serializer ───────────────────────────────────────────────────────────────

/**
 * Converts a Firestore ProductDocument (with Timestamps) to a ClientProduct
 * safe for passing across the RSC → Client Component boundary.
 */
export function serializeProduct(p: ProductDocument): ClientProduct {
  return {
    id: p.id,
    name: p.name,
    nameLocales: p.nameLocales,
    description: p.description,
    descriptionLocales: p.descriptionLocales,
    type: p.type,
    price: p.price,
    thumbnailUrl: p.thumbnailUrl,
    status: p.status,
    groupId: p.groupId,
    dealSectionId: p.dealSectionId,
    soldCount: p.soldCount,
    totalStock: p.totalStock,
    stockResetPeriod: p.stockResetPeriod,
    commissionRate: p.commissionRate,
    tags: p.tags,
    flashSale: p.flashSale
      ? {
          salePrice: p.flashSale.salePrice,
          startAtMs: p.flashSale.startAt.toMillis(),
          endAtMs: p.flashSale.endAt.toMillis(),
        }
      : undefined,
  };
}

export function serializeProducts(products: ProductDocument[]): ClientProduct[] {
  return products.map(serializeProduct);
}

// ─── Price Helper (client-safe) ───────────────────────────────────────────────

export function getClientEffectivePrice(p: ClientProduct): {
  price: number;
  originalPrice?: number;
  isOnSale: boolean;
} {
  if (!p.flashSale) return { price: p.price, isOnSale: false };
  const now = Date.now();
  if (now >= p.flashSale.startAtMs && now <= p.flashSale.endAtMs) {
    return { price: p.flashSale.salePrice, originalPrice: p.price, isOnSale: true };
  }
  return { price: p.price, isOnSale: false };
}
