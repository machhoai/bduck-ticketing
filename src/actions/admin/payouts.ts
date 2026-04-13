"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { PayoutRequestDocument } from "@/types/firestore";

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Get Payout Requests ──────────────────────────────────────────────────────
export async function getPayoutRequests(
  status?: "pending" | "approved" | "completed" | "rejected"
): Promise<PayoutRequestDocument[]> {
  await requireAdmin();

  let query = adminDb
    .collection(COLLECTIONS.PAYOUT_REQUESTS)
    .orderBy("requestedAt", "desc");

  if (status) {
    query = query.where("status", "==", status) as typeof query;
  }

  const snap = await query.limit(50).get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<PayoutRequestDocument, "id">),
  }));
}

// ─── Approve Payout ───────────────────────────────────────────────────────────
export async function approvePayoutRequest(
  id: string
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PAYOUT_REQUESTS)
    .doc(id)
    .update({
      status: "approved",
      approvedAt: Timestamp.now(),
      approvedBy: session.uid,
    });

  return { success: true };
}

// ─── Complete Payout ──────────────────────────────────────────────────────────
export async function completePayoutRequest(
  id: string
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  await adminDb
    .collection(COLLECTIONS.PAYOUT_REQUESTS)
    .doc(id)
    .update({
      status: "completed",
      processedAt: Timestamp.now(),
      processedBy: session.uid,
    });

  return { success: true };
}

// ─── Reject Payout ────────────────────────────────────────────────────────────
/**
 * Rejects a payout request and refunds the amount back to the affiliate's wallet.
 * Firestore Transaction ensures atomicity.
 */
export async function rejectPayoutRequest(
  id: string,
  reason: string
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  const requestRef = adminDb.collection(COLLECTIONS.PAYOUT_REQUESTS).doc(id);
  const requestDoc = await requestRef.get();

  if (!requestDoc.exists) {
    return { success: false, error: "Yêu cầu thanh toán không tồn tại" };
  }

  const request = requestDoc.data() as PayoutRequestDocument;
  if (request.status !== "pending" && request.status !== "approved") {
    return { success: false, error: "Yêu cầu này không thể bị từ chối" };
  }

  const affiliateRef = adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .doc(request.affiliateId);

  // Atomic: mark rejected + refund wallet
  await adminDb.runTransaction(async (tx) => {
    tx.update(requestRef, {
      status: "rejected",
      rejectedAt: Timestamp.now(),
      rejectedBy: session.uid,
      rejectionReason: reason,
    });

    tx.update(affiliateRef, {
      walletBalance: FieldValue.increment(request.amount),
      updatedAt: Timestamp.now(),
    });
  });

  return { success: true };
}
