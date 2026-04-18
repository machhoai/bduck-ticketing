"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { AffiliateProfileDocument, PayoutRequestDocument } from "@/types/firestore";

// ─── Get Affiliate Stats ──────────────────────────────────────────────────────
/**
 * Returns clicks, conversions, wallet balance, and commission summary
 * for the currently authenticated affiliate.
 */
export async function getAffiliateStats(): Promise<{
  profile: AffiliateProfileDocument;
  recentConversions: { orderId: string; amount: number; commission: number; date: Date }[];
}> {
  const session = await requireAuth();
  const uid = session.uid;

  // Get profile by userId (doc ID is auto-generated, userId is set after approval)
  const profileSnap = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .where("userId", "==", uid)
    .limit(1)
    .get();

  if (profileSnap.empty) {
    throw new Error("Affiliate profile not found");
  }

  const profileDoc = profileSnap.docs[0];
  const profile = {
    id: profileDoc.id,
    ...(profileDoc.data() as Omit<AffiliateProfileDocument, "id">),
  };

  // Get last 10 paid orders attributed to this affiliate
  const ordersSnap = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("affiliateId", "==", uid)
    .where("status", "==", "paid")
    .orderBy("paidAt", "desc")
    .limit(10)
    .get();

  const recentConversions = ordersSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      orderId: doc.id,
      amount: data.finalAmount as number,
      commission: (data.affiliateCommissionAmount as number) ?? 0,
      date: (data.paidAt?.toDate?.() as Date) ?? new Date(),
    };
  });

  return { profile, recentConversions };
}
