"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { verifySession } from "@/lib/auth/session";
import type { OrderDocument, PassDocument } from "@/types/firestore";
import {
  verifyGuestToken,
  type OrderIdentity,
  type OrderWithPasses,
} from "@/lib/orders";

// Re-export types so existing imports keep working
export type { OrderIdentity, OrderWithPasses } from "@/lib/orders";

// ─── Get Order By ID ──────────────────────────────────────────────────────────
/**
 * Fetches a single order with its passes.
 * Security (D8):
 *  - Logged-in: verifies session cookie, checks UID matches order.customerId
 *  - Guest: verifies HMAC token against stored email
 */
export async function getOrderById(
  orderId: string,
  identity: OrderIdentity
): Promise<OrderWithPasses | null> {
  const orderDoc = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .doc(orderId)
    .get();

  if (!orderDoc.exists) return null;

  const order = {
    id: orderDoc.id,
    ...orderDoc.data(),
  } as OrderDocument;

  // ── Identity verification (D8) ──
  let authorized = false;

  if (identity.uid) {
    // Logged-in path: verify session cookie via canonical verifySession() (D8)
    const session = await verifySession();
    authorized =
      session !== null &&
      session.uid === identity.uid &&
      order.customerId === session.uid;
  } else if (identity.guestToken && identity.orderId) {
    // Guest path: verify HMAC token
    authorized = verifyGuestToken(
      identity.guestToken,
      identity.orderId,
      order.customerEmail
    );
  }

  if (!authorized) return null;

  // ── Fetch passes ──
  const passesSnap = await adminDb
    .collection(COLLECTIONS.PASSES)
    .where("orderId", "==", orderId)
    .get();

  const passes = passesSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as PassDocument[];

  return { ...order, passes };
}

// ─── Get My Orders ────────────────────────────────────────────────────────────
/**
 * Returns paginated orders for an authenticated user.
 * Security (D8): UID is extracted from verified session cookie only.
 * Never trusts a client-sent UID.
 */
export async function getMyOrders(): Promise<OrderDocument[]> {
  const session = await verifySession();
  if (!session) return [];

  const snap = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("customerId", "==", session.uid)
    .where("status", "in", ["paid", "cancelled"])
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as OrderDocument[];
}

// ─── Get Order Status (for result page polling) ───────────────────────────────
/**
 * Lightweight status-only fetch for the result page polling mechanism.
 * No auth required — orderId is enough for polling (result page already knows it).
 * Returns only the status + passIds to avoid over-fetching.
 */
export async function getOrderStatus(
  orderId: string
): Promise<{ status: string; passIds: string[] } | null> {
  const doc = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .doc(orderId)
    .get();

  if (!doc.exists) return null;
  const data = doc.data()!;
  return { status: data.status, passIds: data.passIds ?? [] };
}
