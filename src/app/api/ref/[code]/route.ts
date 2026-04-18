import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Affiliate referral tracking endpoint.
 *
 * GET /api/ref/[code]
 * - Increments totalClicks on the affiliate profile (fire-and-forget)
 * - Sets a 30-day affiliate cookie
 * - Redirects to homepage (or ?next= param)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { searchParams } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck-ticketing.vercel.app";
  const next = searchParams.get("next") ?? "/";
  const destination = next.startsWith("/") ? `${appUrl}${next}` : appUrl;

  // ── Validate code exists ───────────────────────────────────────────────────
  const profileSnap = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .where("referralCode", "==", code.toUpperCase())
    .where("applicationStatus", "==", "approved")
    .limit(1)
    .get();

  if (profileSnap.empty) {
    // Invalid or inactive code — redirect without setting cookie
    return NextResponse.redirect(destination);
  }

  // ── Increment click counter (async, non-blocking) ──────────────────────────
  const profileRef = profileSnap.docs[0].ref;
  profileRef
    .update({ totalClicks: FieldValue.increment(1) })
    .catch((err) => console.warn("[ref] Failed to increment clicks:", err));

  // ── Set affiliate cookie (30 days) ─────────────────────────────────────────
  const response = NextResponse.redirect(destination);
  response.cookies.set("bduck_ref", code.toUpperCase(), {
    httpOnly: false,           // readable by client JS for checkout attribution
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    sameSite: "lax",
    path: "/",
  });

  return response;
}
