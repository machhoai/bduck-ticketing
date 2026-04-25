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
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { OrderDocument, CounterPayData } from "@/types/firestore";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!verifyApiKey(req)) return unauthorizedResponse();

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

  const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);

  try {
    const passIds: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");

      const order = snap.data() as Omit<OrderDocument, "id">;

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

      // Generate passes for each item × quantity
      for (const item of order.items) {
        for (let i = 0; i < item.quantity; i++) {
          const passRef = adminDb.collection(COLLECTIONS.PASSES).doc();

          let validFrom: FirebaseFirestore.Timestamp | undefined;
          let validUntil: FirebaseFirestore.Timestamp | undefined;
          let visitDate: FirebaseFirestore.Timestamp | undefined;

          const validity = item.validityConfig;
          if (validity.type === "date-specific" && validity.specificDate) {
            visitDate = validity.specificDate as unknown as FirebaseFirestore.Timestamp;
            validUntil = validity.specificDate as unknown as FirebaseFirestore.Timestamp;
          } else if (validity.type === "open-dated" && validity.validDaysFromPurchase) {
            validFrom = now;
            const expiryMs = now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
            validUntil = Timestamp.fromMillis(expiryMs);
          } else if (validity.type === "date-range") {
            validFrom = now;
            if (validity.validDaysFromPurchase) {
              const expiryMs = now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
              validUntil = Timestamp.fromMillis(expiryMs);
            }
            if (validity.overallExpiresAt) validUntil = validity.overallExpiresAt as unknown as FirebaseFirestore.Timestamp;
          }
          if (validity.overallExpiresAt) {
            validUntil = validity.overallExpiresAt as unknown as FirebaseFirestore.Timestamp;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const passData: Record<string, any> = {
            orderId,
            orderNumber: order.orderNumber,
            customerId: order.customerId ?? "",
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            productId: item.productId,
            productName: item.productName,
            productType: item.productType,
            thumbnailUrl: item.thumbnailUrl ?? "",
            validityType: validity.type,
            status: "active",
            createdAt: now,
          };

          if (item.comboItems) passData.comboItems = item.comboItems;
          if (visitDate) passData.visitDate = visitDate;
          if (validFrom) passData.validFrom = validFrom;
          if (validUntil) passData.validUntil = validUntil;

          tx.set(passRef, passData);
          passIds.push(passRef.id);
        }

        // Increment product soldCount
        const productRef = adminDb.collection(COLLECTIONS.PRODUCTS).doc(item.productId);
        tx.update(productRef, { soldCount: FieldValue.increment(item.quantity) });
      }

      // Increment promotion usedCount
      if (order.promotionId) {
        const promoRef = adminDb.collection(COLLECTIONS.PROMOTIONS).doc(order.promotionId);
        tx.update(promoRef, { usedCount: FieldValue.increment(1) });
      }

      const providerData: CounterPayData = {
        confirmedBy: "api_external",
        confirmedAt: now as unknown as import("@/types/firestore").Timestamp,
        ...(note ? { note } : {}),
      };

      tx.update(orderRef, {
        status: "paid",
        passIds,
        paidAt: now,
        updatedAt: now,
        "paymentDetails.providerData": providerData,
      });
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
        qrCode: `BDUCK-PASS-${id}`,
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
