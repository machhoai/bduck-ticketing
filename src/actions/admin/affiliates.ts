"use server";

import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { AffiliateProfileDocument } from "@/types/firestore";

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Get Affiliate Applications ───────────────────────────────────────────────
export async function getAffiliateApplications(
  status?: "pending" | "approved" | "rejected" | "suspended"
): Promise<AffiliateProfileDocument[]> {
  await requireAdmin();

  let query = adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .orderBy("appliedAt", "desc");

  if (status) {
    query = query.where("applicationStatus", "==", status) as typeof query;
  }

  const snap = await query.get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<AffiliateProfileDocument, "id">),
  }));
}

// ─── Approve Affiliate ────────────────────────────────────────────────────────
/**
 * Approves an affiliate application:
 * 1. Updates Firestore profile to 'approved'
 * 2. Sets Firebase custom claims role='affiliate' so auth guards work
 */
export async function approveAffiliate(
  uid: string,
  commissionRate: number
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  if (commissionRate < 0 || commissionRate > 1) {
    return { success: false, error: "Commission rate phải từ 0 đến 1 (e.g. 0.1 = 10%)" };
  }

  const profileRef = adminDb.collection(COLLECTIONS.AFFILIATE_PROFILES).doc(uid);
  const profileDoc = await profileRef.get();

  if (!profileDoc.exists) {
    return { success: false, error: "Không tìm thấy hồ sơ affiliate" };
  }

  // Update Firestore profile
  await profileRef.update({
    applicationStatus: "approved",
    defaultCommissionRate: commissionRate,
    approvedAt: Timestamp.now(),
    approvedBy: session.uid,
    updatedAt: Timestamp.now(),
  });

  // Update users collection role
  await adminDb.collection(COLLECTIONS.USERS).doc(uid).update({
    role: "affiliate",
    updatedAt: Timestamp.now(),
  });

  // Set Firebase custom claims so useRequireRole() works client-side
  await adminAuth.setCustomUserClaims(uid, { role: "affiliate" });

  return { success: true };
}

// ─── Reject Affiliate ─────────────────────────────────────────────────────────
export async function rejectAffiliate(
  uid: string,
  reason: string
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .doc(uid)
    .update({
      applicationStatus: "rejected",
      rejectedAt: Timestamp.now(),
      rejectedBy: session.uid,
      rejectionReason: reason,
      updatedAt: Timestamp.now(),
    });

  return { success: true };
}

// ─── Suspend Affiliate ────────────────────────────────────────────────────────
export async function suspendAffiliate(uid: string): Promise<AdminActionResult> {
  const session = await requireAdmin();

  // Update Firestore
  await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .doc(uid)
    .update({
      applicationStatus: "suspended",
      suspendedAt: Timestamp.now(),
      suspendedBy: session.uid,
      updatedAt: Timestamp.now(),
    });

  // Revoke Firebase custom claims
  await adminAuth.setCustomUserClaims(uid, { role: "customer" });

  return { success: true };
}
