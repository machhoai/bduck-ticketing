/**
 * POST /api/v1/ticket/{orderId}/confirm-payment
 *
 * POS Flow:
 *   1. After collecting cash from customer, staff taps "Confirm Payment" on POS
 *   2. POS calls this endpoint with the orderId returned from /lookup
 *   3. System marks order as paid (atomic Firestore transaction)
 *   4. Response: success → POS prints paper ticket
 *
 * Auth: Bearer <INTERNAL_API_KEY>
 *
 * Body: { note?: string }   — optional staff note e.g. "Customer paid in cash"
 */

import { verifyApiKey, unauthorizedResponse } from "@/lib/api/verify-api-key";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { CounterPayData, OrderDocument } from "@/types/firestore";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
): Promise<Response> {
  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!verifyApiKey(req)) return unauthorizedResponse();

  const { orderId } = await params;
  if (!orderId) {
    return Response.json({ success: false, error: "Missing orderId" }, { status: 400 });
  }

  // ── Parse optional body ───────────────────────────────────────────────────
  let note: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    note = typeof body?.note === "string" ? body.note.trim() : undefined;
  } catch {
    // body is optional — ignore parse errors
  }

  // ── Atomic confirm via Firestore transaction ───────────────────────────────
  const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");

      const order = snap.data() as Omit<OrderDocument, "id">;

      if (order.status === "paid") throw new Error("ALREADY_PAID");
      if (order.status === "cancelled") throw new Error("ALREADY_CANCELLED");
      if (order.paymentDetails?.provider !== "counter") throw new Error("NOT_COUNTER_ORDER");

      const now = Timestamp.now();

      const providerData: CounterPayData = {
        confirmedBy: "pos_api", // POS system — no user uid
        confirmedAt: now as unknown as import("@/types/firestore").Timestamp,
        ...(note ? { note } : {}),
      };

      tx.update(orderRef, {
        status: "paid",
        paidAt: now,
        updatedAt: now,
        "paymentDetails.providerData": providerData,
      });
    });

    // Fetch updated order to return full info to POS
    const updatedSnap = await orderRef.get();
    const updatedOrder = {
      id: updatedSnap.id,
      ...(updatedSnap.data() as Omit<OrderDocument, "id">),
    };

    return Response.json({
      success: true,
      message: "Xác nhận thanh toán thành công",
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        orderCode: updatedOrder.orderCode,
        status: updatedOrder.status,
        finalAmount: updatedOrder.finalAmount,
        customerName: updatedOrder.customerName,
        items: updatedOrder.items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          subtotal: i.subtotal,
        })),
        paidAt: new Date(updatedOrder.paidAt!.toMillis()).toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";

    const errorMap: Record<string, [number, string]> = {
      ORDER_NOT_FOUND: [404, "Đơn hàng không tồn tại"],
      ALREADY_PAID: [422, "Đơn hàng đã được thanh toán trước đó"],
      ALREADY_CANCELLED: [422, "Đơn hàng đã bị huỷ, không thể xác nhận"],
      NOT_COUNTER_ORDER: [422, "Đơn hàng này không phải thanh toán tại quầy"],
    };
    const [status, errorMsg] = errorMap[message] ?? [500, "Lỗi hệ thống, vui lòng thử lại"];

    console.error("[POS confirm-payment]", err);
    return Response.json(
      { success: false, error: message, message: errorMsg },
      { status }
    );
  }
}
