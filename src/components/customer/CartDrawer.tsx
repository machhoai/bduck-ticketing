"use client";

import { useEffect } from "react";
import { X, ShoppingCart, Trash2, Plus, Minus, Gift, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCartStore, rehydrateCart } from "@/stores/cart";
import { useCartStockCheck } from "@/hooks/useCartStockCheck";
import { Button } from "@/components/ui/Button";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export function CartDrawer({ isOpen, onClose, locale }: CartDrawerProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const hasHydrated = useCartStore((s) => s._hasHydrated);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  // ── Stock check: runs when drawer opens ──
  const {
    canIncrease,
    isOutOfStock,
    isUnavailable,
    hasStockIssues,
  } = useCartStockCheck(items, isOpen && hasHydrated && items.length > 0);

  // Rehydrate cart from localStorage on mount
  useEffect(() => {
    rehydrateCart();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  function handleCheckout() {
    onClose();
    router.push(`/${locale}/checkout`);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng"
        className={`fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-[#1A1A2E]" />
            <span className="font-bold text-[#1A1A2E] text-lg">
              Giỏ hàng
            </span>
            {hasHydrated && totalItems > 0 && (
              <span className="bg-[#F5C842] text-[#1A1A2E] text-xs font-bold px-2 py-0.5 rounded-full">
                {totalItems}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Đóng giỏ hàng"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Stock warning banner */}
        {hasStockIssues && (
          <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600 font-medium">
              Một số sản phẩm đã hết hàng, vui lòng xóa để tiếp tục.
            </p>
          </div>
        )}

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!hasHydrated || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400">
              <ShoppingCart className="h-12 w-12 opacity-30" />
              <p className="text-sm">Giỏ hàng trống</p>
            </div>
          ) : (
            items.map((item) => {
              const itemOOS = isOutOfStock(item.productId) || isUnavailable(item.productId);
              const itemCanIncrease = canIncrease(item.productId, item.quantity);

              return (
                <div
                  key={item.productId + (item.dealOptionId ?? "")}
                  className={`relative flex gap-3 rounded-xl p-3 transition-all duration-300 ${
                    itemOOS
                      ? "bg-red-50/60 ring-1 ring-red-200/60"
                      : "bg-gray-50"
                  }`}
                >
                  {/* OOS overlay */}
                  {itemOOS && (
                    <div className="absolute inset-0 bg-white/50 rounded-xl z-10 flex items-center justify-center pointer-events-none">
                      <span className="px-3 py-1 rounded-full bg-red-500 text-white text-xs font-bold shadow-sm">
                        Hết hàng
                      </span>
                    </div>
                  )}

                  <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={item.thumbnailUrl}
                      alt={item.name}
                      fill
                      className={`object-cover ${itemOOS ? "opacity-40" : ""}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm line-clamp-2 ${itemOOS ? "text-gray-400" : "text-[#1A1A2E]"}`}>
                      {item.name}
                    </p>
                    <p className={`font-bold text-sm mt-1 ${itemOOS ? "text-gray-300" : "text-[#F5C842]"}`}>
                      {formatVND(item.price)}
                    </p>
                    {item.giftVoucherName && (
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200/60">
                        <Gift className="h-3 w-3" />
                        🎁 Tặng: {item.giftVoucherName}
                      </span>
                    )}
                    {/* Quantity controls */}
                    <div className="flex items-center gap-2 mt-2">
                      {itemOOS ? (
                        /* OOS: only show remove button */
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="relative z-20 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 text-red-600 text-xs font-semibold hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Xóa
                        </button>
                      ) : (
                        /* Normal: +/- controls */
                        <>
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity - 1)
                            }
                            className="w-6 h-6 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                            aria-label="Giảm số lượng"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-sm font-bold w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.productId, item.quantity + 1)
                            }
                            disabled={!itemCanIncrease}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                              itemCanIncrease
                                ? "bg-gray-200 hover:bg-gray-300"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                            }`}
                            aria-label="Tăng số lượng"
                            title={!itemCanIncrease ? "Đã đạt giới hạn" : undefined}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => removeItem(item.productId)}
                            className="ml-auto p-1 text-red-400 hover:text-red-600 transition-colors"
                            aria-label={`Xóa ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {hasHydrated && items.length > 0 && (
          <footer className="px-5 py-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Tổng cộng</span>
              <span className="text-xl font-extrabold text-[#1A1A2E]">
                {formatVND(totalAmount)}
              </span>
            </div>
            {/* D7: Only a link — createOrder lives in /checkout */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleCheckout}
              className="w-full"
              disabled={hasStockIssues}
            >
              {hasStockIssues ? "Vui lòng cập nhật giỏ hàng" : "Đặt mua ngay →"}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Giá chưa bao gồm mã giảm giá
            </p>
          </footer>
        )}
      </aside>
    </>
  );
}
