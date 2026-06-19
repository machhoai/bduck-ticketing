/**
 * GET /api/v1/ticket/lookup?code={orderCode}
 *
 * POS Flow:
 *   1. Staff scans QR code → get orderCode string
 *   2. POS calls this endpoint with the scanned code
 *   3. Response tells POS what to show:
 *      - status "paid"    → show ticket info, ready to print paper ticket
 *      - status "counter" → show amount due, staff collects cash then calls confirm-payment
 *      - error codes      → show appropriate error message on POS screen
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
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!verifyApiKey(req)) return unauthorizedResponse();

  // ── Parse query ───────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const rawCode = searchParams.get("code")?.trim() ?? "";

  if (!rawCode) {
    return Response.json(
      { success: false, error: "Missing required query param: code" },
      { status: 400 }
    );
  }

  const code = rawCode.toUpperCase();

  // ── Lookup by orderCode ───────────────────────────────────────────────────
  const snap = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("orderCode", "==", code)
    .limit(1)
    .get();

  if (snap.empty) {
    return Response.json(
      {
        success: false,
        error: "ORDER_NOT_FOUND",
        message: `Không tìm thấy đơn hàng với mã ${code}`,
      },
      { status: 404 }
    );
  }

  const doc = snap.docs[0];
  const order = { id: doc.id, ...(doc.data() as Omit<OrderDocument, "id">) };

  // ── Already paid ──────────────────────────────────────────────────────────
  if (order.status === "paid") {
    // Fetch passes so POS can list what tickets to print
    const passesSnap = await adminDb
      .collection(COLLECTIONS.PASSES)
      .where("orderId", "==", order.id)
      .get();

    const passes = passesSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PassDocument, "id">),
    }));

    return Response.json({
      success: true,
      action: "print_ticket",
      order: serializeOrder(order),
      passes: passes.map(serializePass),
    });
  }

  // ── Cancelled ─────────────────────────────────────────────────────────────
  if (order.status === "cancelled") {
    return Response.json(
      {
        success: false,
        error: "ORDER_CANCELLED",
        message: `Đơn ${order.orderNumber} đã bị huỷ`,
        cancelReason: order.cancelReason,
      },
      { status: 422 }
    );
  }

  // ── Pending — lazy expiry check ───────────────────────────────────────────
  if (order.expiresAt && Timestamp.now().toMillis() > order.expiresAt.toMillis()) {
    // Auto-cancel expired counter order
    await doc.ref.update({
      status: "cancelled",
      cancelledAt: Timestamp.now(),
      cancelReason: "counter_expired",
      updatedAt: Timestamp.now(),
    });

    return Response.json(
      {
        success: false,
        error: "ORDER_EXPIRED",
        message: `Đơn ${order.orderNumber} đã hết hạn (quá 24 giờ kể từ lúc đặt)`,
      },
      { status: 422 }
    );
  }

  // ── Pending counter order — awaiting payment ───────────────────────────────
  return Response.json({
    success: true,
    action: "collect_payment",
    order: serializeOrder(order),
    payment: {
      amountDue: order.finalAmount,
      currency: "VND",
      expiresAt: order.expiresAt
        ? new Date(order.expiresAt.toMillis()).toISOString()
        : null,
    },
  });
}

// ─── Serializers (Timestamp → ISO string) ────────────────────────────────────
function serializeOrder(order: OrderDocument) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderCode: order.orderCode,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
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
    promotionCode: order.promotionCode,
    paymentProvider: order.paymentDetails?.provider,
    paidAt: order.paidAt ? new Date(order.paidAt.toMillis()).toISOString() : null,
    createdAt: new Date(order.createdAt.toMillis()).toISOString(),
  };
}

function serializePass(pass: PassDocument) {
  return {
    id: pass.id,
    passQrCode: pass.id,          // Document ID = QR code payload
    productName: pass.productName,
    productType: pass.productType,
    status: pass.status,
    timeSlotStart: pass.timeSlotStart ?? null,
    timeSlotEnd: pass.timeSlotEnd ?? null,
    allowedDaysOfWeek: pass.allowedDaysOfWeek ?? null,
    usedAt: pass.usedAt ? new Date(pass.usedAt.toMillis()).toISOString() : null,
    validUntil: pass.validUntil
      ? new Date(pass.validUntil.toMillis()).toISOString()
      : null,
  };
}
