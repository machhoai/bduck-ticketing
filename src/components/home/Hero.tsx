"use client";

import React from "react";
import Image from "next/image";
import { Ticket, ChevronDown, Star, Users, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

/* ── Hero Section ─────────────────────────────────────────────── */
export function Hero() {
    const t = useTranslations("hero");

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 80;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    };

    return (
        <section
            id="home"
            className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
        >
            {/* ── Full-screen background video ─────────────────── */}
            <div className="absolute inset-0 z-0">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster="/images/bduck_summer_backdrop.png"
                    className="w-full h-full object-cover"
                >
                    <source src="/videos/hero-bduck-video.mp4" type="video/mp4; codecs=avc1.42E01E,mp4a.40.2" />
                    <source src="/videos/hero-bduck-video.webm" type="video/webm; codecs=vp9,opus" />
                </video>

                {/* Cinematic gradient overlays */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

                {/* Warm brand tint at bottom */}
                <div
                    className="absolute bottom-0 left-0 right-0 h-48"
                    style={{
                        background: "linear-gradient(to top, rgba(255,209,0,0.18) 0%, transparent 100%)",
                    }}
                />
            </div>

            {/* ── Animated ambient blobs ─────────────────────── */}
            <div
                className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none animate-blob"
                style={{
                    background: "radial-gradient(circle, rgba(255,209,0,0.22) 0%, transparent 70%)",
                    filter: "blur(60px)",
                }}
            />
            <div
                className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full pointer-events-none animate-blob-delayed"
                style={{
                    background: "radial-gradient(circle, rgba(255,121,0,0.18) 0%, transparent 70%)",
                    filter: "blur(60px)",
                }}
            />

            {/* ── Main content ──────────────────────────────────── */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-28 pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-6 items-center">

                    {/* ── Left: Text content ──────────────────────── */}
                    <div className="lg:col-span-7 flex flex-col gap-6 animate-fade-up">

                        {/* Badge
                        <div className="inline-flex w-fit">
                            <span
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border"
                                style={{
                                    background: "rgba(255,209,0,0.15)",
                                    backdropFilter: "blur(16px)",
                                    WebkitBackdropFilter: "blur(16px)",
                                    borderColor: "rgba(255,209,0,0.4)",
                                    color: "#FFD100",
                                    fontFamily: "var(--font-heading)",
                                }}
                            >
                                <span className="w-2 h-2 rounded-full bg-duck-yellow animate-pulse" style={{ boxShadow: "0 0 8px rgba(255,209,0,0.9)" }} />
                                {t("badge")}
                            </span>
                        </div> */}

                        {/* Headline */}
                        <h1
                            className="font-[800] text-white leading-[1.08] tracking-tight"
                            style={{
                                fontFamily: "var(--font-heading)",
                                fontSize: "clamp(1.8rem, 5.5vw, 4.2rem)",
                            }}
                        >
                            {t("title1")}{" "}
                            <span
                                style={{
                                    background: "linear-gradient(135deg, #FFD100 0%, #FFB300 50%, #FF7900 100%)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                    display: "inline",
                                }}
                                className="truncate"
                            >
                                {t("titleHighlight1")}
                            </span>

                            <br />
                            {t("title2")}{" "}
                            <span
                                style={{
                                    background: "linear-gradient(135deg, #FF7900 0%, #FF5252 100%)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                    backgroundClip: "text",
                                    display: "inline",
                                }}
                                className="truncate"
                            >
                                {t("titleHighlight2")}
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p
                            className="text-white/75 leading-relaxed max-w-xl"
                            style={{ fontSize: "clamp(1rem, 1.5vw, 1.15rem)" }}
                        >
                            {t("subtitle")}
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => scrollTo("tickets")}
                                className="btn-bounce group cursor-pointer inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-full font-bold text-text-primary text-sm"
                                style={{
                                    fontFamily: "var(--font-heading)",
                                    background: "linear-gradient(135deg, #FFD100 0%, #FFC000 60%, #FF9500 100%)",
                                    boxShadow: "0 4px 24px rgba(255,196,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
                                }}
                            >
                                <Ticket className="w-4 h-4 transition-transform group-hover:rotate-12" />
                                {t("ctaPrimary")}
                            </button>

                            <button
                                onClick={() => scrollTo("attractions")}
                                className="btn-bounce inline-flex cursor-pointer items-center justify-center gap-2.5 px-8 py-4 rounded-full font-semibold text-white text-sm border"
                                style={{
                                    fontFamily: "var(--font-heading)",
                                    background: "rgba(255,255,255,0.12)",
                                    backdropFilter: "blur(20px)",
                                    WebkitBackdropFilter: "blur(20px)",
                                    borderColor: "rgba(255,255,255,0.25)",
                                }}
                            >
                                {t("ctaSecondary")}
                            </button>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-0 mt-2 justify-center sm:justify-start">
                            <StatItem icon={<Zap className="w-4 h-4 text-duck-yellow" />} number="10+" label={t("statGames")} />
                            <div className="w-px self-stretch mx-6" style={{ background: "rgba(255,255,255,0.2)" }} />
                            <StatItem icon={<Users className="w-4 h-4 text-duck-yellow" />} number="50K+" label={t("statVisitors")} />
                            <div className="w-px self-stretch mx-6" style={{ background: "rgba(255,255,255,0.2)" }} />
                            <StatItem icon={<Star className="w-4 h-4 text-duck-yellow fill-duck-yellow" />} number="4.9" label={t("statRating")} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Scroll indicator ─────────────────────────────── */}
            <button
                onClick={() => scrollTo("attractions")}
                aria-label="Cuộn xuống xem trò chơi"
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 text-white/60 hover:text-white/90 transition-colors cursor-pointer"
            >
                <span
                    className="text-xs tracking-widest uppercase"
                    style={{ fontFamily: "var(--font-heading)", fontSize: "0.65rem", letterSpacing: "0.18em" }}
                >
                    Khám phá
                </span>
                <ChevronDown className="w-5 h-5 animate-bounce" strokeWidth={1.5} />
            </button>
        </section>
    );
}

/* ── Sub-components ──────────────────────────────────────────── */

interface StatItemProps {
    icon: React.ReactNode;
    number: string;
    label: string;
}

function StatItem({ icon, number, label }: StatItemProps) {
    return (
        <div className="flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5">
                {icon}
                <span
                    className="font-extrabold text-white text-xl lg:text-2xl leading-none"
                    style={{ fontFamily: "var(--font-heading)" }}
                >
                    {number}
                </span>
            </div>
            <span className="text-white/50 text-xs leading-none">{label}</span>
        </div>
    );
}

