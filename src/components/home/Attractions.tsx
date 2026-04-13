import React from "react";
import Image from "next/image";
import { Sparkles, Image as ImageIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getAttractionsGallery } from "@/actions/gallery";

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

    // Fallback to placeholders if admin hasn't added pictures
    const rawImages = fetchedImages.length > 0 ? fetchedImages : PLACEHOLDER_IMAGES;

    // Split into 2 rows for a deeper masonry effect
    const row1Images = rawImages.filter((_, i) => i % 2 === 0);
    const row2Images = rawImages.filter((_, i) => i % 2 !== 0);

    // Duplicate sets enough times to ensure screen overflow for the marquee mathematical loop
    const set1 = [...row1Images, ...row1Images, ...row1Images, ...row1Images];
    const set2 = [...row2Images, ...row2Images, ...row2Images, ...row2Images];

    return (
        <section
            id="attractions"
            className="relative py-20 overflow-hidden bg-white"
        >
            {/* Inline keyframes for the marquee since it's zero-config */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee-slow {
                    animation: marquee 60s linear infinite;
                }
                .animate-marquee-fast {
                    animation: marquee 45s linear infinite;
                }
                .animate-marquee-slower-reverse {
                    animation: marquee 70s linear infinite reverse;
                }
                .gallery-row:hover .marquee-content {
                    animation-play-state: paused;
                }
            `}} />

            {/* Decorative background blobs */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-50"
                style={{ background: "radial-gradient(circle, rgba(255,209,0,0.08) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />

            <div className="relative max-w-7xl mx-auto px-6 mb-12">
                {/* ── Section Header ─────────────────────────────── */}
                <div className="text-center">
                    <h2 className="font-extrabold tracking-tight mb-4 text-[2rem] md:text-[3rem] text-[#1A1A2E] leading-[1.1]">
                        Khám phá{" "}
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FFD100] to-[#FF7900]">
                            B.Duck Funland
                        </span>
                    </h2>

                    <p className="text-gray-500 text-base lg:text-lg max-w-2xl mx-auto leading-relaxed">
                        Cùng chiêm ngưỡng những không gian rực rỡ và các góc vui chơi đầy sắc màu tại công viên B.Duck Cityfuns.
                    </p>
                </div>
            </div>

            {/* ── Auto Scrolling Masonry Gallery ────────────────────────────── */}
            <div className="relative w-full flex flex-col gap-4 md:gap-6 mt-10">
                {/* Row 1 */}
                <div className="gallery-row relative flex overflow-hidden w-full h-40 md:h-64 group">
                    <div className="marquee-content flex gap-4 md:gap-6 w-max animate-marquee-fast">
                        {/* Render twice for the 0% to -50% seamless loop */}
                        <div className="flex gap-4 md:gap-6">
                            {set1.map((url, idx) => (
                                <GalleryImage key={idx} url={url} idx={idx} />
                            ))}
                        </div>
                        <div className="flex gap-4 md:gap-6">
                            {set1.map((url, idx) => (
                                <GalleryImage key={`dup-${idx}`} url={url} idx={idx} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Row 2 */}
                <div className="gallery-row relative flex overflow-hidden w-full h-40 md:h-64 group mt-2 md:mt-0">
                    {/* Starts shifted to create an offbeat masonry look */}
                    <div className="marquee-content flex gap-4 md:gap-6 w-max animate-marquee-slower-reverse pl-12 lg:pl-32">
                        <div className="flex gap-4 md:gap-6">
                            {set2.map((url, idx) => (
                                <GalleryImage key={idx} url={url} idx={idx} />
                            ))}
                        </div>
                        <div className="flex gap-4 md:gap-6">
                            {set2.map((url, idx) => (
                                <GalleryImage key={`dup-${idx}`} url={url} idx={idx} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Left/Right Overlays to create a fade out effect near edges */}
                <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
                <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            </div>
        </section>
    );
}

function GalleryImage({ url, idx }: { url: string; idx: number }) {
    // Generate organic aspect ratios for masonry feel
    const aspectRatios = ["aspect-[4/3]", "aspect-[3/4]", "aspect-square", "aspect-[16/9]", "aspect-[4/5]"];
    const aspect = aspectRatios[idx % aspectRatios.length];

    return (
        <div className={`relative h-full ${aspect} rounded-2xl md:rounded-3xl overflow-hidden shadow-sm flex-shrink-0 border border-gray-100 bg-gray-50 transform transition-transform duration-500 hover:scale-[1.03] hover:z-20 hover:shadow-2xl`}>
            <Image
                src={url}
                alt="B.Duck Funland"
                fill
                className="object-cover cursor-pointer hover:brightness-110 transition-all duration-300"
                unoptimized
            />
            {/* Soft inset shadow */}
            <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl md:rounded-3xl pointer-events-none" />
        </div>
    );
}
