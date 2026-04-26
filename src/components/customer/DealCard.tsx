"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Image from "next/image";
import { ShoppingCart, Clock, Gift, Crown, Check, Loader2, Tag, Flame, Zap } from "lucide-react";
import type { DealItemDocument } from "@/types/firestore";
import { useCartStore } from "@/stores/cart";

// ─── Constants ────────────────────────────────────────────────────────────────

const STICKERS = [
    "/sticker_bduck/Asset 37@3x.png",
    "/sticker_bduck/Asset 44@3x.png",
    "/sticker_bduck/Asset 48@3x.png",
    "/sticker_bduck/Asset 52@3x.png",
    "/sticker_bduck/Asset 55@3x.png",
    "/sticker_bduck/Asset 60@3x.png",
    "/sticker_bduck/Asset 62@3x.png",
    "/sticker_bduck/Asset 65@3x.png",
] as const;

// Accent colours — warm palette consistent with brand (#FFD100, #FF7900)
const ACCENTS = [
    { bg: "from-[#FFF9E6] to-[#FFFDF5]", highlight: "#F5C842", pill: "bg-amber-100 text-amber-800",    border: "border-amber-100" },
    { bg: "from-[#FFF0F1] to-[#FFF5F6]", highlight: "#FF5F6D", pill: "bg-rose-100 text-rose-700",       border: "border-rose-100" },
    { bg: "from-[#EDFAFA] to-[#F5FFFE]", highlight: "#0EA5B0", pill: "bg-teal-100 text-teal-700",       border: "border-teal-100" },
    { bg: "from-[#F5F3FF] to-[#FAFAFF]", highlight: "#7C3AED", pill: "bg-violet-100 text-violet-700",   border: "border-violet-100" },
] as const;

type Accent = (typeof ACCENTS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vnd(n: number): string {
    return new Intl.NumberFormat("vi-VN").format(n) + "đ";
}

interface TimeRemaining {
    total: number;
    hours: number;
    minutes: number;
    seconds: number;
}

function calcRemaining(opensAt: string | null): TimeRemaining | null {
    if (!opensAt) return null;
    const [h, m] = opensAt.split(":").map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    const total = target.getTime() - now.getTime();
    if (total <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0 };
    return {
        total,
        hours: Math.floor(total / 3_600_000),
        minutes: Math.floor((total % 3_600_000) / 60_000),
        seconds: Math.floor((total % 60_000) / 1000),
    };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CountdownClockProps {
    opensAt: string | null;
}

const CountdownClock = React.memo(function CountdownClock({ opensAt }: CountdownClockProps) {
    const [remaining, setRemaining] = useState<TimeRemaining | null>(() => calcRemaining(opensAt));

    useEffect(() => {
        const id = setInterval(() => setRemaining(calcRemaining(opensAt)), 1000);
        return () => clearInterval(id);
    }, [opensAt]);

    if (!remaining || remaining.total <= 0) return null;

    return (
        <div className="flex items-center gap-1.5 mt-2">
            {[
                { v: remaining.hours, label: "giờ" },
                { v: remaining.minutes, label: "phút" },
                { v: remaining.seconds, label: "giây" },
            ].map(({ v, label }, i) => (
                <React.Fragment key={label}>
                    <div className="flex flex-col items-center">
                        <div className="bg-white/30 backdrop-blur-sm border border-white/40 rounded-lg px-2 py-1 min-w-[34px] text-center">
                            <span className="text-white font-extrabold text-sm tabular-nums leading-none">
                                {String(v).padStart(2, "0")}
                            </span>
                        </div>
                        <span className="text-white/60 text-[8px] mt-0.5 uppercase tracking-wider">{label}</span>
                    </div>
                    {i < 2 && <span className="text-white/50 font-bold text-base mb-5">:</span>}
                </React.Fragment>
            ))}
        </div>
    );
});

interface StockBarProps {
    totalStock: number;
    soldCount: number;
    highlight: string;
}

const StockBar = React.memo(function StockBar({ totalStock, soldCount, highlight }: StockBarProps) {
    const pct = Math.min(100, Math.round((soldCount / totalStock) * 100));
    const remaining = totalStock - soldCount;
    const isUrgent = pct >= 70;

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span
                    className="text-[10px] font-bold flex items-center gap-1"
                    style={{ color: isUrgent ? "#EF4444" : "#10B981" }}
                >
                    {isUrgent ? <Flame className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                    {isUrgent ? "Sắp hết!" : "Còn hàng"}
                </span>
                <span className="text-[10px] text-gray-400 tabular-nums">{remaining}/{totalStock}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                        width: `${pct}%`,
                        background: isUrgent
                            ? "linear-gradient(90deg,#EF4444,#DC2626)"
                            : `linear-gradient(90deg, ${highlight}, ${highlight}bb)`,
                    }}
                />
            </div>
        </div>
    );
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface DealCardProps {
    item: DealItemDocument;
    sectionId: string;
    isOpen: boolean;
    opensAt: string | null;
    index?: number;
    locale?: string;
}

// ─── Main DealCard ────────────────────────────────────────────────────────────

export const DealCard = React.memo(function DealCard({
    item,
    sectionId,
    isOpen,
    opensAt,
    index = 0,
}: DealCardProps) {
    const [added, setAdded] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [pending, startTransition] = useTransition();
    const addItem = useCartStore((s) => s.addItem);

    const accent = ACCENTS[index % ACCENTS.length];
    const sticker = STICKERS[index % STICKERS.length];
    const isSoldOut = item.totalStock !== undefined && item.soldCount >= item.totalStock;
    const isLocked = !isOpen;
    const isDisabled = isLocked || isSoldOut;

    const handleAddToCart = useCallback(() => {
        if (isDisabled || added || pending) return;
        startTransition(() => {
            addItem({
                id: item.linkedProductId ?? item.id,
                name: item.name,
                thumbnailUrl: item.thumbnailUrl,
                price: item.effectivePrice,
                type: item.productType,
                soldCount: item.soldCount,
                status: "active",
                description: item.description,
                dealSectionId: sectionId,
                dealItemId: item.id,
                giftVoucherName: item.giftVoucher?.templateName,
            } as Parameters<typeof addItem>[0]);
            setAdded(true);
            setTimeout(() => setAdded(false), 2_000);
        });
    }, [isDisabled, added, pending, addItem, item, sectionId]);

    const discountText =
        item.dealType === "percentage" ? `-${item.discountValue}%`
        : item.dealType === "fixed"      ? `-${vnd(item.discountValue)}`
        : "Mua 1 tặng 1";

    return (
        <article
            className={`group relative flex flex-col rounded-[24px] overflow-hidden select-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl bg-gradient-to-br ${accent.bg} border ${accent.border}`}
            style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
        >
            {/* ── Image ──────────────────────────────────── */}
            <div className="relative w-full aspect-[4/3] overflow-hidden flex-shrink-0 rounded-t-[24px] bg-gray-100">
                <Image
                    src={item.thumbnailUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${isDisabled ? "opacity-50 grayscale" : ""}`}
                    unoptimized
                />

                {/* Discount badge */}
                <div
                    className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-extrabold shadow-md text-white"
                    style={{ background: `linear-gradient(135deg, ${accent.highlight}, ${accent.highlight}dd)` }}
                >
                    {discountText}
                </div>

                {/* Daily badge */}
                {/* {item.stockResetPeriod === "daily" && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-[9px] font-bold bg-white/90 text-gray-500 shadow">
                        ⟳ mỗi ngày
                    </div>
                )} */}

                {/* Locked overlay */}
                {isLocked && (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-t-[24px]"
                        style={{ backdropFilter: "blur(8px)", background: "rgba(26,26,46,0.65)" }}
                    >
                        <div className="w-11 h-11 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-white" />
                        </div>
                        <p className="text-white font-extrabold text-sm">Mở bán lúc {opensAt}</p>
                        <CountdownClock opensAt={opensAt} />
                    </div>
                )}

                {/* Sold out */}
                {isSoldOut && !isLocked && (
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-t-[24px]"
                        style={{ backdropFilter: "blur(8px)", background: "rgba(26,26,46,0.65)" }}
                    >
                        <p className="text-white font-extrabold text-xl">Hết hàng</p>
                        <p className="text-white/60 text-xs">Quay lại ngày mai</p>
                    </div>
                )}

                {/* B.Duck sticker hover */}
                <div
                    className="pointer-events-none absolute -bottom-5 -right-2 w-20 h-20 transition-all duration-500 opacity-0 group-hover:opacity-100 group-hover:-translate-y-2"
                    style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.2))" }}
                >
                    <Image src={sticker} alt="" fill className="object-contain" sizes="80px" aria-hidden />
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────── */}
            <div className="flex flex-col flex-1 p-4 gap-2.5">
                {/* Title — always visible */}
                <h3 className="font-extrabold text-[#1A1A2E] text-base leading-tight line-clamp-2">
                    {item.name}
                </h3>

                {/* Perk badges — always visible */}
                {(item.giftVoucher || item.giftMerch || item.membershipBonusOverride || item.membershipConfig) && (
                    <div className="flex flex-wrap gap-1.5">
                        {item.giftVoucher && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700">
                                <Tag className="h-2.5 w-2.5" /> Kèm voucher
                            </span>
                        )}
                        {item.giftMerch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-100 text-pink-700">
                                <Gift className="h-2.5 w-2.5" /> {item.giftMerch}
                            </span>
                        )}
                        {item.membershipBonusOverride && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                <Crown className="h-2.5 w-2.5" /> Nhân đôi lộc
                            </span>
                        )}
                        {item.membershipConfig && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">
                                <Crown className="h-2.5 w-2.5" />
                                {(item.membershipConfig.basePoints ?? 0) + (item.membershipConfig.bonusPoints ?? 0)} điểm
                            </span>
                        )}
                    </div>
                )}

                {/* Description preview / toggle */}
                {item.description && (
                    <div
                        className="cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                    >
                        <p className={`text-gray-500 text-xs leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
                            {item.description}
                        </p>
                        <span className="text-[10px] font-semibold mt-0.5 inline-block" style={{ color: accent.highlight }}>
                            {expanded ? "Thu gọn ▲" : "Xem thêm ▼"}
                        </span>
                    </div>
                )}

                {/* Expanded details */}
                {expanded && (
                    <div className="space-y-2 text-xs animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Voucher detail */}
                        {item.giftVoucher && (
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-violet-50 border border-violet-100">
                                <Tag className="h-3.5 w-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-violet-700">Tặng voucher: {item.giftVoucher.templateName}</p>
                                    <p className="text-violet-500 text-[10px]">
                                        {item.giftVoucher.distribution === "perProduct" ? "1 voucher/sản phẩm mua" : "1 voucher/đơn hàng"}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Membership detail */}
                        {item.membershipConfig && (
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-50 border border-yellow-100">
                                <Crown className="h-3.5 w-3.5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-yellow-800">Thẻ thành viên</p>
                                    <p className="text-yellow-600 text-[10px]">
                                        {item.membershipConfig.basePoints ?? 0} điểm gốc
                                        {(item.membershipConfig.bonusPoints ?? 0) > 0 && ` + ${item.membershipConfig.bonusPoints} bonus`}
                                        {item.membershipConfig.merch && ` · Quà: ${item.membershipConfig.merch}`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Merch gift detail */}
                        {item.giftMerch && (
                            <div className="flex items-start gap-2 p-2 rounded-lg bg-pink-50 border border-pink-100">
                                <Gift className="h-3.5 w-3.5 text-pink-500 mt-0.5 flex-shrink-0" />
                                <p className="font-bold text-pink-700">Quà tặng: {item.giftMerch}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Stock bar */}
                {/* {item.totalStock !== undefined && item.stockResetPeriod === "daily" && (
                    <StockBar totalStock={item.totalStock} soldCount={item.soldCount} highlight={accent.highlight} />
                )} */}

                {item.maxQtyPerOrder === 1 && (
                    <p className="text-[10px] text-gray-400 italic">⚠ Tối đa 1 sp/đơn</p>
                )}

                {/* Divider */}
                <div className="h-px bg-gray-100" />

                {/* Price + CTA */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col">
                        <span
                            className="text-xl font-extrabold leading-none"
                            style={{ color: accent.highlight }}
                        >
                            {vnd(item.effectivePrice)}
                        </span>
                        {item.effectivePrice < item.originalPrice && (
                            <span className="text-[11px] text-gray-400 line-through mt-0.5">
                                {vnd(item.originalPrice)}
                            </span>
                        )}
                    </div>

                    <button
                        onClick={handleAddToCart}
                        disabled={isDisabled || pending}
                        aria-label={`Thêm ${item.name} vào giỏ hàng`}
                        className="btn-bounce flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={
                            added
                                ? { background: "#10B981", color: "#fff", boxShadow: "0 4px 12px rgba(16,185,129,0.35)" }
                                : isDisabled
                                ? { background: "#F3F4F6", color: "#9CA3AF" }
                                : {
                                    background: `linear-gradient(135deg, ${accent.highlight}, ${accent.highlight}cc)`,
                                    color: "#fff",
                                    boxShadow: `0 4px 14px ${accent.highlight}44`,
                                }
                        }
                    >
                        {pending    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : added     ? <><Check className="h-3.5 w-3.5" /> Đã thêm</>
                        : isSoldOut ? "Hết hàng"
                        : isLocked  ? <><Clock className="h-3.5 w-3.5" /> {opensAt}</>
                        :             <><ShoppingCart className="h-3.5 w-3.5" /> Mua ngay</>}
                    </button>
                </div>
            </div>
        </article>
    );
});
