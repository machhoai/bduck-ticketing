"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp as AdminTimestamp, FieldValue } from "firebase-admin/firestore";
import type { Timestamp } from "firebase/firestore";
import type { PayoutRequestDocument, AffiliateProfileDocument } from "@/types/firestore";

export type AffiliateActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Request Payout ───────────────────────────────────────────────────────────
/**
 * Firestore Transaction:
 * 1. Read affiliate profile — verify balance >= amount
 * 2. Deduct from walletBalance
 * 3. Create payoutRequest doc
 */
export async function requestPayout(
  amount: number
): Promise<AffiliateActionResult<{ requestId: string }>> {
  const session = await requireAuth();
  const uid = session.uid;

  if (amount < 100_000) {
    return {
      success: false,
      error: "Số tiền rút tối thiểu là 100.000 VND.",
    };
  }

  // Find profile by userId (doc ID != uid now)
  const profileQuerySnap = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .where("userId", "==", uid)
    .limit(1)
    .get();

  if (profileQuerySnap.empty) {
    return { success: false, error: "Không tìm thấy hồ sơ affiliate." };
  }

  const profileRef = profileQuerySnap.docs[0].ref;
  const requestRef = adminDb.collection(COLLECTIONS.PAYOUT_REQUESTS).doc();

  try {
    await adminDb.runTransaction(async (tx) => {
      const profileSnap = await tx.get(profileRef);
      if (!profileSnap.exists) throw new Error("Profile not found");

      const profile = profileSnap.data() as AffiliateProfileDocument;

      if ((profile.applicationStatus) !== "approved") {
        throw new Error("Tài khoản chưa được phê duyệt.");
      }
      if (profile.walletBalance < amount) {
        throw new Error(
          `Số dư không đủ. Hiện có: ${profile.walletBalance.toLocaleString("vi-VN")} VND`
        );
      }
      if (!profile.bankInfo) {
        throw new Error("Vui lòng cập nhật thông tin ngân hàng trước khi rút tiền.");
      }

      const now = AdminTimestamp.now() as unknown as Timestamp;

      // Deduct wallet
      tx.update(profileRef, {
        walletBalance: FieldValue.increment(-amount),
        updatedAt: now,
      });

      // Create payout request
      const payoutData: Omit<PayoutRequestDocument, "id"> = {
        affiliateId: uid,
        affiliateDisplayName: profile.displayName,
        bankInfoSnapshot: profile.bankInfo,
        amount,
        walletBalanceBefore: profile.walletBalance,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };
      tx.set(requestRef, payoutData);
    });

    return { success: true, data: { requestId: requestRef.id } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.",
    };
  }
}

// ─── Get Payout History ───────────────────────────────────────────────────────
export async function getPayoutHistory(): Promise<PayoutRequestDocument[]> {
  const session = await requireAuth();

  const snap = await adminDb
    .collection(COLLECTIONS.PAYOUT_REQUESTS)
    .where("affiliateId", "==", session.uid)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<PayoutRequestDocument, "id">),
  }));
}
