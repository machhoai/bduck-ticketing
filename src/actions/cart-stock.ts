"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type {
  ProductDocument,
  DealSectionDocument,
  DealItemDocument,
} from "@/types/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartStockInput {
  productId: string;
  quantity: number;
  dealSectionId?: string;
  dealItemId?: string;
}

export interface CartStockResult {
  productId: string;
  /**
   * Max quantity allowed for this product.
   * null = unlimited stock.
   * Used internally for disabling +/- buttons — NOT displayed to customer.
   */
  maxAllowed: number | null;
  /** Product is completely out of stock (remaining = 0 or status = sold-out) */
  isOutOfStock: boolean;
  /** Product is inactive/hidden/deleted */
  isUnavailable: boolean;
}

// ─── Lazy Daily Stock Reset (mirrors deal-checkout.ts) ────────────────────────

function getEffectiveDealSoldCount(item: DealItemDocument): number {
  if (item.stockResetPeriod !== "daily") return item.soldCount;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const resetH = item.stockResetHour ?? 0;
  const resetM = item.stockResetMinute ?? 0;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const resetMinutes = resetH * 60 + resetM;

  if (nowMinutes >= resetMinutes && item.lastStockResetDate !== todayStr) {
    return 0;
  }

  if (nowMinutes < resetMinutes) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (
      item.lastStockResetDate !== yesterdayStr &&
      item.lastStockResetDate !== todayStr
    ) {
      return 0;
    }
  }

  return item.soldCount;
}

// ─── Check Cart Stock ─────────────────────────────────────────────────────────

/**
 * Check stock availability for all items currently in the cart.
 *
 * Returns per-item availability info WITHOUT exposing exact stock numbers
 * in the UI. `maxAllowed` is used only for logic (disable "+" button).
 *
 * Used by CartDrawer and Cart Page to:
 * - Disable "+" buttons when stock limit reached
 * - Show "out of stock" warnings for depleted items
 * - Warn about unavailable products left in cart
 */
export async function checkCartStock(
  items: CartStockInput[]
): Promise<CartStockResult[]> {
  if (!items.length) return [];

  const results: CartStockResult[] = [];

  for (const item of items) {
    let maxAllowed: number | null = null; // null = unlimited
    let isOutOfStock = false;
    let isUnavailable = false;

    // ── Fetch product ──
    const productDoc = await adminDb
      .collection(COLLECTIONS.PRODUCTS)
      .doc(item.productId)
      .get();

    if (!productDoc.exists) {
      results.push({
        productId: item.productId,
        maxAllowed: 0,
        isOutOfStock: true,
        isUnavailable: true,
      });
      continue;
    }

    const product = {
      id: productDoc.id,
      ...productDoc.data(),
    } as ProductDocument;

    // ── Product status check ──
    if (product.status !== "active") {
      isUnavailable = true;
      isOutOfStock = product.status === "sold-out";
      results.push({
        productId: item.productId,
        maxAllowed: 0,
        isOutOfStock,
        isUnavailable,
      });
      continue;
    }

    // ── Product stock check ──
    if (product.totalStock !== undefined) {
      const remaining = Math.max(0, product.totalStock - product.soldCount);
      maxAllowed = remaining;
      if (remaining === 0) isOutOfStock = true;
    }

    // ── Deal item constraints (maxQtyPerOrder + deal stock) ──
    if (item.dealSectionId && item.dealItemId) {
      try {
        const sectionDoc = await adminDb
          .collection(COLLECTIONS.DEAL_SECTIONS)
          .doc(item.dealSectionId)
          .get();

        if (sectionDoc.exists) {
          const section = {
            id: sectionDoc.id,
            ...sectionDoc.data(),
          } as DealSectionDocument;
          const dealItem = section.items.find((i) => i.id === item.dealItemId);

          if (dealItem && dealItem.isActive) {
            // Cap by maxQtyPerOrder
            const dealMax = dealItem.maxQtyPerOrder;
            maxAllowed =
              maxAllowed === null
                ? dealMax
                : Math.min(maxAllowed, dealMax);

            // Cap by deal item stock
            if (dealItem.totalStock !== undefined) {
              const effectiveSold = getEffectiveDealSoldCount(dealItem);
              const dealRemaining = Math.max(
                0,
                dealItem.totalStock - effectiveSold
              );
              maxAllowed = Math.min(maxAllowed, dealRemaining);
              if (dealRemaining === 0) isOutOfStock = true;
            }
          }
        }
      } catch (err) {
        console.error(
          `[checkCartStock] Failed to check deal section ${item.dealSectionId}:`,
          err
        );
      }
    }

    results.push({
      productId: item.productId,
      maxAllowed,
      isOutOfStock,
      isUnavailable,
    });
  }

  return results;
}
