/**
 * POST /api/v1/scan/confirm-payment
 *
 * Confirm counter payment for a pending order.
 * Only works for orders with paymentDetails.provider === "counter" and status === "pending".
 * After confirmation, generates passes (tickets) for the order.
 *
 * Body: { orderId: string, note?: string }
 * Auth: Bearer <INTERNAL_API_KEY>
 */

import { verifyApiKey, unauthorizedResponse } from "@/lib/api/verify-api-key";
import { validateCode, validateJsonBodySize } from "@/lib/api/request-guards";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { OrderDocument, CounterPayData } from "@/types/firestore";
import { generatePassesInTransaction } from "@/lib/pass-generation";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!verifyApiKey(req)) return unauthorizedResponse();
  const invalidBodySizeResponse = validateJsonBodySize(req);
  if (invalidBodySizeResponse) return invalidBodySizeResponse;

  // ── Parse body ────────────────────────────────────────────────────────────
  let orderId: string;
  let note: string | undefined;
  try {
    const body = await req.json();
    orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
    note = typeof body?.note === "string" ? body.note.trim() : undefined;
  } catch {
    return Response.json(
      { success: false, error: "INVALID_BODY", message: "Request body must be JSON with { orderId: string }" },
      { status: 400 }
    );
  }

  if (!orderId) {
    // Try finding by orderCode or orderNumber
    return Response.json(
      { success: false, error: "MISSING_ORDER_ID", message: "orderId is required" },
      { status: 400 }
    );
  }
  const invalidOrderIdResponse = validateCode(orderId, "orderId");
  if (invalidOrderIdResponse) return invalidOrderIdResponse;

  const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);

  try {
    const passIds: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");

      const order = { id: orderId, ...snap.data() } as OrderDocument;

      if (order.status === "paid") throw new Error("ALREADY_PAID");
      if (order.status === "cancelled") throw new Error("ALREADY_CANCELLED");
      if (order.paymentDetails?.provider !== "counter") throw new Error("NOT_COUNTER_ORDER");

      const now = Timestamp.now();

      // Check expiry
      if (order.expiresAt && now.toMillis() > order.expiresAt.toMillis()) {
        tx.update(orderRef, {
          status: "cancelled",
          cancelledAt: now,
          cancelReason: "counter_expired",
          updatedAt: now,
        });
        throw new Error("ORDER_EXPIRED");
      }

      // Build provider data
      const providerData: CounterPayData = {
        confirmedBy: "api_external",
        confirmedAt: now as unknown as import("@/types/firestore").Timestamp,
        ...(note ? { note } : {}),
      };

      // Generate passes + update order in one atomic operation
      const generatedIds = generatePassesInTransaction(tx, orderRef, order, {
        orderUpdateExtras: {
          "paymentDetails.providerData": providerData,
        },
      });
      passIds.push(...generatedIds);
    });

    // Fetch updated order
    const updatedSnap = await orderRef.get();
    const updated = updatedSnap.data() as OrderDocument;

    return Response.json({
      success: true,
      message: "Xác nhận thanh toán thành công",
      order: {
        id: orderId,
        orderNumber: updated.orderNumber,
        orderCode: updated.orderCode,
        status: "paid",
        finalAmount: updated.finalAmount,
        customerName: updated.customerName,
        paidAt: new Date(updated.paidAt!.toMillis()).toISOString(),
      },
      passes: passIds.map((id) => ({
        id,
        shortCode: id.slice(-12).toUpperCase(),
        qrCode: id,
        status: "active",
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";

    const errorMap: Record<string, [number, string]> = {
      ORDER_NOT_FOUND: [404, "Đơn hàng không tồn tại"],
      ALREADY_PAID: [422, "Đơn hàng đã được thanh toán trước đó"],
      ALREADY_CANCELLED: [422, "Đơn hàng đã bị huỷ, không thể xác nhận"],
      NOT_COUNTER_ORDER: [422, "Đơn hàng này không phải thanh toán tại quầy"],
      ORDER_EXPIRED: [422, "Đơn hàng đã hết hạn thanh toán"],
    };
    const [status, errorMsg] = errorMap[message] ?? [500, "Lỗi hệ thống, vui lòng thử lại"];

    console.error("[API confirm-payment]", err);
    return Response.json(
      { success: false, error: message, message: errorMsg },
      { status }
    );
  }
}
