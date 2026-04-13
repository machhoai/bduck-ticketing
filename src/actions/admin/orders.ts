"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { OrderDocument, PassDocument } from "@/types/firestore";

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface AdminOrderFilters {
  status?: "pending" | "paid" | "cancelled";
  search?: string; // orderNumber or email
  limit?: number;
  startAfter?: string; // last doc ID for cursor pagination
}

export type AdminOrderWithPasses = OrderDocument & { passes: PassDocument[] };

// ─── Get Orders (paginated) ───────────────────────────────────────────────────
export async function getAdminOrders(
  filters: AdminOrderFilters = {}
): Promise<{ orders: OrderDocument[]; hasMore: boolean }> {
  await requireAdmin();

  const { status, limit = 20, startAfter } = filters;

  let query = adminDb
    .collection(COLLECTIONS.ORDERS)
    .orderBy("createdAt", "desc");

  if (status) {
    query = query.where("status", "==", status) as typeof query;
  }

  if (startAfter) {
    const cursorDoc = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .doc(startAfter)
      .get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc) as typeof query;
    }
  }

  const snap = await query.limit(limit + 1).get();

  const hasMore = snap.docs.length > limit;
  const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

  const orders = docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<OrderDocument, "id">),
  }));

  // Client-side search filter (Firestore doesn't support full-text search natively)
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const filtered = orders.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerEmail?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q)
    );
    return { orders: filtered, hasMore };
  }

  return { orders, hasMore };
}

// ─── Get Order By ID (admin — includes passes) ────────────────────────────────
export async function getAdminOrderById(
  orderId: string
): Promise<AdminOrderWithPasses | null> {
  await requireAdmin();

  const orderDoc = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .doc(orderId)
    .get();

  if (!orderDoc.exists) return null;

  const order = {
    id: orderDoc.id,
    ...(orderDoc.data() as Omit<OrderDocument, "id">),
  };

  const passesSnap = await adminDb
    .collection(COLLECTIONS.PASSES)
    .where("orderId", "==", orderId)
    .get();

  const passes = passesSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<PassDocument, "id">),
  }));

  return { ...order, passes };
}

// ─── Void Pass ────────────────────────────────────────────────────────────────
export async function voidPass(
  passId: string,
  reason: string
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  const passRef = adminDb.collection(COLLECTIONS.PASSES).doc(passId);
  const passDoc = await passRef.get();

  if (!passDoc.exists) {
    return { success: false, error: "Vé không tồn tại" };
  }

  const pass = passDoc.data() as PassDocument;
  if (pass.status === "voided") {
    return { success: false, error: "Vé đã bị vô hiệu hóa trước đó" };
  }

  await passRef.update({
    status: "voided",
    voidedAt: Timestamp.now(),
    voidedBy: session.uid,
    voidReason: reason,
  });

  return { success: true };
}
