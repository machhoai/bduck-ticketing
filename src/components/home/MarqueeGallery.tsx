import Image from "next/image";

interface MarqueeGalleryProps {
    row1: string[];
    row2: string[];
}

const ASPECT_RATIOS = [
    "aspect-[4/3]",
    "aspect-[3/4]",
    "aspect-square",
    "aspect-[16/9]",
    "aspect-[4/5]",
] as const;

function ImageRow({ images, rowKey }: { images: string[]; rowKey: string }) {
    return (
        <div className="flex gap-4 md:gap-6 flex-shrink-0">
            {images.map((url, idx) => {
                const aspect = ASPECT_RATIOS[idx % ASPECT_RATIOS.length];
                return (
                    <div
                        key={`${rowKey}-${idx}`}
                        className={`relative h-full ${aspect} rounded-2xl md:rounded-3xl overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50`}
                    >
                        <Image
                            src={url}
                            alt="B.Duck Funland"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 160px, 256px"
                            unoptimized
                        />
                        <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl md:rounded-3xl pointer-events-none" />
                    </div>
                );
            })}
        </div>
    );
}

export function MarqueeGallery({ row1, row2 }: MarqueeGalleryProps) {
    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes marquee-ltr {
                    0%   { transform: translate3d(0, 0, 0); }
                    100% { transform: translate3d(-50%, 0, 0); }
                }
                @keyframes marquee-rtl {
                    0%   { transform: translate3d(-50%, 0, 0); }
                    100% { transform: translate3d(0, 0, 0); }
                }
                .marquee-track {
                    display: flex;
                    width: max-content;
                    transform: translateZ(0);
                    backface-visibility: hidden;
                }
                .marquee-track--fwd {
                    animation: marquee-ltr 40s linear infinite;
                }
                .marquee-track--rev {
                    animation: marquee-rtl 55s linear infinite;
                }
            `}} />

            <div className="relative w-full flex flex-col gap-4 md:gap-6 mt-10">
                {/* Row 1 — LTR */}
                <div
                    className="relative flex overflow-hidden w-full h-40 md:h-64"
                    style={{ contain: "layout style" }}
                >
                    <div className="marquee-track marquee-track--fwd">
                        <ImageRow images={row1} rowKey="r1a" />
                        <ImageRow images={row1} rowKey="r1b" />
                    </div>
                </div>

                {/* Row 2 — RTL */}
                <div
                    className="relative flex overflow-hidden w-full h-40 md:h-64"
                    style={{ contain: "layout style" }}
                >
                    <div className="marquee-track marquee-track--rev">
                        <ImageRow images={row2} rowKey="r2a" />
                        <ImageRow images={row2} rowKey="r2b" />
                    </div>
                </div>

                {/* Edge fade overlays */}
                <div className="absolute inset-y-0 left-0 w-8 md:w-32 bg-gradient-to-r from-white to-transparent pointer-events-none z-10" />
                <div className="absolute inset-y-0 right-0 w-8 md:w-32 bg-gradient-to-l from-white to-transparent pointer-events-none z-10" />
            </div>
        </>
    );
}
