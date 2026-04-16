import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductById } from "@/actions/products";
import { serializeProduct } from "@/lib/serializeProduct";
import { AddToCartButton } from "@/components/customer/AddToCartButton";
import { ProductDetailClient } from "@/components/customer/ProductDetailClient";
import { Badge } from "@/components/ui";
import {
    Calendar,
    Clock,
    Package,
    CheckCircle,
    Shield,
    Mail,
    QrCode,
    ChevronRight,
    Sparkles,
    ArrowLeft,
} from "lucide-react";
import type { Metadata } from "next";
import { useNavbar } from "@/stores/navbar";

interface PageProps {
    params: Promise<{ locale: string; productId: string }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { productId } = await params;
    const product = await getProductById(productId);
    if (!product) return { title: "Không tìm thấy sản phẩm" };
    return {
        title: `${product.name} — B.Duck Cityfuns`,
        description: product.description,
        openGraph: {
            images: [product.thumbnailUrl],
        },
    };
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

export default async function ProductDetailPage({ params }: PageProps) {
    const { locale, productId } = await params;
    setRequestLocale(locale);

    const product = await getProductById(productId);
    if (!product || product.status === "hidden") notFound();

    const clientProduct = serializeProduct(product);

    const isSoldOut = product.status === "sold-out";
    const isCombo = product.type === "combo";

    // Effective price
    let effectivePrice = product.price;
    let isOnSale = false;
    if (product.flashSale) {
        const now = Date.now();
        if (
            now >= product.flashSale.startAt.toMillis() &&
            now <= product.flashSale.endAt.toMillis()
        ) {
            effectivePrice = product.flashSale.salePrice;
            isOnSale = true;
        }
    }

    // Discount percentage
    const discountPercent = isOnSale
        ? Math.round(((product.price - effectivePrice) / product.price) * 100)
        : 0;

    // Validity label
    const v = product.validityConfig;
    let validityLabel = "";
    let validityIcon: "calendar" | "clock" | "check" = "check";

    if (v.type === "date-specific") {
        validityLabel = locale === "en" ? "Date-specific ticket" : "Vé ngày cụ thể";
        validityIcon = "calendar";
    } else if (v.type === "date-range") {
        validityLabel =
            locale === "en"
                ? `Valid for ${v.validDaysFromPurchase} days from purchase`
                : `Có giá trị ${v.validDaysFromPurchase} ngày kể từ ngày mua`;
        validityIcon = "clock";
    } else {
        validityLabel = locale === "en" ? "No date limit" : "Không giới hạn ngày";
        validityIcon = "check";
    }

    const remaining =
        product.totalStock !== undefined
            ? Math.max(0, product.totalStock - product.soldCount)
            : null;

    const i18n = {
        backToTickets: locale === "en" ? "All tickets" : "Tất cả vé",
        comboIncludes: locale === "en" ? "This combo includes" : "Combo bao gồm",
        addToCart: locale === "en" ? "Add to Cart" : "Thêm vào giỏ",
        soldOut: locale === "en" ? "Sold Out" : "Hết vé",
        trustPayment: locale === "en" ? "Secure Payment" : "Thanh toán an toàn",
        trustEmail: locale === "en" ? "E-ticket via Email" : "Vé qua email",
        trustQR: locale === "en" ? "Instant QR Code" : "QR Code tức thì",
        ticketsLeft:
            locale === "en" ? `${remaining} tickets left` : `Còn ${remaining} vé`,
        flashSale: "Flash Sale",
        combo: "Combo",
        off: locale === "en" ? "OFF" : "GIẢM",
        perTicket: locale === "en" ? "/ ticket" : "/ vé",
    };

    return (
        <ProductDetailClient>
            {/* ── Decorative Background ──────────────────────────────────────── */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-yellow-100/60 via-orange-50/40 to-transparent blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-50/50 via-purple-50/30 to-transparent blur-3xl" />
            </div>

            {/* ── Main Content ───────────────────────────────────────────────── */}
            <main className="min-h-screen pt-[100px] pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">

                    {/* ── Breadcrumb ──────────────────────────────────────────────── */}
                    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8 animate-[fadeIn_0.5s_ease-out]">
                        <Link
                            href={`/${locale}`}
                            className="hover:text-gray-600 transition-colors"
                        >
                            {locale === "en" ? "Home" : "Trang chủ"}
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5" />
                        <Link
                            href={`/${locale}/tickets`}
                            className="hover:text-gray-600 transition-colors"
                        >
                            {i18n.backToTickets}
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span className="text-gray-700 font-medium truncate max-w-[200px]">
                            {product.name}
                        </span>
                    </nav>

                    {/* ── Two-Column Layout ───────────────────────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">

                        {/* ═══════════════════════════════════════════════════════════ */}
                        {/* LEFT: Image Gallery                                        */}
                        {/* ═══════════════════════════════════════════════════════════ */}
                        <div className="lg:col-span-7 space-y-4 animate-[fadeSlideUp_0.6s_ease-out]">
                            {/* Hero Image */}
                            <div className="relative group">
                                <div className="relative aspect-[4/3] rounded-3xl overflow-hidden bg-gray-100 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)]">
                                    <Image
                                        src={product.thumbnailUrl}
                                        alt={product.name}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        priority
                                        sizes="(max-width: 768px) 100vw, 58vw"
                                    />
                                    {/* Gradient overlay at bottom for badges */}
                                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
                                </div>

                                {/* Floating Badges */}
                                <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
                                    {isCombo && (
                                        <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-orange-200/50 backdrop-blur-sm">
                                            🎁 {i18n.combo}
                                        </span>
                                    )}
                                    {isOnSale && (
                                        <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-pink-200/50 animate-pulse">
                                            ⚡ {i18n.flashSale}
                                        </span>
                                    )}
                                    {isSoldOut && (
                                        <span className="px-3.5 py-1.5 rounded-full bg-gray-800/80 text-white text-xs font-bold tracking-wide backdrop-blur-sm">
                                            {i18n.soldOut}
                                        </span>
                                    )}
                                </div>

                                {/* Discount badge */}
                                {isOnSale && discountPercent > 0 && (
                                    <div className="absolute top-4 right-4 w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex flex-col items-center justify-center shadow-lg shadow-pink-200/50 rotate-3">
                                        <span className="text-lg font-black leading-none">
                                            -{discountPercent}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Gallery Thumbnails */}
                            {product.gallery && product.gallery.length > 0 && (
                                <div className="grid grid-cols-4 gap-3">
                                    {product.gallery.slice(0, 4).map((url, i) => (
                                        <div
                                            key={i}
                                            className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer group/thumb shadow-sm hover:shadow-md transition-all duration-300"
                                        >
                                            <Image
                                                src={url}
                                                alt={`${product.name} #${i + 2}`}
                                                fill
                                                className="object-cover transition-transform duration-500 group-hover/thumb:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors duration-300 rounded-2xl" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ═══════════════════════════════════════════════════════════ */}
                        {/* RIGHT: Product Info (sticky)                               */}
                        {/* ═══════════════════════════════════════════════════════════ */}
                        <div className="lg:col-span-5 lg:sticky lg:top-[80px] space-y-6 animate-[fadeSlideUp_0.6s_ease-out_0.15s_both]">

                            {/* Title + Description */}
                            <div className="space-y-3">
                                <h1 className="text-3xl lg:text-4xl font-extrabold text-[#1A1A2E] leading-[1.2] tracking-tight">
                                    {product.name}
                                </h1>
                                <p className="text-gray-500 leading-relaxed text-[15px]">
                                    {product.description}
                                </p>
                            </div>

                            {/* ── Price Block ──────────────────────────────────────────── */}
                            <div className="bg-gradient-to-br from-white to-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-3">
                                <div className="flex items-end gap-3">
                                    <span className="text-4xl font-black text-[#1A1A2E] tracking-tight">
                                        {formatVND(effectivePrice)}
                                    </span>
                                    {isOnSale && (
                                        <span className="text-lg text-gray-400 line-through pb-1">
                                            {formatVND(product.price)}
                                        </span>
                                    )}
                                </div>
                                {isOnSale && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {locale === "en" ? "You save" : "Bạn tiết kiệm"}{" "}
                                        {formatVND(product.price - effectivePrice)}
                                    </div>
                                )}
                            </div>

                            {/* ── Info Pills ────────────────────────────────────────────── */}
                            <div className="space-y-3">
                                {/* Validity */}
                                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm">
                                    <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                        {validityIcon === "calendar" && (
                                            <Calendar className="h-4.5 w-4.5 text-amber-600" />
                                        )}
                                        {validityIcon === "clock" && (
                                            <Clock className="h-4.5 w-4.5 text-amber-600" />
                                        )}
                                        {validityIcon === "check" && (
                                            <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                                        )}
                                    </div>
                                    <span className="text-sm text-gray-700 font-medium">
                                        {validityLabel}
                                    </span>
                                </div>

                                {/* Stock */}
                                {remaining !== null && (
                                    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-gray-100 shadow-sm">
                                        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <Package className="h-4.5 w-4.5 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-sm text-gray-700 font-medium">
                                                {i18n.ticketsLeft}
                                            </span>
                                        </div>
                                        {remaining <= 10 && remaining > 0 && (
                                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-bold animate-pulse">
                                                {locale === "en" ? "Low stock" : "Sắp hết"}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Combo Items ───────────────────────────────────────────── */}
                            {isCombo &&
                                product.comboItems &&
                                product.comboItems.length > 0 && (
                                    <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/40 p-5 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base">🎁</span>
                                            <span className="font-bold text-amber-900 text-sm">
                                                {i18n.comboIncludes}
                                            </span>
                                        </div>
                                        <ul className="space-y-2">
                                            {product.comboItems.map((item, i) => (
                                                <li
                                                    key={i}
                                                    className="flex items-center gap-3 text-sm text-amber-800"
                                                >
                                                    <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/70 border border-amber-200/50 flex items-center justify-center text-xs font-bold text-amber-700">
                                                        {item.quantity}×
                                                    </span>
                                                    <span className="font-medium">{item.productName}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                            {/* ── CTA ──────────────────────────────────────────────────── */}
                            <div className="space-y-3 pt-1">
                                <AddToCartButton product={clientProduct} disabled={isSoldOut} />
                                <Link
                                    href={`/${locale}/tickets`}
                                    className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
                                >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                    {i18n.backToTickets}
                                </Link>
                            </div>

                            {/* ── Trust Signals ─────────────────────────────────────────── */}
                            <div className="grid grid-cols-3 gap-3 pt-2">
                                {[
                                    { icon: Shield, label: i18n.trustPayment, color: "emerald" },
                                    { icon: Mail, label: i18n.trustEmail, color: "blue" },
                                    { icon: QrCode, label: i18n.trustQR, color: "purple" },
                                ].map((trust) => (
                                    <div
                                        key={trust.label}
                                        className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white/60 border border-gray-100/80 text-center"
                                    >
                                        <trust.icon className="h-4.5 w-4.5 text-gray-400" />
                                        <span className="text-[11px] text-gray-500 font-medium leading-tight">
                                            {trust.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* ── Animations ─────────────────────────────────────────────────── */}
            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </ProductDetailClient>
    );
}
