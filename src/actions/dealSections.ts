"use server";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { DealSectionDocument } from "@/types/firestore";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Fetch all active deal sections currently within their validity window.
 * Used on the public-facing homepage/deals page.
 * Ordered by section.order ascending (admin configures display priority).
 */
export async function getActiveDealSections(): Promise<DealSectionDocument[]> {
    const now = Timestamp.now();

    const snap = await adminDb
        .collection(COLLECTIONS.DEAL_SECTIONS)
        .where("isActive", "==", true)
        .orderBy("order", "asc")
        .get();

    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DealSectionDocument))
        .filter((section) => {
            // Filter by overall validity window server-side
            if (section.startAt && now.toMillis() < section.startAt.toMillis()) return false;
            if (section.endAt && now.toMillis() > section.endAt.toMillis()) return false;
            return true;
        })
        .map((section) => ({
            ...section,
            // Only expose active items, sorted by order
            items: section.items
                .filter((item) => item.isActive)
                .sort((a, b) => a.order - b.order),
        }));
}

/**
 * Check whether a deal section's daily time gate is currently open.
 * Returns { isOpen, opensAt } — opensAt is null if no time gate configured.
 * Pure utility used by server actions (checkout validation) and API routes.
 */
export function checkDealSectionTimeGate(section: DealSectionDocument): {
    isOpen: boolean;
    opensAt: string | null; // "10:00" format or null
} {
    if (section.dailyOpenHour === undefined) {
        return { isOpen: true, opensAt: null };
    }

    // Use server time (TZ=Asia/Ho_Chi_Minh must be set in Vercel env)
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
