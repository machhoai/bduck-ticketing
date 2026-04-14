"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, X, Zap, Package, Tag, Sparkles } from "lucide-react";
import { AddToCartButton } from "@/components/customer/AddToCartButton";
import { RippleWrapper } from "@/components/ui/RippleWrapper";
import type { ProductGroupDocument } from "@/types/firestore";
import type { ClientProduct } from "@/lib/serializeProduct";
import { getClientEffectivePrice } from "@/lib/serializeProduct";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Props {
    allProducts: ClientProduct[];
    groups: ProductGroupDocument[];
    locale: string;
}

type SortOption = "newest" | "price-asc" | "price-desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatVND(n: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

// ─── Product Card (Grid view) — Blob Design + Ripple Effect ──────────────────
function ProductGridCard({ product, locale, t }: { product: ClientProduct; locale: string; t: ReturnType<typeof useTranslations> }) {
    const { price, originalPrice, isOnSale } = getClientEffectivePrice(product);
    const isSoldOut = product.status === "sold-out";
    const isCombo = product.type === "combo";

    return (
        <article className="group relative flex flex-col overflow-visible h-full">
            {/* ── Blob Background Decorations ── */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-duck-yellow/10 blur-2xl pointer-events-none transition-all duration-700 group-hover:bg-duck-yellow/20 group-hover:scale-150 z-0" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-duck-orange/8 blur-xl pointer-events-none transition-all duration-700 group-hover:bg-duck-orange/15 group-hover:scale-125 z-0" />

            {/* ── Card Body ── */}
            <div
                className="relative z-10 flex flex-col flex-1 bg-white rounded-[28px] border border-gray-100/80 p-2 transition-all duration-400 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.10)]"
                style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.04)" }}
            >
                {/* Image with Ripple Effect */}
                <RippleWrapper className="relative block w-full aspect-[4/3] rounded-[22px] overflow-hidden bg-gray-50 flex-shrink-0">
                    <Link href={`/${locale}/tickets/${product.id}`} className="absolute inset-0 z-10 outline-none" aria-label={product.name} />
                    <Image
                        src={product.thumbnailUrl || "/images/placeholder-product.png"}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover transition-transform duration-600 ease-out group-hover:scale-[1.06]"
                    />

                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    {/* Blob accent — floating organic shape */}
                    <svg className="absolute -top-3 -right-3 w-16 h-16 text-duck-yellow/30 opacity-0 group-hover:opacity-100 transition-all duration-500 group-hover:rotate-12 pointer-events-none" viewBox="0 0 100 100" aria-hidden="true">
                        <path d="M50 0C60 10 90 15 95 40C100 65 80 85 55 95C30 105 10 85 5 60C0 35 20-5 50 0Z" fill="currentColor" />
                    </svg>

                    {/* Badges — blob-inspired asymmetric radius */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-20 w-full pr-3">
                        {isCombo && (
                            <div
                                className="flex items-center gap-1.5 bg-white/92 backdrop-blur-md px-3 py-1.5 shadow-sm text-[11px] font-bold text-duck-orange border border-white/50"
                                style={{ borderRadius: "20px 20px 20px 6px" }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-duck-orange animate-pulse" />
                                {t("combo")}
                            </div>
                        )}
                        {isOnSale && (
                            <div
                                className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-md px-3 py-1.5 shadow-sm text-[11px] font-bold text-white border border-gray-700/50"
                                style={{ borderRadius: "20px 20px 20px 6px" }}
                            >
                                <Zap className="w-3 h-3 text-duck-yellow" />
                                {t("flashSale")}
                            </div>
                        )}
                        {isSoldOut && (
                            <div
                                className="flex items-center gap-1.5 bg-gray-900/90 backdrop-blur-md px-3 py-1.5 shadow-sm text-[11px] font-bold text-white border border-gray-700/50"
                                style={{ borderRadius: "20px 20px 20px 6px" }}
                            >
                                {t("soldOut")}
                            </div>
                        )}
                    </div>
                </RippleWrapper>

                {/* Card Content */}
                <div className="pt-4 px-3 pb-2 flex flex-col flex-1">
                    <Link href={`/${locale}/tickets/${product.id}`} className="flex flex-col gap-1 outline-none mb-3 flex-1">
                        <h3 className="font-bold text-gray-900 text-lg leading-snug tracking-tight line-clamp-2 group-hover:text-duck-orange transition-colors duration-300">
                            {product.name}
                        </h3>
                        {product.description && (
                            <p className="text-gray-500 text-[13px] font-medium leading-relaxed line-clamp-2">
                                {product.description}
                            </p>
                        )}
                    </Link>

                    {/* Price row — icon in tinted pill */}
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
                            product={product}
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

// ─── Main Explorer Component ──────────────────────────────────────────────────
export const ProductsExplorer: React.FC<Props> = ({ allProducts, groups, locale }) => {
    const t = useTranslations("tickets");
    const [search, setSearch] = useState("");
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [sort, setSort] = useState<SortOption>("newest");

    const handleSearchClear = useCallback(() => setSearch(""), []);

    // ── Filter + Sort ───────────────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let result = [...allProducts];

        // Group filter
        if (activeGroup) {
            result = result.filter((p) => p.groupId === activeGroup);
        }

        // Text search
        const q = search.trim().toLowerCase();
        if (q) {
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(q) ||
                    (p.description ?? "").toLowerCase().includes(q)
            );
        }

        // Sort
        switch (sort) {
            case "price-asc":
                result.sort((a, b) => getClientEffectivePrice(a).price - getClientEffectivePrice(b).price);
                break;
            case "price-desc":
                result.sort((a, b) => getClientEffectivePrice(b).price - getClientEffectivePrice(a).price);
                break;
            case "newest":
            default:
                // Keep natural order (Firestore orderBy createdAt desc)
                break;
        }

        return result;
    }, [allProducts, activeGroup, search, sort]);

    const available = filtered.filter((p) => p.status !== "sold-out").length;

    return (
        <div className="min-h-screen bg-white">
            {/* ── Minimalist Premium Hero Banner ────────────────────────────────────── */}
            <div className="relative pt-20 pb-10 w-full px-4 md:py-10 md:pt-32 overflow-hidden">
                <div>
                    <Image src="/images/bduck_summer_backdrop.png" alt="B.Duck Cityfuns" fill className="rounded-2xl object-cover" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80" />
                <div className="relative w-full mx-auto text-center z-10 flex flex-col items-center">
                    <h1 className="text-5xl sm:text-6xl w-full font-black text-white tracking-tight">
                        {t("heroTitle1")}{" "}
                        <span className="text-transparent leading-normal bg-clip-text bg-gradient-to-r from-duck-yellow to-duck-orange inline-block">
                            {t("heroTitleHighlight")}
                        </span>{" "}
                        {t("heroTitle2")}
                    </h1>

                    {/* Search bar - Minimal line style */}
                    <div className="mt-2 w-full max-w-2xl mx-auto relative group">
                        <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-300 transition-colors group-focus-within:text-duck-yellow" />
                        <input
                            placeholder={t("searchPlaceholder")}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-transparent text-white placeholder:text-gray-300 border-b-2 border-gray-200 pl-12 pr-12 py-5 text-xl md:text-2xl font-bold focus:outline-none focus:border-white transition-colors"
                        />
                        {search && (
                            <button onClick={handleSearchClear} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors cursor-pointer">
                                <X className="h-6 w-6" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Sticky Command Bar ────────────────────────────────────────────────── */}
            <div className="sticky top-[64px] z-30 bg-white/85 backdrop-blur-xl shadow-[0_4px_32px_-12px_rgba(0,0,0,0.06)] transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 sm:px-8">
                    <div className="flex items-center gap-4">
                        {/* Group tabs — scrollable */}
                        <div className="flex-1 flex items-center gap-8 overflow-x-auto scrollbar-hide py-2">
                            <button
                                onClick={() => setActiveGroup(null)}
                                className={cn(
                                    "relative h-[40px] flex items-center justify-center text-[15px] tracking-wide transition-all whitespace-nowrap cursor-pointer",
                                    !activeGroup ? "text-[#1A1A2E] font-bold" : "text-gray-400 font-bold hover:text-gray-900"
                                )}
                            >
                                {t("filterAll")}
                                {!activeGroup && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-duck-yellow rounded-t-full" />}
                            </button>
                            {groups.map((g) => (
                                <button
                                    key={g.id}
                                    onClick={() => setActiveGroup(g.id === activeGroup ? null : g.id)}
                                    className={cn(
                                        "relative h-[40px] flex items-center justify-center text-[15px] tracking-wide transition-all whitespace-nowrap cursor-pointer",
                                        activeGroup === g.id ? "text-[#1A1A2E] font-bold" : "text-gray-400 font-bold hover:text-gray-900"
                                    )}
                                >
                                    {g.name}
                                    {activeGroup === g.id && <span className="absolute bottom-0 left-0 w-full h-[3px] bg-duck-yellow rounded-t-full" />}
                                </button>
                            ))}
                        </div>

                        {/* Sort */}
                        <div className="flex items-center gap-4 flex-shrink-0 border-l border-gray-100 pl-6 h-8">
                            <div className="relative">
                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value as SortOption)}
                                    className="h-10 pl-2 pr-8 bg-transparent text-[#1A1A2E] text-[14px] font-bold border-0 focus:outline-none focus:ring-0 appearance-none cursor-pointer"
                                >
                                    <option value="newest">{t("sortNewest")}</option>
                                    <option value="price-asc">{t("sortPriceAsc")}</option>
                                    <option value="price-desc">{t("sortPriceDesc")}</option>
                                </select>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Product Grid ──────────────────────────────────────────────────────── */}
            <main className="max-w-7xl mx-auto px-6 sm:px-8 py-4">
                {/* Result count */}
                <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-bold text-gray-400 tracking-widest">
                        {search || activeGroup ? (
                            <>
                                <span className="text-[#1A1A2E]">{t("foundStats", { count: filtered.length })}</span>
                                {available < filtered.length && (
                                    <span className="text-gray-400"> · {t("inStock", { count: available })}</span>
                                )}
                            </>
                        ) : (
                            <span className="text-[#1A1A2E]">{t("availableStats", { count: filtered.length })}</span>
                        )}
                    </p>

                    {/* Active filters chips */}
                    <div className="flex items-center gap-2">
                        {activeGroup && (
                            <button
                                onClick={() => setActiveGroup(null)}
                                className="flex items-center gap-1.5 bg-gray-100 text-[#1A1A2E] text-xs font-bold px-4 py-2 rounded-full hover:bg-gray-200 transition-colors cursor-pointer tracking-wider"
                            >
                                {groups.find((g) => g.id === activeGroup)?.name}
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                        {search && (
                            <button
                                onClick={handleSearchClear}
                                className="flex items-center gap-1.5 bg-duck-yellow/20 text-[#1A1A2E] text-xs font-bold px-4 py-2 rounded-full hover:bg-duck-yellow/30 transition-colors cursor-pointer tracking-wider"
                            >
                                "{search}"
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Empty state */}
                {filtered.length === 0 ? (
                    <div className="text-center py-32 space-y-6">
                        <div className="text-7xl">🦆</div>
                        <h3 className="text-2xl font-black text-[#1A1A2E] tracking-tight">{t("emptyTitle")}</h3>
                        <p className="text-gray-400 text-base font-medium">{t("emptySubtitle")}</p>
                        <button
                            onClick={() => { setSearch(""); setActiveGroup(null); }}
                            className="mt-6 px-8 py-4 bg-[#1A1A2E] text-white font-bold rounded-full text-sm hover:bg-black transition-colors"
                        >
                            {t("clearFilters")}
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
                        {filtered.map((product) => (
                            <ProductGridCard key={product.id} product={product} locale={locale} t={t} />
                        ))}
                    </div>
                )}
            </main>

            {/* ── Bottom CTA ───────────────────────────────────────────────────────── */}
            {filtered.length > 0 && (
                <div className="bg-[#FAFAF8] py-10 text-center px-4">
                    <Package className="h-10 w-10 text-duck-yellow mx-auto mb-6" />
                    <p className="text-[#1A1A2E] text-2xl font-bold mb-3 tracking-tight">{t("notFoundHelp")}</p>
                    <p className="text-base text-gray-500 font-medium mb-8">{t("contactDesc")}</p>
                    <Link
                        href={`/${locale}#contact`}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-white text-[#1A1A2E] font-bold rounded-full text-[15px] uppercase tracking-widest shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_32px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300"
                    >
                        {t("contactCta")} →
                    </Link>
                </div>
            )}
        </div>
    );
};

export default ProductsExplorer;
