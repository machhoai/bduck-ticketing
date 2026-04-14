import React from "react";
import { getTranslations } from "next-intl/server";
import { getAttractionsGallery } from "@/actions/gallery";
import { MarqueeGallery } from "@/components/home/MarqueeGallery";

const PLACEHOLDER_IMAGES = [
    "https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1549416878-b9ca95e26903?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1605335446059-4bbec242e20b?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1606041014876-1f6920f04c6e?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1579737194600-e9c12b772c72?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1596489389808-01ca4da973ae?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1628178121650-70fbf1e2e987?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1563857319340-9d0dce8382ba?q=80&w=800&auto=format&fit=crop"
];

export async function Attractions() {
    const t = await getTranslations("attractions");
    const fetchedImages = await getAttractionsGallery();

    const rawImages = fetchedImages.length > 0 ? fetchedImages : PLACEHOLDER_IMAGES;

    // Split into 2 rows — only 2 copies needed for the -50% seamless loop
    const row1 = rawImages.filter((_, i) => i % 2 === 0);
    const row2 = rawImages.filter((_, i) => i % 2 !== 0);

    return (
        <section
            id="attractions"
            className="relative py-4 pt-16 overflow-hidden bg-white"
        >
            {/* Decorative background blob */}
            <div
                className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-50"
                style={{
                    background: "radial-gradient(circle, rgba(255,209,0,0.08) 0%, transparent 70%)",
                    transform: "translate3d(30%, -30%, 0)",
                }}
            />

            {/* ── Section Header ── */}
            <div className="relative max-w-7xl mx-auto px-6 mb-12">
                <div className="text-center">
                    <h2 className="font-extrabold tracking-tight mb-4 text-[2rem] md:text-[3rem] text-[#1A1A2E] leading-[1.1]">
                        {t("title")}{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FFD100] to-[#FF7900]">
                            {t("titleHighlight")}
                        </span>
                    </h2>
                    <p className="text-gray-500 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
                        {t("subtitle")}
                    </p>
                </div>
            </div>

            {/* ── Marquee Gallery (Client Component — handles hover pause/resume) ── */}
            <MarqueeGallery row1={row1} row2={row2} />
        </section>
    );
}
