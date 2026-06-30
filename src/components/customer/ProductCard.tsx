// Server Component (RSC) — renders product info for SEO
// AddToCartButton is extracted as a separate Client Component (D6: Composition Pattern)
import Link from "next/link";
import { Tag, Sparkles, Zap } from "lucide-react";
import { AddToCartButton } from "@/components/customer/AddToCartButton";
import { RippleWrapper } from "@/components/ui/RippleWrapper";
import type { ProductDocument } from "@/types/firestore";
import { serializeProduct, getClientEffectivePrice } from "@/lib/serializeProduct";
import { localizeField } from "@/lib/localize";

interface ProductCardProps {
    product: ProductDocument;
    locale: string;
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
}

export function ProductCard({ product, locale }: ProductCardProps) {
    const clientProduct = serializeProduct(product);
    const { price, originalPrice, isOnSale } = getClientEffectivePrice(clientProduct);
    const isSoldOut = product.status === "sold-out";
    const isCombo = product.type === "combo";

    const displayName = localizeField(product.name, product.nameLocales, locale);
    const displayDesc = localizeField(
        product.description ?? "",
        product.descriptionLocales,
        locale
    );

    return (
        <article className="group relative flex flex-col overflow-visible h-full">
            {/* ── Blob Background ── */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-duck-yellow/10 blur-2xl pointer-events-none transition-all duration-700 group-hover:bg-duck-yellow/20 group-hover:scale-150 z-0" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-duck-orange/8 blur-xl pointer-events-none transition-all duration-700 group-hover:bg-duck-orange/15 group-hover:scale-125 z-0" />

            {/* ── Card Body ── */}
            <div className="relative z-10 flex flex-col flex-1 bg-white rounded-[28px] border border-gray-100/80 p-2 transition-all duration-400 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.10)]"
                style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}
            >
                {/* Image container — Blob-shaped mask */}
                <RippleWrapper className="relative block w-full aspect-[4/3] rounded-[22px] overflow-hidden bg-gray-50 flex-shrink-0">
                    <Link href={`/${locale}/tickets/${product.id}`} className="absolute inset-0 z-10 outline-none" aria-label={displayName} />
                    <img
                        src={product.thumbnailUrl}
                        alt={displayName}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-600 ease-out group-hover:scale-[1.06]"
                    />

                    {/* Blob-shaped decorative overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {/* Blob accent — floating organic shape top-right */}
                    <svg className="absolute -top-3 -right-3 w-16 h-16 text-duck-yellow/30 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:rotate-12 pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
                        <path d="M50 0C60 10 90 15 95 40C100 65 80 85 55 95C30 105 10 85 5 60C0 35 20-5 50 0Z" fill="currentColor" />
                    </svg>

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-20 w-full pr-3">
                        {isCombo && (
                            <div className="flex items-center gap-1.5 bg-white/92 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm text-[11px] font-bold text-duck-orange border border-white/50"
                                style={{ borderRadius: "20px 20px 20px 6px" }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-duck-orange animate-pulse" />
                                Combo
                            </div>
                        )}
                        {isOnSale && (
                            <div className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-md px-3 py-1.5 shadow-sm text-[11px] font-bold text-white border border-gray-700/50"
                                style={{ borderRadius: "20px 20px 20px 6px" }}
                            >
                                <Zap className="w-3 h-3 text-duck-yellow" />
                                Hot Deal
                            </div>
                        )}
                    </div>
                </RippleWrapper>

                {/* Content */}
                <div className="pt-4 px-3 pb-2 flex flex-col flex-1">
                    <Link href={`/${locale}/tickets/${product.id}`} className="flex flex-col gap-1 outline-none mb-3">
                        <h3 className="font-bold text-gray-900 text-lg leading-snug tracking-tight line-clamp-2 group-hover:text-duck-orange transition-colors duration-300">
                            {displayName}
                        </h3>
                        <div 
                            className="text-gray-500 text-[13px] font-medium leading-relaxed line-clamp-2 [&_p]:block [&_p]:mb-1 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                            dangerouslySetInnerHTML={{ __html: displayDesc || "Vé cổng điện tử B.Duck Cityfuns" }}
                        />
                    </Link>

                    {/* Price row */}
                    <div className="flex items-center gap-4 mt-auto text-[13px]">
                        <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-duck-yellow/15 flex items-center justify-center">
                                <Tag className="w-3 h-3 text-duck-orange" />
                            </div>
                            <span className="text-gray-900 font-extrabold">{formatVND(price)}</span>
                            {originalPrice && (
                                <span className="text-xs text-gray-400 line-through font-medium">{formatVND(originalPrice)}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 font-medium ml-auto">
                            <Sparkles className="w-3.5 h-3.5 text-duck-yellow" />
                            <span className="text-xs">B.Duck</span>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-4 mb-1">
                        <AddToCartButton
                            product={clientProduct}
                            disabled={isSoldOut}
                            variant="secondary"
                            className="w-full text-[14px] font-bold h-11 rounded-[16px] bg-gray-900 text-white hover:bg-black transition-colors !shadow-none flex items-center justify-center"
                        />
                    </div>
                </div>
            </div>
        </article>
    );
}
