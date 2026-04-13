/**
 * Shared order utilities — NOT a Server Action file.
 * Import this from both server actions and client components freely.
 */
import crypto from "crypto";
import type { OrderDocument, PassDocument } from "@/types/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderIdentity {
  /** Firebase Auth UID — for logged-in users */
  uid?: string;
  /** Guest access token from emailed link */
  guestToken?: string;
  /** Order ID — required for guest token verification */
  orderId?: string;
}

export type OrderWithPasses = OrderDocument & { passes: PassDocument[] };

// ─── Guest Token Helpers ──────────────────────────────────────────────────────

/**
 * Generates a HMAC-SHA256 guest access token for a given order + email.
 * Used in "view your order" email links (D8: secure guest order lookup).
 */
export function generateGuestToken(orderId: string, email: string): string {
  const secret = process.env.GUEST_ORDER_SECRET ?? "fallback-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}:${email}`)
    .digest("hex");
}

/**
 * Verifies a guest token against an order's stored email.
 * Uses timingSafeEqual to prevent timing attacks (D8).
 */
export function verifyGuestToken(
  token: string,
  orderId: string,
  email: string
): boolean {
  const expected = generateGuestToken(orderId, email);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(token, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
