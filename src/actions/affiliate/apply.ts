"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp as AdminTimestamp, FieldValue } from "firebase-admin/firestore";
import type { AffiliateProfileDocument } from "@/types/firestore";

export type AffiliateActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Submit Application (PUBLIC — no auth required) ───────────────────────────
/**
 * Anyone can submit an affiliate application without being logged in.
 * A Firestore doc is created with applicationStatus='pending'.
 * Admin will review and, upon approval, create a Firebase account for the applicant.
 */
export async function submitApplication(data: {
  displayName: string;
  email: string;
  phoneNumber?: string;
  socialLinks?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    facebook?: string;
  };
  followerCount?: number;
  niche?: string;
  bio?: string;
}): Promise<AffiliateActionResult<{ applicationId: string }>> {
  // Validate email
  const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailReg.test(data.email)) {
    return { success: false, error: "Email không hợp lệ." };
  }

  // Check if this email already has a pending/approved application
  const existingSnap = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .where("email", "==", data.email.toLowerCase().trim())
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data() as AffiliateProfileDocument;
    if (existing.applicationStatus === "approved") {
      return {
        success: false,
        error: "Email này đã được duyệt làm affiliate. Hãy đăng nhập vào cổng affiliate.",
      };
    }
    if (existing.applicationStatus === "pending") {
      return {
        success: false,
        error: "Email này đã có đơn đăng ký đang chờ xét duyệt.",
      };
    }
    // rejected — allow re-apply: delete old doc first
    await existingSnap.docs[0].ref.delete();
  }

  const now = AdminTimestamp.now();
  const profileData = {
    // userId will be set when admin approves and creates the Firebase account
    userId: null,
    displayName: data.displayName.trim(),
    email: data.email.toLowerCase().trim(),
    phoneNumber: data.phoneNumber?.trim() ?? null,
    socialLinks: data.socialLinks ?? {},
    followerCount: data.followerCount ?? null,
    niche: data.niche ?? null,
    bio: data.bio?.trim() ?? null,
    applicationStatus: "pending",
    appliedAt: now,
    defaultCommissionRate: 0,
    referralCode: null,
    trackingLink: null,
    totalClicks: 0,
    totalConversions: 0,
    totalCommissionEarned: 0,
    walletBalance: 0,
    totalPaidOut: 0,
    bankInfoVerified: false,
    createdAt: now,
    updatedAt: now,
  };

  const ref = await adminDb.collection(COLLECTIONS.AFFILIATE_PROFILES).add(profileData);

  return { success: true, data: { applicationId: ref.id } };
}

// ─── Get My Affiliate Profile (auth required — for portal pages) ──────────────
import { requireAuth } from "@/lib/auth/session";

export async function getMyAffiliateProfile(): Promise<AffiliateProfileDocument | null> {
  const session = await requireAuth();

  // Look up by userId (assigned after approval)
  const snap = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .where("userId", "==", session.uid)
    .limit(1)
    .get();

  if (snap.empty) return null;

  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<AffiliateProfileDocument, "id">) };
}

// ─── Update Bank Info ─────────────────────────────────────────────────────────
export async function updateBankInfo(bankInfo: {
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  branch?: string;
}): Promise<AffiliateActionResult> {
  const session = await requireAuth();

  const snap = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .where("userId", "==", session.uid)
    .limit(1)
    .get();

  if (snap.empty) {
    return { success: false, error: "Không tìm thấy hồ sơ affiliate." };
  }

  await snap.docs[0].ref.update({
    bankInfo,
    bankInfoVerified: false,
    updatedAt: AdminTimestamp.now(),
  });

  return { success: true };
}
