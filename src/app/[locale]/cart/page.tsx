"use client";

// Cart page — READ ONLY + modify quantities (D7)
// "Đặt mua" button navigates to /checkout — no createOrder here
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight } from "lucide-react";
import { useCartStore, rehydrateCart } from "@/stores/cart";
import { Button } from "@/components/ui/Button";

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export default function CartPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const totalItems = useCartStore((s) => s.totalItems);
  const totalAmount = useCartStore((s) => s.totalAmount);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const hasHydrated = useCartStore((s) => s._hasHydrated);

  useEffect(() => {
    rehydrateCart();
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-8">
        🛒 Giỏ hàng của bạn
      </h1>

      {!hasHydrated || items.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
          <ShoppingCart className="h-16 w-16 opacity-20" />
          <p>Giỏ hàng trống</p>
          <Link href={`/${locale}`}>
            <Button variant="primary">Mua vé ngay</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Items list */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex gap-4 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
              >
                <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                  <Image
                    src={item.thumbnailUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold text-[#1A1A2E] text-sm line-clamp-2">
                      {item.name}
                    </h2>
                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
                      aria-label={`Xóa ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#1A1A2E]">
                      {formatVND(item.price)}
                    </span>
                    {item.originalPrice !== item.price && (
                      <span className="text-xs text-gray-400 line-through">
                        {formatVND(item.originalPrice)}
                      </span>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity - 1)
                      }
                      className="w-7 h-7 rounded-full border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition-colors"
                      aria-label="Giảm"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="font-bold text-sm w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1)
                      }
                      className="w-7 h-7 rounded-full border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition-colors"
                      aria-label="Tăng"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs text-gray-400 ml-auto">
                      = {formatVND(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order summary sticky */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-[#1A1A2E]">Tóm tắt đơn hàng</h2>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>{totalItems()} sản phẩm</span>
                  <span>{formatVND(totalAmount())}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Phí thanh toán</span>
                  <span>Miễn phí</span>
                </div>
              </div>

              <div className="border-t border-dashed border-gray-200 pt-3 flex items-center justify-between">
                <span className="font-bold text-[#1A1A2E]">Tổng cộng</span>
                <span className="text-xl font-extrabold text-[#1A1A2E]">
                  {formatVND(totalAmount())}
                </span>
              </div>

              <p className="text-xs text-gray-400">
                * Giá trên chưa bao gồm mã giảm giá. Nhập mã ở bước thanh toán.
              </p>

              {/* D7: Navigate only — createOrder is in /checkout */}
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push(`/${locale}/checkout`)}
                className="w-full"
                id="proceed-to-checkout-btn"
              >
                Tiếp tục thanh toán <ArrowRight className="h-4 w-4" />
              </Button>

              <Link
                href={`/${locale}`}
                className="block text-center text-sm text-gray-400 hover:text-[#1A1A2E] transition-colors"
              >
                ← Tiếp tục mua vé
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
