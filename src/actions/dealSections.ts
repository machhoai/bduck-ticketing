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

    // NOTE: no compound orderBy here to avoid composite index requirement.
    // Firestore allows a single-field filter + fetch-all pattern; we sort client-side.
    const snap = await adminDb
        .collection(COLLECTIONS.DEAL_SECTIONS)
        .where("isActive", "==", true)
        .get();

    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as DealSectionDocument))
        .filter((section) => {
            if (section.startAt && now.toMillis() < section.startAt.toMillis()) return false;
            if (section.endAt && now.toMillis() > section.endAt.toMillis()) return false;
            return true;
        })
        // Client-side sort by order asc (avoids composite index)
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
            ...section,
            items: section.items
                .filter((item) => item.isActive)
                .sort((a, b) => a.order - b.order),
        }));
}

// checkDealSectionTimeGate has been moved to @/lib/dealUtils
// to avoid the "Server Actions must be async" constraint.
