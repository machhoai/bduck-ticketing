/**
 * Pure utility helpers for deal section logic.
 * NOT a "use server" file — safe to import from both Server and Client Components.
 */

import type { DealSectionDocument } from "@/types/firestore";

/**
 * Check whether a deal section's daily time gate is currently open.
 * Returns { isOpen, opensAt } — opensAt is null if no time gate configured.
 *
 * ⚠️ Requires TZ=Asia/Ho_Chi_Minh in Vercel env for correct server-time math.
 */
export function checkDealSectionTimeGate(section: DealSectionDocument): {
    isOpen: boolean;
    opensAt: string | null; // "HH:MM" format or null
} {
    if (section.dailyOpenHour === undefined) {
        return { isOpen: true, opensAt: null };
    }

    const now = new Date();
    const openHour = section.dailyOpenHour;
    const openMinute = section.dailyOpenMinute ?? 0;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openHour * 60 + openMinute;

    const opensAt = `${String(openHour).padStart(2, "0")}:${String(openMinute).padStart(2, "0")}`;

    return {
        isOpen: nowMinutes >= openMinutes,
        opensAt,
    };
}
