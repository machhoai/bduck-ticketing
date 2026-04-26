"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useTranslations } from "next-intl";
import { useCartStore, rehydrateCart } from "@/stores/cart";
import { createOrder, validatePromoCode, createCounterOrder, createBankTransferOrder } from "@/actions/checkout";
import { getEnabledPaymentMethodIds } from "@/actions/admin/settings";
import { useNavbar } from "@/stores/navbar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui";
import { CheckoutProgressBar } from "@/components/customer/CheckoutProgressBar";
import { PaymentMethodSelector, type PaymentMethodId } from "@/components/customer/PaymentMethodSelector";
import {
  Tag,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  CheckCircle2,
  XCircle,
  Loader2,
  Zap,
  Clock,
  Lock,
  Store,
  MonitorSmartphone,
  ChevronRight,
} from "lucide-react";

// ─── Validation Schema ────────────────────────────────────────────────────────
const checkoutSchema = z.object({
  customerName: z.string().min(2, "Họ tên ít nhất 2 ký tự"),
  customerEmail: z.email("Email không hợp lệ"),
  customerPhone: z
    .string()
    .regex(/^(0|\+84)[0-9]{8,10}$/, "Số điện thoại không hợp lệ")
    .optional()
    .or(z.literal("")),
  promoCode: z.string().optional(),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
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

// ─── Payment Methods ──────────────────────────────────────────────────────────
// NOTE: legacy type kept for submit routing; extended by PaymentMethodId in future
type PaymentMethod = "counter" | "bank_transfer" | "mock";

// ─── Test Payment Cards (mock only) ──────────────────────────────────────────
type SimulateType = "success" | "fail" | "timeout";

interface TestCard {
  id: SimulateType;
  labelKey: string;
  descKey: string;
  icon: typeof CheckCircle2;
  gradient: string;
  iconColor: string;
  borderColor: string;
}

const TEST_CARDS: TestCard[] = [
  {
    id: "success",
    labelKey: "testCardSuccess",
    descKey: "testCardSuccessDesc",
    icon: CheckCircle2,
    gradient: "from-emerald-50 to-green-50",
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-200 hover:border-emerald-400",
  },
  {
    id: "fail",
    labelKey: "testCardFail",
    descKey: "testCardFailDesc",
    icon: XCircle,
    gradient: "from-rose-50 to-red-50",
    iconColor: "text-rose-500",
    borderColor: "border-rose-200 hover:border-rose-400",
  },
  {
    id: "timeout",
    labelKey: "testCardTimeout",
    descKey: "testCardTimeoutDesc",
    icon: Clock,
    gradient: "from-amber-50 to-orange-50",
    iconColor: "text-amber-500",
    borderColor: "border-amber-200 hover:border-amber-400",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function CheckoutPage() {
  const params = useParams<{ locale: string }>();
  const locale = params.locale;
  const router = useRouter();
  const t = useTranslations("checkout");

  // ── Navbar config ──
  useNavbar({ darkText: true, shadow: false, solidBg: true });

  // ── Cart state ──
  const items = useCartStore((s) => s.items);
  const totalAmount = useCartStore((s) => s.totalAmount);
  const hasHydrated = useCartStore((s) => s._hasHydrated);
  const clearCart = useCartStore((s) => s.clearCart);

  // ── Step state ──
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  // "counter" = go-live default; "mock" = dev test simulation
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("counter");
  // Full payment method selection for UI (maps to PaymentMethod for submit routing)
  const [selectedPaymentId, setSelectedPaymentId] = useState<PaymentMethodId>("counter");
  const [selectedCard, setSelectedCard] = useState<SimulateType>("success");

  // ── Promo state ──
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  // ── Submit state ──
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  // ── Enabled payment methods (fetched from admin settings) ──
  const [enabledMethods, setEnabledMethods] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    rehydrateCart();
    // Fetch admin-configured enabled methods
    getEnabledPaymentMethodIds().then((ids) => {
      setEnabledMethods(ids);
      // Auto-select first enabled method
      if (ids.length > 0) {
        const first = ids[0] as PaymentMethodId;
        setSelectedPaymentId(first);
        if (first === "counter") setPaymentMethod("counter");
        else if (first === "bank_transfer") setPaymentMethod("bank_transfer");
        else setPaymentMethod("mock");
      }
    });
  }, []);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
  });

  // ── BFCache guard (Safari / Zalo WebView) ──────────────────────────────────
  // When user navigates to payment gateway and comes back, Safari restores the
  // checkout page from BFCache with an already-empty cart. The pageshow event
  // fires with e.persisted=true in this case. We redirect to the result page
  // using the orderId saved in sessionStorage before the navigation.
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const pendingOrderId = sessionStorage.getItem("checkout_pending_order");
        if (pendingOrderId) {
          window.location.replace(`/${locale}/checkout/result?orderId=${pendingOrderId}`);
        }
      }
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [locale]);

  // Redirect to cart if empty — but skip if a payment is in-flight
  useEffect(() => {
    const pendingOrderId = sessionStorage.getItem("checkout_pending_order");
    if (hasHydrated && items.length === 0 && !pendingOrderId) {
      router.replace(`/${locale}/cart`);
    }
  }, [hasHydrated, items.length, locale, router]);

  // ── Apply promo code ──
  const handleApplyPromo = useCallback(async () => {
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
  }, [promoCode, items, getValues]);

  // ── Step 1 → Step 2 with validation gate ──
  const handleContinueToPayment = useCallback(async () => {
    // trigger() validates all fields defined in the schema
    const isValid = await trigger(["customerName", "customerEmail", "customerPhone"]);
    if (isValid) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [trigger]);

  // ── Submit: Counter Payment ──────────────────────────────────────────────────
  const onSubmitCounter = useCallback(async () => {
    if (!hasHydrated || items.length === 0 || submitting) return;
    setSubmitting(true);
    setServerError("");

    const data = getValues();

    const result = await createCounterOrder({
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        dealSectionId: i.dealSectionId,
        dealItemId: i.dealItemId,
      })),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone || undefined,
      promoCode: promoCode || undefined,
    });

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        "order.empty_cart": "Giỏ hàng trống",
        "order.product_not_found": "Sản phẩm không tồn tại",
        "order.product_unavailable": "Sản phẩm đã ngưng bán",
        "order.stock_exhausted": "Vé đã hết",
        "order.code_generation_failed": "Không thể tạo mã, vui lòng thử lại",
        "deal.not_open_yet": "Deal chưa mở bán",
        "deal.stock_exhausted": "Deal đã hết hàng",
        "deal.max_qty_exceeded": "Vượt quá số lượng tối đa",
        "deal.section_max_items": "Vượt giới hạn deal/đơn",
      };
      setServerError(errorMessages[result.errorKey] ?? result.message ?? "Có lỗi xảy ra. Vui lòng thử lại.");
      setSubmitting(false);
      return;
    }

    // Mark payment as in-flight BEFORE clearing cart — prevents BFCache
    // from triggering the cart-empty guard on Safari/Zalo WebView
    sessionStorage.setItem("checkout_pending_order", result.data.orderId);
    clearCart();
    window.location.href = `/${locale}/checkout/result?orderId=${result.data.orderId}`;
  }, [hasHydrated, items, submitting, getValues, promoCode, clearCart, locale]);

  // ── Submit: Bank Transfer ─────────────────────────────────────────────────────
  const onSubmitBankTransfer = useCallback(async () => {
    if (!hasHydrated || items.length === 0 || submitting) return;
    setSubmitting(true);
    setServerError("");

    const data = getValues();

    const result = await createBankTransferOrder({
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        dealSectionId: i.dealSectionId,
        dealItemId: i.dealItemId,
      })),
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone || undefined,
      promoCode: promoCode || undefined,
    });

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        "order.empty_cart": "Giỏ hàng trống",
        "order.product_not_found": "Sản phẩm không tồn tại",
        "order.product_unavailable": "Sản phẩm đã ngưng bán",
        "order.stock_exhausted": "Vé đã hết",
        "order.creation_failed": "Không thể tạo đơn, vui lòng thử lại",
        "deal.not_open_yet": "Deal chưa mở bán",
        "deal.stock_exhausted": "Deal đã hết hàng",
        "deal.max_qty_exceeded": "Vượt quá số lượng tối đa",
        "deal.section_max_items": "Vượt giới hạn deal/đơn",
      };
      setServerError(errorMessages[result.errorKey] ?? result.message ?? "Có lỗi xảy ra. Vui lòng thử lại.");
      setSubmitting(false);
      return;
    }

    sessionStorage.setItem("checkout_pending_order", result.data.orderId);
    clearCart();
    window.location.href = `/${locale}/checkout/result?orderId=${result.data.orderId}`;
  }, [hasHydrated, items, submitting, getValues, promoCode, clearCart, locale]);
  // ── Submit: Mock payment (dev) ────────────────────────────────────────────────
  const onSubmitMock = useCallback(async () => {
    if (!hasHydrated || items.length === 0 || submitting) return;
    setSubmitting(true);
    setServerError("");

    const data = getValues();

    const result = await createOrder({
      items: items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        dealSectionId: i.dealSectionId,
        dealItemId: i.dealItemId,
      })),
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
        "deal.not_open_yet": "Deal chưa mở bán",
        "deal.stock_exhausted": "Deal đã hết hàng",
        "deal.max_qty_exceeded": "Vượt quá số lượng tối đa",
        "deal.section_max_items": "Vượt giới hạn deal/đơn",
      };
      setServerError(
        errorMessages[result.errorKey] ?? result.message ?? "Có lỗi xảy ra. Vui lòng thử lại."
      );
      setSubmitting(false);
      return;
    }

    // Mark payment as in-flight BEFORE clearing cart — prevents BFCache
    // from triggering the cart-empty guard on Safari/Zalo WebView
    sessionStorage.setItem("checkout_pending_order", result.data.orderId);
    clearCart();

    if (selectedCard === "timeout") {
      window.location.href = `/${locale}/checkout/result?orderId=${result.data.orderId}`;
    } else {
      const paymentUrl = result.data.paymentUrl.replace(
        "simulate=success",
        `simulate=${selectedCard}`
      );
      window.location.href = paymentUrl;
    }
  }, [
    hasHydrated,
    items,
    submitting,
    getValues,
    promoCode,
    clearCart,
    selectedCard,
    locale,
  ]);

  const finalAmount = totalAmount() - promoDiscount;

  return (
    <>
      {/* ── Full-screen processing overlay (anti-double-submit) ──────── */}
      {submitting && (
        <div className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F5C842] to-[#E5B832] flex items-center justify-center shadow-xl shadow-[#F5C842]/30 animate-pulse">
              <Loader2 className="h-8 w-8 text-[#1A1A2E] animate-spin" />
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-[#F5C842]/30 animate-ping" />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#1A1A2E]">{t("processing")}</p>
            <p className="text-sm text-gray-500 mt-1">{t("processingSubtext")}</p>
          </div>
        </div>
      )}

      {/* ── Decorative Background ──────────────────────────────────────── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-yellow-100/40 via-orange-50/30 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-50/40 via-purple-50/20 to-transparent blur-3xl" />
      </div>

      <main className="min-h-screen pt-[100px] pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* ── Progress Bar ──────────────────────────────────────────── */}
          <div className="mb-10 animate-[fadeIn_0.4s_ease-out]">
            <CheckoutProgressBar
              currentStep={currentStep}
              labels={[t("step1"), t("step2"), t("step3")]}
            />
          </div>

          <form
            onSubmit={handleSubmit(() => {})}
            noValidate
            className="animate-[fadeSlideUp_0.5s_ease-out]"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* ═══════════════════════════════════════════════════════ */}
              {/* LEFT COLUMN: Step content                              */}
              {/* ═══════════════════════════════════════════════════════ */}
              <div className="lg:col-span-7 space-y-6">
                {/* ── STEP 1: Customer Info ──────────────────────────── */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-[fadeSlideUp_0.4s_ease-out]">
                    {/* Buyer info card */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] p-6 space-y-5">
                      <h2 className="text-lg font-bold text-[#1A1A2E] flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#F5C842]/15 flex items-center justify-center">
                          <ShieldCheck className="h-4 w-4 text-[#E5B832]" />
                        </div>
                        {t("buyerInfo")}
                      </h2>

                      <Input
                        id="customerName"
                        label={t("nameLabel")}
                        placeholder={t("namePlaceholder")}
                        required
                        error={errors.customerName?.message}
                        {...register("customerName")}
                      />
                      <Input
                        id="customerEmail"
                        label={t("emailLabel")}
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        required
                        hint={t("emailHint")}
                        error={errors.customerEmail?.message}
                        {...register("customerEmail")}
                      />
                      <Input
                        id="customerPhone"
                        label={t("phoneLabel")}
                        type="tel"
                        placeholder={t("phonePlaceholder")}
                        error={errors.customerPhone?.message}
                        {...register("customerPhone")}
                      />
                    </div>

                    {/* Promo code card */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] p-6 space-y-4">
                      <h2 className="font-bold text-[#1A1A2E] flex items-center gap-2 text-sm">
                        <Tag className="h-4 w-4 text-[#F5C842]" />
                        {t("promoTitle")}
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
                          placeholder={t("promoPlaceholder")}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#F5C842]/60 focus:border-[#F5C842] bg-gray-50/50 transition-all"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleApplyPromo}
                          loading={promoLoading}
                        >
                          {t("promoApply")}
                        </Button>
                      </div>
                      {promoError && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                          <XCircle className="h-3 w-3" /> {promoError}
                        </p>
                      )}
                      {promoDiscount > 0 && (
                        <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("promoSuccess", { amount: formatVND(promoDiscount) })}
                        </p>
                      )}
                    </div>

                    {/* Continue button */}
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={handleContinueToPayment}
                      id="continue-to-payment-btn"
                    >
                      {t("continueToPayment")}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* ── STEP 2: Payment Method ────────────────────────── */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-[fadeSlideUp_0.4s_ease-out]">
                    {/* Back link */}
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      {t("backToInfo")}
                    </button>

                    {/* Payment method selection */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] p-6 space-y-4">
                      <h2 className="text-lg font-bold text-[#1A1A2E] flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#F5C842]/15 flex items-center justify-center">
                          <CreditCard className="h-4 w-4 text-[#E5B832]" />
                        </div>
                        {t("paymentMethod")}
                      </h2>

                      <PaymentMethodSelector
                        selected={selectedPaymentId}
                        onChange={(id) => {
                          setSelectedPaymentId(id);
                          // Route to submit handler based on payment method selection
                          if (id === "counter") setPaymentMethod("counter");
                          else if (id === "bank_transfer") setPaymentMethod("bank_transfer");
                          else setPaymentMethod("mock");
                        }}
                        disabled={submitting}
                        enabledMethods={enabledMethods}
                      />
                    </div>

                    {/* ── Submit Button ── */}
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={
                        paymentMethod === "counter"
                          ? onSubmitCounter
                          : paymentMethod === "bank_transfer"
                            ? onSubmitBankTransfer
                            : onSubmitMock
                      }
                      disabled={submitting}
                      loading={submitting}
                      id="submit-checkout-btn"
                    >
                      {paymentMethod === "counter" ? (
                        <>
                          <Store className="h-4 w-4" />
                          {submitting ? t("processing") : t("counterSubmitBtn")}
                          {!submitting && <ChevronRight className="h-4 w-4" />}
                        </>
                      ) : paymentMethod === "bank_transfer" ? (
                        <>
                          <CreditCard className="h-4 w-4" />
                          {submitting ? t("processing") : t("bankTransferSubmitBtn")}
                          {!submitting && <ChevronRight className="h-4 w-4" />}
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          {submitting ? t("processing") : t("payNow")}
                        </>
                      )}
                    </Button>

                    {serverError && (
                      <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 flex items-center gap-2">
                        <XCircle className="h-4 w-4 flex-shrink-0" />
                        {serverError}
                      </p>
                    )}

                    <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                      <Lock className="h-3 w-3" />
                      {t("securePayment")}
                    </p>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════ */}
              {/* RIGHT COLUMN: Order summary (always visible)          */}
              {/* ═══════════════════════════════════════════════════════ */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] p-6 space-y-5 lg:sticky lg:top-[100px]">
                  <h2 className="font-bold text-[#1A1A2E] text-sm uppercase tracking-wider">
                    {t("orderSummary")}
                  </h2>

                  {/* Items */}
                  <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                    {items.map((item) => (
                      <div
                        key={item.productId}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50/80"
                      >
                        {item.thumbnailUrl && (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1A1A2E] line-clamp-1">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            × {item.quantity}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-[#1A1A2E] flex-shrink-0">
                          {formatVND(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-gray-200" />

                  {/* Discount */}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600">{t("discount")}</span>
                      <span className="text-emerald-600 font-semibold">
                        -{formatVND(promoDiscount)}
                      </span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1A1A2E] text-sm">
                      {t("totalPayment")}
                    </span>
                    <span className="text-2xl font-black text-[#1A1A2E]">
                      {formatVND(finalAmount)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* ── Animations ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
