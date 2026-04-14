"use client";

import { useState, useCallback, useRef, type ReactNode, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface RippleWrapperProps {
    children: ReactNode;
    className?: string;
    /** Override ripple color — defaults to rgba(255,209,0,0.35) (B.Duck yellow) */
    color?: string;
    /** Max duration for the ripple expand animation in ms */
    duration?: number;
}

interface Ripple {
    id: number;
    x: number;
    y: number;
    size: number;
}

let rippleIdCounter = 0;

/**
 * Wraps any element to add a "ripple" effect on click/touch.
 * Uses pure CSS animations — no external deps.
 *
 * Design note: The ripple is B.Duck-yellow tinted by default to
 * tie into the brand palette without being too aggressive.
 */
export function RippleWrapper({
    children,
    className,
    color = "rgba(255, 209, 0, 0.35)",
    duration = 600,
}: RippleWrapperProps) {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    const createRipple = useCallback(
        (e: MouseEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Ripple should expand to cover the entire container from the click point
            const size = Math.max(
                Math.hypot(x, y),
                Math.hypot(rect.width - x, y),
                Math.hypot(x, rect.height - y),
                Math.hypot(rect.width - x, rect.height - y)
            ) * 2;

            const id = ++rippleIdCounter;
            setRipples((prev) => [...prev, { id, x, y, size }]);

            // Clean up after animation completes
            setTimeout(() => {
                setRipples((prev) => prev.filter((r) => r.id !== id));
            }, duration + 100);
        },
        [duration]
    );

    return (
        <div
            ref={containerRef}
            className={cn("relative overflow-hidden", className)}
            onMouseDown={createRipple}
        >
            {children}

            {/* Ripple elements */}
            {ripples.map((ripple) => (
                <span
                    key={ripple.id}
                    className="absolute rounded-full pointer-events-none z-30"
                    style={{
                        left: ripple.x - ripple.size / 2,
                        top: ripple.y - ripple.size / 2,
                        width: ripple.size,
                        height: ripple.size,
                        background: color,
                        transform: "scale(0)",
                        animation: `ripple-expand ${duration}ms ease-out forwards`,
                    }}
                />
            ))}
        </div>
    );
}
