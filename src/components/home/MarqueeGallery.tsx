"use client";

import Image from "next/image";
import { useState } from "react";

interface MarqueeGalleryProps {
    row1: string[];
    row2: string[];
}

// Fixed card widths — avoids aspect-ratio class issues in Safari/WebKit
const CARD_WIDTHS = [192, 144, 160, 224, 152] as const;

// Static CSS string — avoids dangerouslySetInnerHTML and runtime style injection
const MARQUEE_CSS = `
@keyframes bduck-marquee-ltr {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
}
@keyframes bduck-marquee-rtl {
    from { transform: translateX(-50%); }
    to   { transform: translateX(0); }
}
.bduck-marquee-track {
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
    width: max-content;
    will-change: transform;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    transform: translate3d(0, 0, 0);
}
.bduck-marquee-fwd {
    animation: bduck-marquee-ltr 40s linear infinite;
}
.bduck-marquee-rev {
    animation: bduck-marquee-rtl 55s linear infinite;
}
.bduck-marquee-track:hover,
.bduck-marquee-track:focus-within {
    animation-play-state: paused;
}
`;

interface ImageRowProps {
    images: string[];
    rowKey: string;
    heightClass: string;
}

function ImageRow({ images, rowKey, heightClass }: ImageRowProps) {
    return (
        <div className={`flex flex-row flex-nowrap items-stretch gap-3 md:gap-5 flex-shrink-0 ${heightClass}`}>
            {images.map((url, idx) => {
                const w = CARD_WIDTHS[idx % CARD_WIDTHS.length];
                return (
                    <div
                        key={`${rowKey}-${idx}`}
                        className="relative flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100"
                        style={{ width: w }}
                    >
                        <Image
                            src={url}
                            alt="B.Duck Funland attraction"
                            fill
                            sizes={`${w}px`}
                            className="absolute inset-0 h-full w-full object-cover"
                            loading="lazy"
                        />
                        {/* subtle inset ring */}
                        <div
                            className="absolute inset-0 rounded-2xl pointer-events-none"
                            style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }}
                        />
                    </div>
                );
            })}
        </div>
    );
}

export function MarqueeGallery({ row1, row2 }: MarqueeGalleryProps) {
    const [paused, setPaused] = useState(false);

    return (
        <>
            {/* Static stylesheet — no dangerouslySetInnerHTML at runtime */}
            <style>{MARQUEE_CSS}</style>

            <div className="relative w-full flex flex-col gap-3 md:gap-5 mt-10" style={{ contain: "layout style paint" }}>
                {/* Row 1 — left-to-right */}
                <div
                    className="w-full overflow-hidden"
                    style={{ height: 160 }}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onTouchStart={() => setPaused(true)}
                    onTouchEnd={() => setPaused(false)}
                >
                    <div
                        className={`bduck-marquee-track bduck-marquee-fwd`}
                        style={{ animationPlayState: paused ? "paused" : "running", height: "100%" }}
                    >
                        <ImageRow images={row1} rowKey="r1a" heightClass="h-full" />
                        <ImageRow images={row1} rowKey="r1b" heightClass="h-full" />
                    </div>
                </div>

                {/* Row 2 — right-to-left */}
                <div
                    className="w-full overflow-hidden"
                    style={{ height: 160 }}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onTouchStart={() => setPaused(true)}
                    onTouchEnd={() => setPaused(false)}
                >
                    <div
                        className={`bduck-marquee-track bduck-marquee-rev`}
                        style={{ animationPlayState: paused ? "paused" : "running", height: "100%" }}
                    >
                        <ImageRow images={row2} rowKey="r2a" heightClass="h-full" />
                        <ImageRow images={row2} rowKey="r2b" heightClass="h-full" />
                    </div>
                </div>

                {/* Edge fade — left */}
                <div
                    className="absolute inset-y-0 left-0 z-10 pointer-events-none"
                    style={{ width: 48, background: "linear-gradient(to right, #fff 0%, transparent 100%)" }}
                />
                {/* Edge fade — right */}
                <div
                    className="absolute inset-y-0 right-0 z-10 pointer-events-none"
                    style={{ width: 48, background: "linear-gradient(to left, #fff 0%, transparent 100%)" }}
                />
            </div>
        </>
    );
}
