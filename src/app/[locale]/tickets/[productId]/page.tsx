import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductById } from "@/actions/products";
import { serializeProduct } from "@/lib/serializeProduct";
import { AddToCartButton } from "@/components/customer/AddToCartButton";
import { ProductDetailClient } from "@/components/customer/ProductDetailClient";
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
  Tag,
} from "lucide-react";
import type { Metadata } from "next";

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
  let validityDescription = "";

  if (v.type === "date-specific") {
    validityLabel = locale === "en" ? "Fixed Date Ticket" : "Vé ngày cụ thể";
    validityDescription =
      locale === "en"
        ? "Valid only on the selected date"
        : "Chỉ có giá trị sử dụng trong ngày đã chọn";
    validityIcon = "calendar";
  } else if (v.type === "date-range") {
    validityLabel = locale === "en" ? "Flexible Ticket" : "Vé linh hoạt";
    validityDescription =
      locale === "en"
        ? `Valid for ${v.validDaysFromPurchase} days from purchase`
        : `Có giá trị ${v.validDaysFromPurchase} ngày kể từ ngày mua`;
    validityIcon = "clock";
  } else {
    validityLabel = locale === "en" ? "Open Ticket" : "Vé không giới hạn";
    validityDescription =
      locale === "en"
        ? "No expiration date"
        : "Không giới hạn thời gian sử dụng";
    validityIcon = "check";
  }

  const remaining =
    product.totalStock !== undefined
      ? Math.max(0, product.totalStock - product.soldCount)
      : null;

  const i18n = {
    backToTickets: locale === "en" ? "All tickets" : "Tất cả vé",
    comboIncludes:
      locale === "en" ? "This combo includes" : "Combo ưu đãi bao gồm",
    addToCart: locale === "en" ? "Add to Cart" : "Thêm vào giỏ",
    soldOut: locale === "en" ? "Sold Out" : "Hết vé",
    trustPayment: locale === "en" ? "Secure Payment" : "Thanh toán an toàn",
    trustEmail: locale === "en" ? "E-ticket via Email" : "Nhận vé qua Email",
    trustQR: locale === "en" ? "Instant QR Code" : "Quét mã QR vào cổng",
    ticketsLeft:
      locale === "en" ? `${remaining} tickets left` : `Chỉ còn ${remaining} vé`,
    inStock: locale === "en" ? "In Stock" : "Sẵn sàng",
    flashSale: "Flash Sale",
    combo: "Combo",
    off: locale === "en" ? "OFF" : "GIẢM",
    youSave: locale === "en" ? "You save" : "Bạn tiết kiệm được",
    details: locale === "en" ? "Ticket Details" : "Chi tiết về vé",
  };

  return (
    <ProductDetailClient>
      {/* ── Premium Abstract Background ──────────────────────────────────────── */}
      <div className="fixed inset-0 -z-10 bg-[#FAFAF8] pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-yellow-200/40 via-orange-100/20 to-transparent rounded-full blur-3xl opacity-60 translate-x-1/3 -translate-y-1/4" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-blue-100/40 via-purple-100/20 to-transparent rounded-full blur-3xl opacity-60 -translate-x-1/4 translate-y-1/4" />
      </div>

      <main className="min-h-screen pt-[110px] pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto">
          {/* ── Breadcrumb ──────────────────────────────────────────────── */}
          <nav className="flex items-center gap-2 text-[13px] font-medium text-gray-500 mb-8 animate-[fadeIn_0.5s_ease-out]">
            <Link
              href={`/${locale}`}
              className="hover:text-[#1A1A2E] transition-colors"
            >
              {locale === "en" ? "Home" : "Trang chủ"}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <Link
              href={`/${locale}/tickets`}
              className="hover:text-[#1A1A2E] transition-colors"
            >
              {i18n.backToTickets}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
            <span className="text-[#1A1A2E] truncate max-w-[200px] sm:max-w-[300px]">
              {product.name}
            </span>
          </nav>

          {/* ── Two-Column Layout ───────────────────────────────────────── */}
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-14 items-start">
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* LEFT COLUMN: Gallery & Description                          */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="w-full lg:w-[55%] xl:w-[58%] flex flex-col gap-8 animate-[fadeSlideUp_0.6s_ease-out]">
              {/* Gallery Section */}
              <div className="flex flex-col gap-4">
                {/* Hero Image */}
                <div className="relative aspect-[4/3] rounded-[32px] overflow-hidden bg-white shadow-xl shadow-gray-200/50 border border-white/60 group">
                  <img
                    src={product.thumbnailUrl}
                    alt={product.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  {/* Subtle gradient overlay at bottom for depth */}
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 via-black/10 to-transparent opacity-80" />

                  {/* Floating Badges */}
                  <div className="absolute top-5 left-5 flex gap-2 flex-wrap z-10">
                    {isCombo && (
                      <span className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold tracking-wider shadow-lg shadow-orange-500/30 backdrop-blur-md uppercase">
                        🎁 {i18n.combo}
                      </span>
                    )}
                    {isOnSale && (
                      <span className="px-4 py-2 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold tracking-wider shadow-lg shadow-pink-500/30 animate-pulse uppercase">
                        ⚡ {i18n.flashSale}
                      </span>
                    )}
                    {isSoldOut && (
                      <span className="px-4 py-2 rounded-2xl bg-gray-900/90 text-white text-xs font-bold tracking-wider backdrop-blur-md uppercase shadow-lg">
                        {i18n.soldOut}
                      </span>
                    )}
                  </div>
                </div>

                {/* Gallery Thumbnails */}
                {product.gallery && product.gallery.length > 0 && (
                  <div className="grid grid-cols-4 gap-4">
                    {product.gallery.slice(0, 4).map((url, i) => (
                      <div
                        key={i}
                        className="relative aspect-square rounded-[20px] overflow-hidden bg-white shadow-sm border border-white/60 cursor-pointer group/thumb hover:shadow-md hover:border-gray-200 transition-all duration-300"
                      >
                        <img
                          src={url}
                          alt={`${product.name} #${i + 2}`}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/thumb:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors duration-300" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Combo Items Section (Moved out of sticky card to allow more breathing room) */}
              {isCombo &&
                product.comboItems &&
                product.comboItems.length > 0 && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-[32px] p-8 border border-amber-100 shadow-lg shadow-amber-100/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/40 rounded-bl-[100px] blur-2xl pointer-events-none" />
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                        <Package className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-xl text-amber-950">
                        {i18n.comboIncludes}
                      </h3>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                      {product.comboItems.map((item, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-4 bg-white/70 backdrop-blur-sm p-4 rounded-2xl border border-amber-200/50 shadow-sm"
                        >
                          <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-sm font-bold text-amber-700">
                            {item.quantity}×
                          </span>
                          <span className="font-semibold text-amber-950 leading-tight">
                            {item.productName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Ticket Description */}
              <div className="bg-white/70 backdrop-blur-md rounded-[32px] p-6 sm:p-10 border border-white/60 shadow-xl shadow-gray-200/30 relative overflow-hidden">
                <div className="absolute -left-10 -top-10 w-40 h-40 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
                <h2 className="text-2xl font-black text-[#1A1A2E] mb-6 flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-[#1A1A2E] flex items-center justify-center text-white shadow-md">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  {i18n.details}
                </h2>
                <div
                  className="relative z-10 text-gray-600 leading-relaxed text-[15px] sm:text-[16px]
                                    [&>p]:mb-5 last:[&>p]:mb-0 
                                    [&_ul]:list-none [&_ul]:pl-0 [&_ul]:mb-6 [&_ul>li]:relative [&_ul>li]:pl-7 [&_ul>li]:mb-3 [&_ul>li::before]:content-['•'] [&_ul>li::before]:absolute [&_ul>li::before]:left-1 [&_ul>li::before]:text-yellow-500 [&_ul>li::before]:text-xl [&_ul>li::before]:leading-none [&_ul>li::before]:top-[-1px]
                                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-6 [&_ol>li]:mb-3 [&_ol>li]:pl-2
                                    [&_strong]:font-bold [&_strong]:text-[#1A1A2E] 
                                    [&_em]:italic 
                                    [&_u]:underline 
                                    [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-[#1A1A2E] [&_h1]:mb-4 [&_h1]:mt-8
                                    [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#1A1A2E] [&_h2]:mb-4 [&_h2]:mt-8
                                    [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#1A1A2E] [&_h3]:mb-3 [&_h3]:mt-6
                                    [&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-blue-700
                                    [&_img]:rounded-[24px] [&_img]:shadow-lg [&_img]:my-6 [&_img]:border [&_img]:border-gray-100"
                  dangerouslySetInnerHTML={{
                    __html: product.description || "",
                  }}
                />
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* RIGHT COLUMN: Sticky Checkout Card                          */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <div className="w-full lg:w-[45%] xl:w-[42%] lg:sticky lg:top-[110px] animate-[fadeSlideUp_0.6s_ease-out_0.15s_both]">
              <div className="bg-white/80 backdrop-blur-2xl border border-white shadow-2xl shadow-gray-200/50 rounded-[32px] p-6 sm:p-8 flex flex-col gap-8 relative overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute -top-20 -right-20 w-48 h-48 bg-gradient-to-br from-yellow-300/40 to-orange-400/40 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-gradient-to-tr from-blue-300/30 to-purple-400/30 rounded-full blur-3xl pointer-events-none" />

                {/* Title */}
                <div className="relative z-10">
                  <h1 className="text-[32px] sm:text-[38px] font-black text-[#1A1A2E] leading-[1.2] tracking-tight">
                    {product.name}
                  </h1>
                </div>

                {/* Price Block */}
                <div className="relative z-10 bg-gradient-to-br from-white to-gray-50/50 border border-gray-100 shadow-sm rounded-[24px] p-6 flex flex-col gap-3">
                  {isOnSale && discountPercent > 0 && (
                    <div className="absolute -top-4 -right-2 sm:-right-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white flex flex-col items-center justify-center shadow-lg shadow-pink-500/30 rotate-[8deg]">
                      <span className="text-xl font-black leading-none tracking-tighter">
                        -{discountPercent}%
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    {isOnSale && (
                      <span className="text-lg font-semibold text-gray-400 line-through">
                        {formatVND(product.price)}
                      </span>
                    )}
                    <span className="text-[42px] font-black text-[#1A1A2E] tracking-tight leading-none">
                      {formatVND(effectivePrice)}
                    </span>
                  </div>

                  {isOnSale && (
                    <div className="inline-flex items-center self-start gap-2 px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold">
                      <Tag className="w-4 h-4" />
                      {i18n.youSave} {formatVND(product.price - effectivePrice)}
                    </div>
                  )}
                </div>

                {/* Features / Validities */}
                <div className="relative z-10 flex flex-col gap-3">
                  {/* Validity Info */}
                  <div className="flex items-start gap-4 p-4 rounded-[20px] bg-white border border-gray-100 shadow-sm group hover:border-gray-200 hover:shadow-md transition-all">
                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-amber-50 group-hover:bg-amber-100 transition-colors flex items-center justify-center mt-0.5">
                      {validityIcon === "calendar" && (
                        <Calendar className="h-6 w-6 text-amber-600" />
                      )}
                      {validityIcon === "clock" && (
                        <Clock className="h-6 w-6 text-amber-600" />
                      )}
                      {validityIcon === "check" && (
                        <CheckCircle className="h-6 w-6 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-base text-[#1A1A2E] font-bold">
                        {validityLabel}
                      </span>
                      <span className="text-[13px] text-gray-500 leading-tight">
                        {validityDescription}
                      </span>
                    </div>
                  </div>

                  {/* Stock Info */}
                  {remaining !== null && (
                    <div className="flex items-start gap-4 p-4 rounded-[20px] bg-white border border-gray-100 shadow-sm group hover:border-gray-200 hover:shadow-md transition-all">
                      <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 transition-colors flex items-center justify-center mt-0.5">
                        <Package className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="flex flex-col justify-center min-h-[44px]">
                        <div className="flex items-center gap-2">
                          <span className="text-base text-[#1A1A2E] font-bold">
                            {i18n.inStock}
                          </span>
                          {remaining <= 10 && remaining > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-black uppercase tracking-wider animate-pulse">
                              {locale === "en" ? "Low stock" : "Sắp hết"}
                            </span>
                          )}
                        </div>
                        <span className="text-[13px] text-gray-500 leading-tight">
                          {i18n.ticketsLeft}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="relative z-10 flex flex-col gap-4 pt-2">
                  <AddToCartButton
                    product={clientProduct}
                    disabled={isSoldOut}
                    className="w-full h-16 rounded-[20px] text-lg font-black shadow-xl shadow-yellow-500/20 transition-all hover:shadow-yellow-500/40 hover:-translate-y-1"
                  />
                  <Link
                    href={`/${locale}/tickets`}
                    className="flex items-center justify-center gap-2 text-[15px] font-medium text-gray-400 hover:text-[#1A1A2E] transition-colors py-2 group"
                  >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    {i18n.backToTickets}
                  </Link>
                </div>

                {/* Trust Signals */}
                <div className="relative z-10 grid grid-cols-3 gap-3 pt-6 border-t border-gray-100/80">
                  {[
                    { icon: Shield, label: i18n.trustPayment },
                    { icon: Mail, label: i18n.trustEmail },
                    { icon: QrCode, label: i18n.trustQR },
                  ].map((trust) => (
                    <div
                      key={trust.label}
                      className="flex flex-col items-center gap-2.5 p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100 text-center hover:bg-gray-100 transition-colors"
                    >
                      <trust.icon className="h-5 w-5 text-gray-400" />
                      <span className="text-[11px] text-gray-500 font-semibold leading-tight">
                        {trust.label}
                      </span>
                    </div>
                  ))}
                </div>
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
