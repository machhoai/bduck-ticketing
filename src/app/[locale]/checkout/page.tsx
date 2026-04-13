"use client";

// Checkout page — CheckoutForm + createOrder Server Action (D7: ONLY here)
import { useEffect, useState, useActionState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useCartStore, rehydrateCart } from "@/stores/cart";
import { createOrder } from "@/actions/checkout";
import { validatePromoCode } from "@/actions/checkout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui";
import { Tag, ShieldCheck } from "lucide-react";

// ─── Validation Schema ────────────────────────────────────────────────────────

const checkoutSchema = z.object({
  customerName: z.string().min(2, "Họ tên ít nhất 2 ký tự"),
  customerEmail: z.email("Email không hợp lệ"),
  customerPhone: z.string().regex(/^(0|\+84)[0-9]{8,10}$/, "Số điện thoại không hợp lệ").optional().or(z.literal("")),
  promoCode: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

// ─── Promo Error Map ──────────────────────────────────────────────────────────
const PROMO_ERRORS: Record<string, string> = {
  "promo.empty": "Vui lòng nhập mã giảm giá",
  "promo.not_found": "Mã giảm giá không tồn tại",
  "promo.expired": "Mã giảm giá đã hết hạn",
  "promo.not_started": "Mã giảm giá chưa có hiệu lực",
  "promo.exhausted": "Mã giảm giá đã dùng hết lượt",
  "promo.user_limit": "Bạn đã dùng mã này quá số lần cho phép",
  "promo.min_order": "Đơn hàng chưa đạt giá trị tối thiểu",
};

export default function CheckoutPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const totalAmount = useCartStore((s) => s.totalAmount);
  const hasHydrated = useCartStore((s) => s._hasHydrated);
  const clearCart = useCartStore((s) => s.clearCart);

  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    rehydrateCart();
  }, []);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  // Redirect if cart is empty after hydration
  useEffect(() => {
    if (hasHydrated && items.length === 0) {
      router.replace(`/${locale}/cart`);
    }
  }, [hasHydrated, items.length, locale, router]);

  // ── Apply promo code ──
  async function handleApplyPromo() {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");

    const email = getValues("customerEmail");
    const result = await validatePromoCode(
      promoCode,
      items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      email
    );

    if (result.valid) {
      setPromoDiscount(result.discountAmount);
    } else {
      setPromoDiscount(0);
      setPromoError(PROMO_ERRORS[result.errorKey ?? ""] ?? "Mã không hợp lệ");
    }
    setPromoLoading(false);
  }

  // ── Submit checkout ──
  async function onSubmit(data: CheckoutFormData) {
    if (!hasHydrated || items.length === 0) return;
    setSubmitting(true);
    setServerError("");

    const result = await createOrder({
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone || undefined,
      promoCode: promoCode || undefined,
    });

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        "order.empty_cart": "Giỏ hàng trống",
        "order.product_not_found": "Sản phẩm không tồn tại",
        "order.product_unavailable": "Sản phẩm đã ngừng bán",
        "order.stock_exhausted": "Vé đã hết",
      };
      setServerError(errorMessages[result.errorKey] ?? "Có lỗi xảy ra. Vui lòng thử lại.");
      setSubmitting(false);
      return;
    }

    // Clear cart and redirect to payment
    clearCart();
    window.location.href = result.data.paymentUrl;
  }

  const finalAmount = totalAmount() - promoDiscount;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-8">
        💳 Thanh toán
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: form */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <h2 className="font-bold text-[#1A1A2E]">Thông tin người mua</h2>
              <Input
                id="customerName"
                label="Họ và tên"
                placeholder="Nguyễn Văn A"
                required
                error={errors.customerName?.message}
                {...register("customerName")}
              />
              <Input
                id="customerEmail"
                label="Email"
                type="email"
                placeholder="email@example.com"
                required
                hint="Vé điện tử sẽ được gửi về email này"
                error={errors.customerEmail?.message}
                {...register("customerEmail")}
              />
              <Input
                id="customerPhone"
                label="Số điện thoại"
                type="tel"
                placeholder="0912345678"
                error={errors.customerPhone?.message}
                {...register("customerPhone")}
              />
            </div>

            {/* Promo code */}
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-3">
              <h2 className="font-bold text-[#1A1A2E] flex items-center gap-2">
                <Tag className="h-4 w-4 text-[#F5C842]" /> Mã giảm giá
              </h2>
              <div className="flex gap-2">
                <input
                  id="promoCodeInput"
                  type="text"
                  value={promoCode}
                  onChange={(e) => {
                    setPromoCode(e.target.value.toUpperCase());
                    setPromoError("");
                    setPromoDiscount(0);
                  }}
                  placeholder="NHẬP MÃ"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#F5C842]/60 focus:border-[#F5C842]"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleApplyPromo}
                  loading={promoLoading}
                >
                  Áp dụng
                </Button>
              </div>
              {promoError && (
                <p className="text-xs text-red-600">{promoError}</p>
              )}
              {promoDiscount > 0 && (
                <p className="text-xs text-emerald-600 font-semibold">
                  ✓ Giảm {formatVND(promoDiscount)}
                </p>
              )}
            </div>
          </div>

          {/* Right: summary */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4 lg:sticky lg:top-24">
              <h2 className="font-bold text-[#1A1A2E]">Tóm tắt đơn hàng</h2>

              <div className="space-y-2 text-sm text-gray-600">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between">
                    <span className="line-clamp-1 flex-1 mr-2">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="flex-shrink-0 font-medium">
                      {formatVND(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {promoDiscount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Giảm giá</span>
                  <span>-{formatVND(promoDiscount)}</span>
                </div>
              )}

              <div className="border-t border-dashed border-gray-200 pt-3 flex items-center justify-between">
                <span className="font-bold text-[#1A1A2E]">Tổng thanh toán</span>
                <span className="text-xl font-extrabold text-[#1A1A2E]">
                  {formatVND(finalAmount)}
                </span>
              </div>

              {serverError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                className="w-full"
                id="submit-checkout-btn"
              >
                <ShieldCheck className="h-4 w-4" />
                {submitting ? "Đang xử lý..." : "Thanh toán ngay"}
              </Button>

              <p className="text-xs text-gray-400 text-center">
                🔒 Thanh toán được bảo mật. Giá thực tế xác nhận bởi server.
              </p>
            </div>
          </div>
        </div>
      </form>
    </main>
  );
}
