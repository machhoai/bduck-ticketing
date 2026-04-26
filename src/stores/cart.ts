import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ClientProduct } from "@/lib/serializeProduct";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * CartItem stores price for DISPLAY PURPOSES ONLY.
 * Server Action createOrder() re-fetches all prices from Firestore (D5).
 * Never trust client-side pricing for actual charge calculation.
 */
export interface CartItem {
  productId: string;
  name: string;
  thumbnailUrl: string;
  /** Effective price (flash sale aware) — DISPLAY ONLY */
  price: number;
  /** Original price before flash sale — DISPLAY ONLY */
  originalPrice: number;
  quantity: number;
  type: "ticket" | "combo" | "membership";
  /** Deal section info — set when item was added from a deal card */
  dealSectionId?: string;
  dealItemId?: string;
  /** Gift voucher display name — shown as a badge in the cart */
  giftVoucherName?: string;
}

interface CartStore {
  items: CartItem[];
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;

  // Mutations
  addItem: (product: ClientProduct) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;

  // Derived (computed inline — Zustand doesn't support computed properties)
  totalItems: () => number;
  totalAmount: () => number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      addItem: (product) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === product.id
          );

          const effectivePrice = product.flashSale
            ? (() => {
                const now = Date.now();
                return now >= product.flashSale!.startAtMs && now <= product.flashSale!.endAtMs
                  ? product.flashSale!.salePrice
                  : product.price;
              })()
            : product.price;

          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === product.id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }

          return {
            items: [
              ...state.items,
              {
                productId: product.id,
                name: product.name,
                thumbnailUrl: product.thumbnailUrl,
                price: effectivePrice,
                originalPrice: product.price,
                quantity: 1,
                type: product.type,
                dealSectionId: product.dealSectionId,
                dealItemId: product.dealItemId,
                giftVoucherName: product.giftVoucherName,
              },
            ],
          };
        });
      },

      removeItem: (productId) =>
        set((state) => ({
          items: state.items.filter((i) => i.productId !== productId),
        })),

      updateQuantity: (productId, quantity) => {
        if (quantity < 1) {
          get().removeItem(productId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity } : i
          ),
        }));
      },

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalAmount: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "bduck-cart",
      storage: createJSONStorage(() => localStorage),
      // skipHydration prevents SSR mismatch — call rehydrate() in a useEffect
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// ─── Hydration Hook ───────────────────────────────────────────────────────────
/**
 * Call this in a top-level Client Component useEffect to rehydrate the store.
 * Prevents Next.js SSR hydration mismatch.
 *
 * @example
 * useEffect(() => { useCartStore.persist.rehydrate(); }, []);
 */
export function rehydrateCart() {
  useCartStore.persist.rehydrate();
}
