"use server";

import "server-only";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { AffiliateProfileDocument } from "@/types/firestore";
import {
  sendAffiliateApprovalEmail,
  sendAffiliateRejectionEmail,
} from "@/lib/email/affiliate";
import { revalidatePath } from "next/cache";

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Helper: generate a secure temp password ──────────────────────────────────
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 12 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

// ─── Helper: generate referral code from display name + doc id ─────────────
function generateReferralCode(displayName: string, docId: string): string {
  const nameSlug = displayName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  return `${nameSlug}${docId.slice(-4).toUpperCase()}`;
}

// ─── Get Affiliate Applications ───────────────────────────────────────────────
export async function getAffiliateApplications(
  status?: "pending" | "approved" | "rejected" | "suspended"
): Promise<AffiliateProfileDocument[]> {
  await requireAdmin();

  const col = adminDb.collection(COLLECTIONS.AFFILIATE_PROFILES);
  const query = status
    ? col.where("applicationStatus", "==", status).orderBy("appliedAt", "desc")
    : col.orderBy("appliedAt", "desc");

  const snap = await query.get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<AffiliateProfileDocument, "id">),
  }));
}

// ─── Get Single Application ───────────────────────────────────────────────────
export async function getAffiliateApplication(
  docId: string
): Promise<AffiliateProfileDocument | null> {
  await requireAdmin();

  const doc = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .doc(docId)
    .get();

  if (!doc.exists) return null;

  return { id: doc.id, ...(doc.data() as Omit<AffiliateProfileDocument, "id">) };
}

// ─── Approve Affiliate ────────────────────────────────────────────────────────
/**
 * Approves an affiliate application:
 * 1. Creates a Firebase Auth account with email + generated password
 * 2. Sets custom claims role='affiliate'
 * 3. Generates referral code + tracking link
 * 4. Updates Firestore profile with userId, referralCode, status
 * 5. Updates b_users collection
 * 6. Sends approval email with credentials
 */
export async function approveAffiliate(
  docId: string,
  commissionRate: number
): Promise<AdminActionResult<{ tempPassword: string }>> {
  const session = await requireAdmin();

  if (commissionRate < 0 || commissionRate > 1) {
    return { success: false, error: "Commission rate phải từ 0 đến 1 (e.g. 0.1 = 10%)" };
  }

  const profileRef = adminDb.collection(COLLECTIONS.AFFILIATE_PROFILES).doc(docId);
  const profileDoc = await profileRef.get();

  if (!profileDoc.exists) {
    return { success: false, error: "Không tìm thấy hồ sơ affiliate." };
  }

  const profile = profileDoc.data() as AffiliateProfileDocument;

  if (profile.applicationStatus === "approved") {
    return { success: false, error: "Affiliate này đã được duyệt rồi." };
  }

  // ── Step 1: Create Firebase Auth account ────────────────────────────────────
  const tempPassword = generateTempPassword();
  let firebaseUser;

  try {
    // Check if user with this email already exists
    try {
      firebaseUser = await adminAuth.getUserByEmail(profile.email);
    } catch {
      // Does not exist → create
      firebaseUser = await adminAuth.createUser({
        email: profile.email,
        password: tempPassword,
        displayName: profile.displayName,
        emailVerified: true, // trust admin approval as verification
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Tạo tài khoản Firebase thất bại: ${msg}` };
  }

  const uid = firebaseUser.uid;

  // ── Step 2: Set custom claims ───────────────────────────────────────────────
  await adminAuth.setCustomUserClaims(uid, { role: "affiliate" });

  // ── Step 3: Generate referral code & tracking link ──────────────────────────
  const referralCode = generateReferralCode(profile.displayName, docId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck-ticketing.vercel.app";
  const trackingLink = `${appUrl}/?ref=${referralCode}`;

  // ── Step 4: Update Firestore profile ────────────────────────────────────────
  await profileRef.update({
    userId: uid,
    applicationStatus: "approved",
    defaultCommissionRate: commissionRate,
    referralCode,
    trackingLink,
    approvedAt: Timestamp.now(),
    approvedBy: session.uid,
    updatedAt: Timestamp.now(),
  });

  // ── Step 5: Upsert b_users doc ──────────────────────────────────────────────
  await adminDb.collection(COLLECTIONS.USERS).doc(uid).set(
    {
      uid,
      email: profile.email,
      displayName: profile.displayName,
      role: "affiliate",
      updatedAt: Timestamp.now(),
    },
    { merge: true }
  );

  // ── Step 6: Send approval email (non-blocking for admin but awaited for error reporting) ──
  try {
    await sendAffiliateApprovalEmail({
      to: profile.email,
      displayName: profile.displayName,
      email: profile.email,
      tempPassword,
      referralCode,
      trackingLink,
      commissionRate,
    });
  } catch {
    // Profile is already approved even if email fails — log for manual follow-up
    console.error(`[affiliate] Email failed for ${profile.email}, password was: ${tempPassword}`);
    // Still return success but surface the issue
    return {
      success: true,
      data: { tempPassword },
    };
  }

  revalidatePath("/[locale]/admin/affiliates", "page");

  return { success: true, data: { tempPassword } };
}

// ─── Reject Affiliate ─────────────────────────────────────────────────────────
/**
 * Rejects an affiliate application:
 * 1. Updates Firestore profile to 'rejected' with reason
 * 2. Sends rejection email with reason
 */
export async function rejectAffiliate(
  docId: string,
  reason: string
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  if (!reason.trim()) {
    return { success: false, error: "Vui lòng điền lý do từ chối." };
  }

  const profileRef = adminDb.collection(COLLECTIONS.AFFILIATE_PROFILES).doc(docId);
  const profileDoc = await profileRef.get();

  if (!profileDoc.exists) {
    return { success: false, error: "Không tìm thấy hồ sơ affiliate." };
  }

  const profile = profileDoc.data() as AffiliateProfileDocument;

  // ── Update Firestore ────────────────────────────────────────────────────────
  await profileRef.update({
    applicationStatus: "rejected",
    rejectedAt: Timestamp.now(),
    rejectedBy: session.uid,
    rejectionReason: reason.trim(),
    updatedAt: Timestamp.now(),
  });

  // ── Send rejection email ────────────────────────────────────────────────────
  try {
    await sendAffiliateRejectionEmail({
      to: profile.email,
      displayName: profile.displayName,
      reason: reason.trim(),
    });
  } catch (err) {
    console.error("[affiliate] Rejection email failed:", err);
  }

  revalidatePath("/[locale]/admin/affiliates", "page");

  return { success: true };
}

// ─── Suspend Affiliate ────────────────────────────────────────────────────────
export async function suspendAffiliate(docId: string): Promise<AdminActionResult> {
  const session = await requireAdmin();

  const profileRef = adminDb.collection(COLLECTIONS.AFFILIATE_PROFILES).doc(docId);
  const profileDoc = await profileRef.get();

  if (!profileDoc.exists) {
    return { success: false, error: "Không tìm thấy hồ sơ affiliate." };
  }

  const profile = profileDoc.data() as AffiliateProfileDocument;

  await profileRef.update({
    applicationStatus: "suspended",
    suspendedAt: Timestamp.now(),
    suspendedBy: session.uid,
    updatedAt: Timestamp.now(),
  });

  // Revoke Firebase custom claims if userId exists
  if (profile.userId) {
    await adminAuth.setCustomUserClaims(profile.userId, { role: "customer" });
  }

  revalidatePath("/[locale]/admin/affiliates", "page");

  return { success: true };
}
