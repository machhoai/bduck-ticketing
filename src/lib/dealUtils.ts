/**
 * Pure utility helpers for deal section logic.
 * NOT a "use server" file — safe to import from both Server and Client Components.
 */

import type { DealSectionDocument } from "@/types/firestore";

/** Vietnam timezone — used for all deal time-gate calculations */
const VN_TZ = "Asia/Ho_Chi_Minh";

/**
 * Get current hours and minutes in Vietnam timezone.
 * Works correctly on Vercel (UTC) and local dev alike.
 */
function getVietnamTime(): { hours: number; minutes: number } {
    const now = new Date();
    // Intl.DateTimeFormat gives us the correct local time parts in any TZ
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: VN_TZ,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
    }).formatToParts(now);

    const hours = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const minutes = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return { hours, minutes };
}

/**
 * Check whether a deal section's daily time gate is currently open.
 * Returns { isOpen, opensAt } — opensAt is null if no time gate configured.
 *
 * Uses Vietnam timezone (Asia/Ho_Chi_Minh) explicitly — works on Vercel (UTC).
 */
export function checkDealSectionTimeGate(section: DealSectionDocument): {
    isOpen: boolean;
    opensAt: string | null; // "HH:MM" format or null
} {
    if (section.dailyOpenHour === undefined) {
        return { isOpen: true, opensAt: null };
    }

    const { hours, minutes } = getVietnamTime();
    const openHour = section.dailyOpenHour;
    const openMinute = section.dailyOpenMinute ?? 0;

    const nowMinutes = hours * 60 + minutes;
    const openMinutes = openHour * 60 + openMinute;

    const opensAt = `${String(openHour).padStart(2, "0")}:${String(openMinute).padStart(2, "0")}`;

    return {
        isOpen: nowMinutes >= openMinutes,
        opensAt,
    };
}
