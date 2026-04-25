/**
 * GET /api/v1/scan?code={any_code}
 *
 * Unified scan/lookup — accepts any code format:
 *   - "BDUCK-PASS-{passId}" → pass lookup
 *   - "BDK-XXXXXX"          → order lookup by orderCode
 *   - Free-form             → passId → shortCode → orderNumber → orderCode
 *
 * READ-ONLY: does not change any pass/order status.
 * Use POST /api/v1/scan/use-pass or POST /api/v1/scan/confirm-payment to change state.
 *
 * Auth: Bearer <INTERNAL_API_KEY>
 */

import { verifyApiKey, unauthorizedResponse } from "@/lib/api/verify-api-key";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { OrderDocument, PassDocument } from "@/types/firestore";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  if (!verifyApiKey(req)) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const rawCode = searchParams.get("code")?.trim() ?? "";

  if (!rawCode) {
    return Response.json(
      { success: false, error: "MISSING_CODE", message: "Missing required query param: code" },
      { status: 400 }
    );
  }

  const upper = rawCode.toUpperCase();

  // ── Fast path: pass QR code ───────────────────────────────────────────────
  if (upper.startsWith("BDUCK-PASS-")) {
    const passId = rawCode.slice("BDUCK-PASS-".length);
    const result = await lookupPass(passId);
    if (result) return Response.json({ success: true, type: "pass", pass: result });
    return notFoundResponse(rawCode);
  }

  // ── Fast path: order code ─────────────────────────────────────────────────
  if (upper.startsWith("BDK-")) {
    const result = await lookupOrder("orderCode", upper);
    if (result) return Response.json({ success: true, type: "order", order: result });
    return notFoundResponse(rawCode);
  }

  // ── Free-form search: try all strategies ──────────────────────────────────

  // 1. Try as exact passId
  const passById = await lookupPass(rawCode);
  if (passById) return Response.json({ success: true, type: "pass", pass: passById });

  // 2. Try as pass short code (last 12 chars shown on ticket/email)
  const passByShort = await lookupPassByShortCode(upper);
  if (passByShort) return Response.json({ success: true, type: "pass", pass: passByShort });

  // 3. Try as orderNumber
  const byNumber = await lookupOrder("orderNumber", upper);
  if (byNumber) return Response.json({ success: true, type: "order", order: byNumber });

  // 4. Try as orderCode
  const byCode = await lookupOrder("orderCode", upper);
  if (byCode) return Response.json({ success: true, type: "order", order: byCode });

  // 5. Nothing matched
  return notFoundResponse(rawCode);
}

// ─── Pass lookup ──────────────────────────────────────────────────────────────

async function lookupPass(passId: string) {
  if (!passId) return null;
  try {
    const snap = await adminDb.collection(COLLECTIONS.PASSES).doc(passId).get();
    if (!snap.exists) return null;
    return serializePass({ id: snap.id, ...snap.data() } as PassDocument);
  } catch {
    return null;
  }
}

async function lookupPassByShortCode(shortCode: string) {
  if (shortCode.length < 6 || shortCode.length >= 20) return null;
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.PASSES)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const lower = shortCode.toLowerCase();
    const match = snap.docs.find((doc) => doc.id.toLowerCase().endsWith(lower));
    if (!match) return null;
    return serializePass({ id: match.id, ...match.data() } as PassDocument);
  } catch {
    return null;
  }
}

// ─── Order lookup ─────────────────────────────────────────────────────────────

async function lookupOrder(field: "orderNumber" | "orderCode", value: string) {
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .where(field, "==", value)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    let order = { id: doc.id, ...(doc.data() as Omit<OrderDocument, "id">) } as OrderDocument;

    // Lazy auto-cancel expired pending counter orders
    if (
      order.status === "pending" &&
      order.expiresAt &&
      Timestamp.now().toMillis() > order.expiresAt.toMillis()
    ) {
      const now = Timestamp.now();
      await doc.ref.update({
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "counter_expired",
        updatedAt: now,
      });
      order = { ...order, status: "cancelled", cancelReason: "counter_expired" } as OrderDocument;
    }

    return serializeOrder(order);
  } catch {
    return null;
  }
}

// ─── Serializers ──────────────────────────────────────────────────────────────

function tsToISO(ts: { toMillis?: () => number; toDate?: () => Date } | undefined | null): string | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts.toMillis) return new Date(ts.toMillis()).toISOString();
  return null;
}

function serializePass(pass: PassDocument) {
  return {
    id: pass.id,
    shortCode: pass.id.slice(-12).toUpperCase(),
    qrCode: `BDUCK-PASS-${pass.id}`,
    orderId: pass.orderId,
    orderNumber: pass.orderNumber,
    customerId: pass.customerId ?? null,
    customerName: pass.customerName,
    customerEmail: pass.customerEmail,
    productId: pass.productId,
    productName: pass.productName,
    productType: pass.productType,
    thumbnailUrl: pass.thumbnailUrl ?? null,
    validityType: pass.validityType,
    status: pass.status,
    comboItems: pass.comboItems ?? null,
    visitDate: tsToISO(pass.visitDate as never),
    validFrom: tsToISO(pass.validFrom as never),
    validUntil: tsToISO(pass.validUntil as never),
    createdAt: tsToISO(pass.createdAt as never),
    usedAt: tsToISO(pass.usedAt as never),
    usedBy: pass.usedBy ?? null,
  };
}

function serializeOrder(order: OrderDocument) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderCode: order.orderCode ?? null,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone ?? null,
    isGuestOrder: order.isGuestOrder ?? false,
    paymentProvider: order.paymentDetails?.provider ?? null,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productType: item.productType,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    })),
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    finalAmount: order.finalAmount,
    promotionCode: order.promotionCode ?? null,
    passIds: order.passIds ?? [],
    paidAt: tsToISO(order.paidAt as never),
    createdAt: tsToISO(order.createdAt as never),
    expiresAt: tsToISO(order.expiresAt as never),
    cancelReason: order.cancelReason ?? null,
  };
}

function notFoundResponse(code: string) {
  return Response.json(
    { success: false, error: "NOT_FOUND", message: `Không tìm thấy vé hoặc đơn hàng với mã "${code}"` },
    { status: 404 }
  );
}
