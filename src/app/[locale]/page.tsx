import { Suspense } from "react";
import Link from "next/link";
import { Hero } from "@/components/home/Hero";
import { Attractions } from "@/components/home/Attractions";
import { ProductGroupTabs } from "@/components/customer/ProductGroupTabs";
import { ProductCard } from "@/components/customer/ProductCard";
import { DealSection } from "@/components/customer/DealSection";
import { Skeleton } from "@/components/ui";
import { getProductGroups, getProducts } from "@/actions/products";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Ticket, ArrowRight } from "lucide-react";

export const revalidate = 60;

interface PageProps {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ group?: string }>;
}

export default async function HomePage({ params, searchParams }: PageProps) {
    const { locale } = await params;
    const { group: activeGroupId } = await searchParams;
    setRequestLocale(locale);

    const [groups, products, t] = await Promise.all([
        getProductGroups(),
        getProducts(activeGroupId),
        getTranslations("ticketSection"),
    ]);

    return (
        <>
            <Hero />
            <Attractions />

            {/* ── Deal Sections (time-gated promos) ── */}
            {/* <Suspense fallback={
                <section className="py-10 bg-[#0F0F1A]">
                    <div className="max-w-7xl mx-auto px-6 sm:px-8 space-y-8">
                        <Skeleton className="h-12 w-64 mx-auto rounded-2xl bg-white/5" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3].map(i => <Skeleton key={i} className="h-80 rounded-[28px] bg-white/5" />)}
                        </div>
                    </div>
                </section>
            }>
                <DealSection locale={locale} />
            </Suspense> */}

            {/* ── Ticket Listing Section ── */}
            <section
                id="tickets"
                aria-labelledby="tickets-heading"
                className="relative py-4 pt-16 overflow-hidden"
            >
                {/* Background — subtle warm gradient */}
                <div className="absolute inset-0 bg-gradient-to-b from-white via-[#FFFDF5] to-white pointer-events-none" />

                {/* Decorative blob */}
                <div
                    className="absolute top-10 left-0 w-[500px] h-[500px] rounded-full pointer-events-none opacity-40"
                    style={{ background: "radial-gradient(circle, rgba(255,209,0,0.10) 0%, transparent 65%)", transform: "translate(-30%, 0)" }}
                />
                <div
                    className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none opacity-30"
                    style={{ background: "radial-gradient(circle, rgba(255,121,0,0.08) 0%, transparent 65%)", transform: "translate(30%, 20%)" }}
                />

                <div className="relative max-w-7xl mx-auto px-6 sm:px-8">
                    {/* ── Header ── */}
                    <div className="text-center mb-5">

                        <h2
                            id="tickets-heading"
                            className="text-[2rem] md:text-[2.8rem] font-extrabold text-[#1A1A2E] tracking-tight leading-[1.1] mb-4"
                        >
                            {t("title")}{" "}
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FFD100] to-[#FF7900]">
                                {t("titleHighlight")}
                            </span>
                        </h2>
                        <p className="text-gray-500 text-base lg:text-lg max-w-xl mx-auto leading-relaxed">
                            {t("subtitle")}
                        </p>
                    </div>

                    {/* ── Group tabs ── */}
                    {groups.length > 0 && (
                        <div className="flex justify-center mb-10">
                            <ProductGroupTabs
                                groups={groups}
                                activeGroupId={activeGroupId}
                                locale={locale}
                            />
                        </div>
                    )}

                    {/* ── Product Grid ── */}
                    <Suspense
                        fallback={
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 overflow-visible">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-96 rounded-[28px]" />
                                ))}
                            </div>
                        }
                    >
                        {products.length === 0 ? (
                            <div className="text-center py-24">
                                <div className="text-6xl mb-4">🦆</div>
                                <h3 className="text-xl font-bold text-[#1A1A2E] mb-2">{t("emptyTitle")}</h3>
                                <p className="text-gray-400">{t("emptySubtitle")}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 overflow-visible">
                                {products.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        locale={locale}
                                    />
                                ))}
                            </div>
                        )}
                    </Suspense>

                    {/* ── Bottom CTA ── */}
                    {products.length > 0 && (
                        <div className="py-6 text-center">
                            <p className="text-gray-400 text-sm mb-4">{t("exploreCtaSubtext")}</p>
                            <Link
                                href={`/${locale}/tickets`}
                                className="inline-flex items-center gap-2.5 px-8 py-4 bg-[#1A1A2E] text-white font-bold rounded-full text-sm hover:bg-black hover:shadow-[0_16px_32px_rgba(0,0,0,0.15)] hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-300"
                            >
                                {t("exploreCta")}
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    )}
                </div>
            </section>
        </>
    );
}
