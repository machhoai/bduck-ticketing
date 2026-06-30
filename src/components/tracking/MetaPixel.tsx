"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

type MetaPixelProps = {
    pixelId: string;
};

declare global {
    interface Window {
        fbq?: (...args: unknown[]) => void;
        _fbq?: unknown;
    }
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
    const normalizedPixelId = pixelId.replace(/\D/g, "");
    const pathname = usePathname();
    const previousPath = useRef<string | null>(null);

    useEffect(() => {
        if (!normalizedPixelId || typeof window.fbq !== "function") {
            return;
        }

        if (previousPath.current === null) {
            previousPath.current = pathname;
            return;
        }

        if (previousPath.current !== pathname) {
            previousPath.current = pathname;
            window.fbq("track", "PageView");
        }
    }, [pathname, normalizedPixelId]);

    if (!normalizedPixelId) {
        return null;
    }

    return (
        <>
            <Script
                id="meta-pixel"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
                        !function(f,b,e,v,n,t,s)
                        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                        n.queue=[];t=b.createElement(e);t.async=!0;
                        t.src=v;s=b.getElementsByTagName(e)[0];
                        s.parentNode.insertBefore(t,s)}(window, document,'script',
                        'https://connect.facebook.net/en_US/fbevents.js');
                        fbq('init', '${normalizedPixelId}');
                        fbq('track', 'PageView');
                    `,
                }}
            />
            <noscript>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    height="1"
                    width="1"
                    style={{ display: "none" }}
                    src={`https://www.facebook.com/tr?id=${normalizedPixelId}&ev=PageView&noscript=1`}
                    alt=""
                />
            </noscript>
        </>
    );
}
