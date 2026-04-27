"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { checkCartStock, type CartStockResult } from "@/actions/cart-stock";
import type { CartItem } from "@/stores/cart";

/**
 * Hook that checks stock availability for cart items.
 *
 * Returns a map of productId → stock info so components can:
 * - Disable "+" button when `canIncrease(productId, currentQty)` is false
 * - Show OOS badge when `isOutOfStock(productId)` is true
 * - Show warning when `isUnavailable(productId)` is true
 *
 * Does NOT expose exact stock numbers to the UI.
 *
 * @param items Current cart items
 * @param trigger Boolean that triggers a fresh stock check (e.g. drawer isOpen)
 */
export function useCartStockCheck(items: CartItem[], trigger: boolean) {
  const [stockMap, setStockMap] = useState<Record<string, CartStockResult>>({});
  const [checking, setChecking] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Fetch stock info when trigger fires (drawer opens / page mounts)
  useEffect(() => {
    if (!trigger) return;
    const currentItems = itemsRef.current;
    if (currentItems.length === 0) {
      setStockMap({});
      return;
    }

    let cancelled = false;
    setChecking(true);

    checkCartStock(
      currentItems.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        dealSectionId: i.dealSectionId,
        dealItemId: i.dealItemId,
      }))
    )
      .then((results) => {
        if (cancelled) return;
        const map: Record<string, CartStockResult> = {};
        for (const r of results) map[r.productId] = r;
        setStockMap(map);
      })
      .catch((err) => {
        console.error("[useCartStockCheck] Failed:", err);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  /** Can the quantity for this product be increased by 1? */
  const canIncrease = useCallback(
    (productId: string, currentQty: number): boolean => {
      const info = stockMap[productId];
      if (!info) return true; // no stock info yet → allow (server catches at checkout)
      if (info.isOutOfStock || info.isUnavailable) return false;
      if (info.maxAllowed === null) return true; // unlimited
      return currentQty < info.maxAllowed;
    },
    [stockMap]
  );

  /** Is this product completely out of stock? */
  const isOutOfStock = useCallback(
    (productId: string): boolean => {
      return stockMap[productId]?.isOutOfStock ?? false;
    },
    [stockMap]
  );

  /** Is this product unavailable (hidden/deleted)? */
  const isUnavailable = useCallback(
    (productId: string): boolean => {
      return stockMap[productId]?.isUnavailable ?? false;
    },
    [stockMap]
  );

  /** Does any item in the cart have a stock problem? */
  const hasStockIssues = Object.values(stockMap).some(
    (info) => info.isOutOfStock || info.isUnavailable
  );

  return {
    stockMap,
    checking,
    canIncrease,
    isOutOfStock,
    isUnavailable,
    hasStockIssues,
  };
}
