// Server Component (RSC) — renders product info for SEO
// AddToCartButton is extracted as a separate Client Component (D6: Composition Pattern)
import Image from "next/image";
import Link from "next/link";
import { Heart, Tag, Sparkles } from "lucide-react";
import { AddToCartButton } from "@/components/customer/AddToCartButton";
import type { ProductDocument } from "@/types/firestore";
import { serializeProduct, getClientEffectivePrice } from "@/lib/serializeProduct";

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
    // Serialize to cross RSC→CC boundary safely
    const clientProduct = serializeProduct(product);
    const { price, originalPrice, isOnSale } = getClientEffectivePrice(clientProduct);
    const isSoldOut = product.status === "sold-out";
    const isCombo = product.type === "combo";

    return (
        <article className="group relative flex flex-col bg-white rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-100/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] p-2">

            {/* Hình ảnh (Ép cứng tỷ lệ 4:3 ngang) */}
            <Link href={`/${locale}/tickets/${product.id}`} className="relative block w-full aspect-[4/3] rounded-[22px] overflow-hidden bg-gray-50 flex-shrink-0 outline-none">
                <Image
                    src={product.thumbnailUrl}
                    alt={product.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] group-hover:scale-105"
                />

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 w-full pr-3">
                    {isCombo && (
                        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm text-[11px] font-bold text-duck-orange border border-white/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-duck-orange animate-pulse" />
                            Combo
                        </div>
                    )}
                    {isOnSale && (
                        <div className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm text-[11px] font-bold text-white border border-gray-700/50 hover:bg-black transition-colors shrink-0">
                            ⚡ Hot Deal
                        </div>
                    )}
                </div>
            </Link>

            {/* Nội dung Card */}
            <div className="pt-4 px-3 pb-2 flex flex-col flex-1">
                {/* Texts */}
                <Link href={`/${locale}/tickets/${product.id}`} className="flex flex-col gap-1 outline-none mb-3">
                    <h3 className="font-bold text-gray-900 text-lg leading-snug tracking-tight line-clamp-2 group-hover:text-duck-orange transition-colors">
                        {product.name}
                    </h3>
                    <p className="text-gray-500 text-[13px] font-medium leading-relaxed line-clamp-2">
                        {product.description || "Vé cổng điện tử B.Duck Cityfuns"}
                    </p>
                </Link>

                {/* Metadata */}
                <div className="flex items-center gap-4 mt-auto text-[13px]">
                    <div className="flex items-center gap-1.5 text-gray-800 font-bold">
                        <Tag className="w-4 h-4 text-gray-400" />
                        <span>{formatVND(price)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600 font-medium">
                        <Sparkles className="w-4 h-4 text-gray-400" />
                        <span>B.Duck Fun</span>
                    </div>
                </div>

                {/* Nút CTA */}
                <div className="mt-4 mb-1">
                    <AddToCartButton
                        product={clientProduct}
                        disabled={isSoldOut}
                        variant="secondary"
                        className="w-full text-[14px] font-bold h-11 rounded-[16px] bg-gray-900 text-white hover:bg-black transition-colors !shadow-none flex items-center justify-center"
                    />
                </div>
            </div>
        </article>
    );
}
