/**
 * DealSection — Server Component
 * Renders active deal sections on the homepage.
 * White background + warm brand palette — matches Attractions / Tickets sections.
 */

import React from "react";
import Image from "next/image";
import { Zap, Clock, Package } from "lucide-react";
import { getActiveDealSections } from "@/actions/dealSections";
import { checkDealSectionTimeGate } from "@/lib/dealUtils";
import { DealCard } from "./DealCard";
import type { DealSectionDocument } from "@/types/firestore";

// ─── Stickers for section headers ─────────────────────────────────────────────
const STICKERS = [
    "/sticker_bduck/Asset 67@3x.png",
    "/sticker_bduck/Asset 55@3x.png",
    "/sticker_bduck/Asset 60@3x.png",
    "/sticker_bduck/Asset 62@3x.png",
] as const;

// ─── Section header bar colours ───────────────────────────────────────────────
const HEADER_ACCENTS = [
    { bar: "from-[#FFD100] to-[#FF7900]", label: "bg-amber-100 text-amber-800 border-amber-200" },
    { bar: "from-[#FF5F6D] to-[#FF2D55]", label: "bg-rose-100 text-rose-700 border-rose-200" },
    { bar: "from-[#4ECDC4] to-[#44A8A1]", label: "bg-teal-100 text-teal-700 border-teal-200" },
    { bar: "from-[#A78BFA] to-[#7C3AED]", label: "bg-violet-100 text-violet-700 border-violet-200" },
] as const;

// ─── Section sub-components ───────────────────────────────────────────────────

interface StatusPillProps {
    isOpen: boolean;
    opensAt: string | null;
}

function StatusPill({ isOpen, opensAt }: StatusPillProps) {
    if (!opensAt) return null;
    if (isOpen) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Đang mở bán
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
            <Clock className="h-3 w-3" />
            Mở lúc {opensAt}
        </span>
    );
}

interface SectionBannerProps {
    section: DealSectionDocument;
    isOpen: boolean;
    opensAt: string | null;
    sIdx: number;
}

function SectionBanner({ section, isOpen, opensAt, sIdx }: SectionBannerProps) {
    const accent = HEADER_ACCENTS[sIdx % HEADER_ACCENTS.length];
    const sticker = STICKERS[sIdx % STICKERS.length];

    return (
        <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm">
            {/* Gradient top bar */}
            <div className={`h-1.5 w-full bg-gradient-to-r ${accent.bar}`} />

            <div className="flex items-center justify-between gap-4 px-5 py-4">
                {/* Left: sticker + info */}
                <div className="flex items-center gap-4">
                    <div
                        className="relative w-14 h-14 flex-shrink-0"
                        style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.12))" }}
                    >
                        <Image src={sticker} alt={section.title} fill className="object-contain" sizes="56px" />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-[#1A1A2E] text-lg leading-tight">
                                {section.title}
                            </h3>
                            {section.badgeLabel && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${accent.label}`}>
                                    <Zap className="h-2.5 w-2.5" />
                                    {section.badgeLabel}
                                </span>
                            )}
                        </div>
                        {section.description && (
                            <p className="text-gray-400 text-xs max-w-sm leading-snug">{section.description}</p>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                <Package className="h-3 w-3" /> {section.items.length} sản phẩm
                            </span>
                            {section.maxPromoVariantsPerOrder && (
                                <span className="text-[10px] text-gray-400">
                                    · Tối đa {section.maxPromoVariantsPerOrder} loại/đơn
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: status */}
                <div className="flex-shrink-0">
                    <StatusPill isOpen={isOpen} opensAt={opensAt} />
                </div>
            </div>
        </div>
    );
}

// ─── Main DealSection ─────────────────────────────────────────────────────────

interface DealSectionProps {
    locale?: string;
}

export async function DealSection({ locale = "vi" }: DealSectionProps) {
    const sections = await getActiveDealSections();
    if (sections.length === 0) return null;

    return (
        <section
            id="deals"
            aria-labelledby="deals-heading"
            className="relative bg-white py-16 md:py-20 overflow-hidden"
        >
            {/* Decorative blob — same pattern as Attractions */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-60"
                style={{ background: "radial-gradient(ellipse at top, rgba(255,209,0,0.08) 0%, transparent 70%)" }}
            />

            <div className="relative max-w-7xl mx-auto px-5 sm:px-8 space-y-16">
                {/* ── Global heading ─────────────────────────────────── */}
                <div className="text-center">
                    {/* Eyebrow */}
                    <div className="flex justify-center mb-4">
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD100] animate-pulse" />
                            Ưu đãi có giới hạn
                        </span>
                    </div>

                    <h2
                        id="deals-heading"
                        className="font-extrabold tracking-tight text-[2rem] md:text-[3rem] text-[#1A1A2E] leading-[1.1] mb-4"
                    >
                        Flash{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FFD100] to-[#FF7900]">
                            Deals
                        </span>
                    </h2>
                    <p className="text-gray-500 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
                        Ưu đãi đặc biệt mỗi ngày — số lượng có hạn, nhanh tay kẻo hết!
                    </p>
                </div>

                {/* ── Each section ────────────────────────────────────── */}
                {sections.map((section, sIdx) => {
                    const { isOpen, opensAt } = checkDealSectionTimeGate(section);

                    return (
                        <div key={section.id} className="space-y-5">
                            <SectionBanner
                                section={section}
                                isOpen={isOpen}
                                opensAt={opensAt}
                                sIdx={sIdx}
                            />

                            {section.items.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">
                                    <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    Chưa có sản phẩm nào trong section này.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {section.items.map((item, iIdx) => (
                                        <DealCard
                                            key={item.id}
                                            item={{ ...item }}
                                            sectionId={section.id}
                                            isOpen={isOpen}
                                            opensAt={opensAt}
                                            index={iIdx}
                                            locale={locale}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
