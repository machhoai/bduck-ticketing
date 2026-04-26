"use client";

/**
 * DealStatusPill — Client Component
 * Shows live countdown to deal opening time, then flips to "Đang mở bán".
 * Uses Vietnam timezone explicitly (works even if browser TZ is different).
 */

import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";

interface DealStatusPillProps {
    /** "HH:MM" format, e.g. "10:00". null = no time gate (always open) */
    opensAt: string | null;
    /** Server-side initial evaluation */
    initialIsOpen: boolean;
}

const VN_TZ = "Asia/Ho_Chi_Minh";

function getVietnamNow(): Date {
    // Get the current time string in Vietnam, then parse it back
    const vnStr = new Date().toLocaleString("en-US", { timeZone: VN_TZ });
    return new Date(vnStr);
}

/**
 * Returns seconds remaining until opensAt (in Vietnam TZ).
 * Negative = already open.
 */
function getSecondsUntilOpen(opensAt: string): number {
    const [h, m] = opensAt.split(":").map(Number);
    const vnNow = getVietnamNow();
    const openMs = h * 3600_000 + m * 60_000;
    const nowMs =
        vnNow.getHours() * 3600_000 +
        vnNow.getMinutes() * 60_000 +
        vnNow.getSeconds() * 1000;
    return Math.floor((openMs - nowMs) / 1000);
}

export function DealStatusPill({ opensAt, initialIsOpen }: DealStatusPillProps) {
    const t = useTranslations("deals");
    const [isOpen, setIsOpen] = useState(initialIsOpen);
    const [countdown, setCountdown] = useState("");

    const updateCountdown = useCallback(() => {
        if (!opensAt) return;
        const secs = getSecondsUntilOpen(opensAt);
        if (secs <= 0) {
            setIsOpen(true);
            setCountdown("");
        } else {
            setIsOpen(false);
            const h = Math.floor(secs / 3600);
            const m = Math.floor((secs % 3600) / 60);
            const s = secs % 60;
            if (h > 0) {
                setCountdown(
                    `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                );
            } else {
                setCountdown(
                    `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                );
            }
        }
    }, [opensAt]);

    useEffect(() => {
        if (!opensAt) return;
        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [opensAt, updateCountdown]);

    if (!opensAt) return null;

    if (isOpen) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t("statusOpen")}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
            <Clock className="h-3 w-3" />
            {countdown ? (
                <>
                    {t("opensIn")}{" "}
                    <span className="font-mono font-bold text-amber-600 tabular-nums">
                        {countdown}
                    </span>
                </>
            ) : (
                <>{t("opensAtTime", { time: opensAt })}</>
            )}
        </span>
    );
}
