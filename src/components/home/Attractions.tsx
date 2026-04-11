"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Clock, Users, Sparkles, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

/* ── Types ───────────────────────────────────────────────────── */
interface Attraction {
    key: string;
    decor: string;
    accentColor: string;
    accentBg: string;
    glowColor: string;
    imagePosition: string;
    badge?: "popular" | "new" | "hot";
}

/* ── Data ────────────────────────────────────────────────────── */
const ATTRACTIONS: Attraction[] = [
    {
        key: "ballPit",
        decor: "🌟",
        accentColor: "#FF9800",
        accentBg: "rgba(255,209,0,0.12)",
        glowColor: "rgba(255,209,0,0.3)",
        imagePosition: "object-[left_top]",
        badge: "popular",
    },
    {
        key: "rollerCoaster",
        decor: "🎢",
        accentColor: "#0288D1",
        accentBg: "rgba(2,136,209,0.1)",
        glowColor: "rgba(2,136,209,0.25)",
        imagePosition: "object-center",
        badge: "new",
    },
    {
        key: "carousel",
        decor: "🎠",
        accentColor: "#D81B60",
        accentBg: "rgba(216,27,96,0.08)",
        glowColor: "rgba(216,27,96,0.2)",
        imagePosition: "object-right",
    },
    {
        key: "waterSplash",
        decor: "💦",
        accentColor: "#00897B",
        accentBg: "rgba(0,137,123,0.1)",
        glowColor: "rgba(0,137,123,0.25)",
        imagePosition: "object-[left_center]",
    },
    {
        key: "climbCastle",
        decor: "🏰",
        accentColor: "#FF5722",
        accentBg: "rgba(255,87,34,0.1)",
        glowColor: "rgba(255,87,34,0.3)",
        imagePosition: "object-center",
        badge: "hot",
    },
    {
        key: "bumperCar",
        decor: "🚗",
        accentColor: "#7B1FA2",
        accentBg: "rgba(123,31,162,0.1)",
        glowColor: "rgba(123,31,162,0.25)",
        imagePosition: "object-[right_center]",
    },
];

/* ── Badge config ────────────────────────────────────────────── */
const BADGE_CONFIG = {
    popular: { label: "Phổ biến", style: { background: "linear-gradient(135deg,#FFD100,#FF9800)", color: "#1A1A2E" } },
    new:     { label: "Mới",      style: { background: "linear-gradient(135deg,#29B6F6,#0288D1)", color: "#fff" } },
    hot:     { label: "Hot 🔥",   style: { background: "linear-gradient(135deg,#FF7043,#FF1744)", color: "#fff" } },
};

/* ── Attractions Section ─────────────────────────────────────── */
export function Attractions() {
    const t = useTranslations("attractions");

    return (
        <section
            id="attractions"
            className="relative py-24 lg:py-32 overflow-hidden"
            style={{ background: "linear-gradient(180deg, #FFFDF5 0%, #F7F8FA 100%)" }}
        >
            {/* Decorative background blobs */}
            <div
                className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
                style={{
                    background: "radial-gradient(circle, rgba(255,209,0,0.08) 0%, transparent 70%)",
                    transform: "translate(30%, -30%)",
                }}
            />
            <div
                className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{
                    background: "radial-gradient(circle, rgba(255,121,0,0.06) 0%, transparent 70%)",
                    transform: "translate(-30%, 30%)",
                }}
            />

            <div className="relative max-w-7xl mx-auto px-6">
                {/* ── Section Header ─────────────────────────────── */}
                <div className="text-center mb-16">
                    {/* Badge pill */}
                    <div className="inline-flex mb-5">
                        <span
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border"
                            style={{
                                background: "rgba(255,209,0,0.12)",
                                borderColor: "rgba(255,209,0,0.35)",
                                color: "#CC7A00",
                                fontFamily: "var(--font-heading)",
                            }}
                        >
                            <Sparkles className="w-4 h-4" />
                            {t("badge")}
                        </span>
                    </div>

                    <h2
                        className="font-extrabold tracking-tight mb-4"
                        style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "clamp(2rem, 4vw, 3.2rem)",
                            color: "#1A1A2E",
                            lineHeight: 1.1,
                        }}
                    >
                        {t("title")}{" "}
                        <span
                            style={{
                                background: "linear-gradient(135deg, #FFD100 0%, #FF7900 100%)",
                                WebkitBackgroundClip: "text",
                                WebkitTextFillColor: "transparent",
                                backgroundClip: "text",
                            }}
                        >
                            {t("titleHighlight")}
                        </span>
                    </h2>

                    <p className="text-text-secondary text-base lg:text-lg max-w-lg mx-auto leading-relaxed">
                        {t("subtitle")}
                    </p>
                </div>

                {/* ── Attractions Grid ────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
                    {ATTRACTIONS.map((attraction, idx) => (
                        <AttractionCard
                            key={attraction.key}
                            attraction={attraction}
                            index={idx}
                            t={t}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ── AttractionCard ──────────────────────────────────────────── */
interface AttractionCardProps {
    attraction: Attraction;
    index: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: any;
}

function AttractionCard({ attraction, index, t }: AttractionCardProps) {
    const [hovered, setHovered] = useState(false);
    const badge = attraction.badge ? BADGE_CONFIG[attraction.badge] : null;
    const itemKey = `items.${attraction.key}`;

    return (
        <div
            className="group relative flex flex-col rounded-[28px] overflow-hidden cursor-pointer"
            style={{
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: hovered
                    ? `0 20px 60px ${attraction.glowColor}, 0 8px 24px rgba(0,0,0,0.08)`
                    : "0 2px 16px rgba(0,0,0,0.05)",
                transform: hovered ? "translateY(-6px)" : "translateY(0)",
                transition: "all 380ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                animationDelay: `${index * 80}ms`,
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* ── Image zone ─────────────────────────────────── */}
            <div
                className="relative overflow-hidden"
                style={{ height: "210px", background: attraction.accentBg }}
            >
                <Image
                    src="/images/attractions-grid.png"
                    alt={t(`${itemKey}.title`)}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={`object-cover ${attraction.imagePosition}`}
                    style={{
                        transform: hovered ? "scale(1.07)" : "scale(1)",
                        transition: "transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                    }}
                    loading="lazy"
                />

                {/* Gradient overlay bottom of image */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                    style={{
                        background: "linear-gradient(to top, rgba(255,255,255,0.95) 0%, transparent 100%)",
                    }}
                />

                {/* Badge */}
                {badge && (
                    <span
                        className="absolute top-3.5 left-3.5 px-3 py-1.5 rounded-full font-bold text-[11px] tracking-wide"
                        style={{
                            ...badge.style,
                            fontFamily: "var(--font-heading)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                        }}
                    >
                        {badge.label}
                    </span>
                )}

                {/* Decor emoji */}
                <span
                    className="absolute top-3 right-3 text-2xl pointer-events-none select-none"
                    style={{
                        transform: hovered ? "scale(1.25) rotate(10deg)" : "scale(1) rotate(0deg)",
                        transition: "transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.15))",
                    }}
                >
                    {attraction.decor}
                </span>
            </div>

            {/* ── Card body ──────────────────────────────────── */}
            <div className="flex flex-col flex-1 p-6 pt-4">
                {/* Title */}
                <h3
                    className="font-extrabold text-[#1A1A2E] text-lg mb-1.5 leading-snug"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    {t(`${itemKey}.title`)}
                </h3>

                {/* Description */}
                <p className="text-text-secondary text-sm leading-relaxed mb-4 flex-1">
                    {t(`${itemKey}.description`)}
                </p>

                {/* Meta row */}
                <div
                    className="flex items-center justify-between pt-4"
                    style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
                >
                    <div className="flex items-center gap-4">
                        <MetaChip
                            icon={<Users className="w-3.5 h-3.5" />}
                            label={t(`${itemKey}.age`)}
                            color={attraction.accentColor}
                        />
                        <MetaChip
                            icon={<Clock className="w-3.5 h-3.5" />}
                            label={t(`${itemKey}.duration`)}
                            color={attraction.accentColor}
                        />
                    </div>

                    {/* Explore arrow */}
                    <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                            background: hovered ? attraction.accentColor : "rgba(0,0,0,0.05)",
                            color: hovered ? "#fff" : "#9CA3AF",
                            transition: "all 300ms ease",
                        }}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* ── Accent side bar ─────────────────────────────── */}
            <div
                className="absolute top-0 left-0 w-1 h-full rounded-l-[28px]"
                style={{
                    background: `linear-gradient(180deg, ${attraction.accentColor} 0%, transparent 100%)`,
                    opacity: hovered ? 1 : 0,
                    transition: "opacity 300ms ease",
                }}
            />
        </div>
    );
}

/* ── MetaChip ────────────────────────────────────────────────── */
interface MetaChipProps {
    icon: React.ReactNode;
    label: string;
    color: string;
}

function MetaChip({ icon, label, color }: MetaChipProps) {
    return (
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <span style={{ color }}>{icon}</span>
            <span>{label}</span>
        </div>
    );
}
