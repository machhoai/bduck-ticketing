/**
 * GET /api/v1/ticket/lookup?code={orderCode}
 *
 * Legacy POS lookup by orderCode.
 * Auth: Bearer <INTERNAL_API_KEY>
 */

import { verifyApiKey, unauthorizedResponse } from "@/lib/api/verify-api-key";
import { serverErrorResponse, validateCode } from "@/lib/api/request-guards";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { OrderDocument, PassDocument } from "@/types/firestore";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  if (!verifyApiKey(req)) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const rawCode = searchParams.get("code")?.trim() ?? "";
    const invalidCodeResponse = validateCode(rawCode);
    if (invalidCodeResponse) return invalidCodeResponse;

    const code = rawCode.toUpperCase();
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
          message: `Khong tim thay don hang voi ma ${code}`,
        },
        { status: 404 }
      );
    }

    const doc = snap.docs[0];
    const order = { id: doc.id, ...(doc.data() as Omit<OrderDocument, "id">) } as OrderDocument;

    if (order.status === "paid") {
      const passesSnap = await adminDb
        .collection(COLLECTIONS.PASSES)
        .where("orderId", "==", order.id)
        .get();

      const passes = passesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PassDocument, "id">),
      })) as PassDocument[];

      return Response.json({
        success: true,
        action: "print_ticket",
        order: serializeOrder(order),
        passes: passes.map(serializePass),
      });
    }

    if (order.status === "cancelled") {
      return Response.json(
        {
          success: false,
          error: "ORDER_CANCELLED",
          message: `Don ${order.orderNumber} da bi huy`,
          cancelReason: order.cancelReason,
        },
        { status: 422 }
      );
    }

    if (order.expiresAt && Timestamp.now().toMillis() > order.expiresAt.toMillis()) {
      const now = Timestamp.now();
      await doc.ref.update({
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "counter_expired",
        updatedAt: now,
      });

      return Response.json(
        {
          success: false,
          error: "ORDER_EXPIRED",
          message: `Don ${order.orderNumber} da het han`,
        },
        { status: 422 }
      );
    }

    return Response.json({
      success: true,
      action: "collect_payment",
      order: serializeOrder(order),
      payment: {
        amountDue: order.finalAmount,
        currency: "VND",
        expiresAt: tsToISO(order.expiresAt as never),
      },
    });
  } catch (err) {
    return serverErrorResponse("[API ticket lookup]", err);
  }
}

function tsToISO(ts: { toMillis?: () => number; toDate?: () => Date } | undefined | null): string | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts.toMillis) return new Date(ts.toMillis()).toISOString();
  return null;
}

function serializeOrder(order: OrderDocument) {
  const items = Array.isArray(order.items) ? order.items : [];

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderCode: order.orderCode,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    items: items.map((item) => ({
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
    paidAt: tsToISO(order.paidAt as never),
    createdAt: tsToISO(order.createdAt as never),
  };
}

function serializePass(pass: PassDocument) {
  return {
    id: pass.id,
    passQrCode: pass.id,
    productName: pass.productName,
    productType: pass.productType,
    status: pass.status,
    timeSlotStart: pass.timeSlotStart ?? null,
    timeSlotEnd: pass.timeSlotEnd ?? null,
    allowedDaysOfWeek: pass.allowedDaysOfWeek ?? null,
    usedAt: tsToISO(pass.usedAt as never),
    validUntil: tsToISO(pass.validUntil as never),
  };
}
