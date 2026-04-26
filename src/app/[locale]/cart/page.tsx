"use client";

// Cart page — READ ONLY + modify quantities (D7)
// "Đặt mua" button navigates to /checkout — no createOrder here
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useNavbar } from "@/stores/navbar";
import {
    Trash2,
    Plus,
    Minus,
    ShoppingCart,
    ArrowRight,
    ArrowLeft,
    Sparkles,
    Tag,
    ShieldCheck,
    Package,
    Gift,
} from "lucide-react";
import { useCartStore, rehydrateCart } from "@/stores/cart";
import { Button } from "@/components/ui/Button";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
}

export default function CartPage() {
    // Configure navbar for this page (light bg → dark text)
    useNavbar({ darkText: true, shadow: false, solidBg: false });

    const params = useParams<{ locale: string }>();
    const locale = params.locale;
    const router = useRouter();
    const t = useTranslations("cart");

    const items = useCartStore((s) => s.items);
    const totalItems = useCartStore((s) => s.totalItems);
    const totalAmount = useCartStore((s) => s.totalAmount);
    const removeItem = useCartStore((s) => s.removeItem);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const hasHydrated = useCartStore((s) => s._hasHydrated);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        rehydrateCart();
        // Slight delay to trigger CSS animations after paint
        const timer = setTimeout(() => setMounted(true), 50);
        return () => clearTimeout(timer);
    }, []);

    const isEmpty = !hasHydrated || items.length === 0;

    return (
        <main className="min-h-screen bg-gradient-to-b from-pastel-yellow/40 via-white to-white pt-28 pb-20">
            {/* ── Decorative blobs ──────────────────────────────── */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10" aria-hidden="true">
                <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-duck-yellow/10 blur-3xl animate-blob" />
                <div className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-duck-orange/8 blur-3xl animate-blob-delayed" />
                <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-pastel-blue/30 blur-3xl animate-blob-slow" />
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* ── Breadcrumb ──────────────────────────────────── */}
                <nav className="flex items-center gap-2 text-sm text-text-muted mb-6" aria-label="Breadcrumb">
                    <Link
                        href={`/${locale}`}
                        className="hover:text-text-primary transition-colors flex items-center gap-1"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        {t("backToShop")}
                    </Link>
                    <span>/</span>
                    <span className="text-text-primary font-semibold">{t("title")}</span>
                </nav>

                {/* ── Page header ─────────────────────────────────── */}
                <div className={cn(
                    "flex items-center gap-4 mb-10 transition-all duration-700",
                    mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}>
                    <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-duck-yellow to-duck-orange flex items-center justify-center shadow-yellow">
                            <ShoppingCart className="h-6 w-6 text-white" />
                        </div>
                        {!isEmpty && (
                            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-text-primary text-white text-xs font-bold flex items-center justify-center shadow-lg">
                                {totalItems()}
                            </span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                            {t("title")}
                        </h1>
                        <p className="text-sm text-text-muted mt-0.5">
                            {isEmpty ? t("emptySubtitle") : t("subtitle", { count: totalItems() })}
                        </p>
                    </div>
                </div>

                {isEmpty ? (
                    /* ── Empty state ──────────────────────────────── */
                    <div className={cn(
                        "flex flex-col items-center justify-center py-20 gap-6 transition-all duration-700 delay-200",
                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    )}>
                        <div className="relative">
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pastel-yellow to-duck-yellow-light flex items-center justify-center">
                                <ShoppingCart className="h-14 w-14 text-duck-yellow opacity-60" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-pastel-blue flex items-center justify-center animate-float">
                                <Sparkles className="h-5 w-5 text-duck-orange" />
                            </div>
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-lg font-bold text-text-primary">{t("emptyTitle")}</p>
                            <p className="text-sm text-text-muted max-w-xs">
                                {t("emptyDescription")}
                            </p>
                        </div>
                        <Link href={`/${locale}/tickets`}>
                            <Button variant="primary" size="lg" className="btn-bounce shadow-yellow">
                                <Sparkles className="h-4 w-4" />
                                {t("shopNow")}
                            </Button>
                        </Link>
                    </div>
                ) : (
                    /* ── Cart content ─────────────────────────────── */
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* ── Items list ──────────────────────────────── */}
                        <div className="lg:col-span-2 space-y-4">
                            {items.map((item, idx) => (
                                <div
                                    key={item.productId}
                                    className={cn(
                                        "group relative flex gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-border-light/60 shadow-card hover:shadow-card-hover transition-all duration-500",
                                        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                                    )}
                                    style={{ transitionDelay: `${150 + idx * 80}ms` }}
                                >
                                    {/* Thumbnail */}
                                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border-light/50">
                                        <Image
                                            src={item.thumbnailUrl}
                                            alt={item.name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        {/* Type badge */}
                                        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/90 backdrop-blur-sm text-text-primary shadow-sm">
                                            {item.type === "combo" ? "Combo" : "Vé"}
                                        </span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-start justify-between gap-2">
                                                <h2 className="font-bold text-text-primary text-sm sm:text-base line-clamp-2 leading-snug">
                                                    {item.name}
                                                </h2>
                                                <button
                                                    onClick={() => removeItem(item.productId)}
                                                    className="flex-shrink-0 p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                                                    aria-label={`Xóa ${item.name}`}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>

                                            {/* Price */}
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="font-extrabold text-text-primary text-sm sm:text-base">
                                                    {formatVND(item.price)}
                                                </span>
                                                {item.originalPrice !== item.price && (
                                                    <span className="text-xs text-text-muted line-through">
                                                        {formatVND(item.originalPrice)}
                                                    </span>
                                                )}
                                                {item.originalPrice !== item.price && (
                                                    <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                                                        -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                                                    </span>
                                                )}
                                            </div>

                                            {/* Gift voucher badge */}
                                            {item.giftVoucherName && (
                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold ring-1 ring-emerald-200/60">
                                                        <Gift className="h-3 w-3" />
                                                        🎁 Tặng: {item.giftVoucherName}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quantity controls */}
                                        <div className="flex items-center justify-between mt-3">
                                            <div className="flex items-center gap-0">
                                                <button
                                                    onClick={() =>
                                                        updateQuantity(item.productId, item.quantity - 1)
                                                    }
                                                    className="w-8 h-8 rounded-l-xl border border-border-light bg-surface-100 hover:bg-surface-200 flex items-center justify-center transition-colors"
                                                    aria-label="Giảm"
                                                >
                                                    <Minus className="h-3.5 w-3.5 text-text-secondary" />
                                                </button>
                                                <span className="w-10 h-8 border-y border-border-light bg-white text-sm font-bold text-text-primary flex items-center justify-center">
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() =>
                                                        updateQuantity(item.productId, item.quantity + 1)
                                                    }
                                                    className="w-8 h-8 rounded-r-xl border border-border-light bg-surface-100 hover:bg-surface-200 flex items-center justify-center transition-colors"
                                                    aria-label="Tăng"
                                                >
                                                    <Plus className="h-3.5 w-3.5 text-text-secondary" />
                                                </button>
                                            </div>
                                            <span className="text-sm font-bold text-duck-orange">
                                                {formatVND(item.price * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* ── Order summary ────────────────────────────── */}
                        <div className={cn(
                            "lg:sticky lg:top-24 h-fit transition-all duration-700",
                            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                        )} style={{ transitionDelay: "300ms" }}>
                            <div className="bg-white rounded-3xl border border-border-light/60 shadow-card overflow-hidden">
                                {/* Gradient header */}
                                <div className="bg-gradient-to-r from-duck-yellow/20 via-duck-orange/10 to-pastel-yellow/30 px-6 py-4">
                                    <h2 className="font-bold text-text-primary text-lg flex items-center gap-2">
                                        <Package className="h-5 w-5 text-duck-orange" />
                                        {t("orderSummary")}
                                    </h2>
                                </div>

                                <div className="px-6 py-5 space-y-4">
                                    {/* Item breakdown */}
                                    <div className="space-y-2.5">
                                        {items.map((item) => (
                                            <div key={item.productId} className="flex justify-between items-center text-sm">
                                                <span className="text-text-secondary truncate max-w-[60%]">
                                                    {item.name} × {item.quantity}
                                                </span>
                                                <span className="text-text-primary font-semibold">
                                                    {formatVND(item.price * item.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-t border-dashed border-border-light" />

                                    {/* Subtotals */}
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-text-secondary">
                                                {t("subtotal")} ({totalItems()} {t("items")})
                                            </span>
                                            <span className="font-semibold">{formatVND(totalAmount())}</span>
                                        </div>
                                        <div className="flex justify-between text-text-muted">
                                            <span>{t("processingFee")}</span>
                                            <span className="text-green-500 font-medium">{t("free")}</span>
                                        </div>
                                    </div>

                                    <div className="border-t border-border-light pt-4">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-text-primary text-base">
                                                {t("total")}
                                            </span>
                                            <span className="text-2xl font-extrabold text-gradient-yellow">
                                                {formatVND(totalAmount())}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Trust badges */}
                                    <div className="flex items-center gap-3 bg-surface-100 rounded-xl px-4 py-3">
                                        <ShieldCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        <p className="text-xs text-text-muted leading-relaxed">
                                            {t("trustBadge")}
                                        </p>
                                    </div>

                                    {/* Coupon hint */}
                                    <div className="flex items-center gap-2 text-xs text-text-muted">
                                        <Tag className="h-3.5 w-3.5" />
                                        <span>{t("couponHint")}</span>
                                    </div>

                                    {/* CTA */}
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        onClick={() => router.push(`/${locale}/checkout`)}
                                        className="w-full btn-bounce shadow-yellow text-base"
                                        id="proceed-to-checkout-btn"
                                    >
                                        {t("checkout")}
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>

                                    <Link
                                        href={`/${locale}/tickets`}
                                        className="flex items-center justify-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
                                    >
                                        <ArrowLeft className="h-3.5 w-3.5" />
                                        {t("continueShopping")}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
