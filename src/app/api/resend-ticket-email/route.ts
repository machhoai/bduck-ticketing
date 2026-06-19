/**
 * POST /api/resend-ticket-email
 * Body: { orderId: string }
 *
 * Re-sends the ticket confirmation email for a paid order.
 * Used by the "Resend email" button on the checkout result page.
 * Also includes voucher QR codes if the order has issued vouchers.
 */
import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { sendTicketEmail } from "@/lib/email/tickets";
import type { OrderDocument } from "@/types/firestore";
import type { VoucherEmailInfo } from "@/lib/deal-checkout";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, locale } = body as { orderId?: string; locale?: string };

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    // Fetch order
    const orderSnap = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .doc(orderId)
      .get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = { id: orderSnap.id, ...orderSnap.data() } as OrderDocument;

    // Only resend for paid orders
    if (order.status !== "paid") {
      return NextResponse.json(
        { error: "Order is not paid" },
        { status: 400 }
      );
    }

    // Fetch issued vouchers for this order
    const voucherSnap = await adminDb
      .collection(COLLECTIONS.ISSUED_VOUCHERS)
      .where("orderId", "==", orderId)
      .get();

    const vouchers: VoucherEmailInfo[] = voucherSnap.docs.map((d) => {
      const v = d.data();
      return {
        templateName: (v.templateName as string) || "",
        code: (v.code as string) || "",
        status: (v.status as string) === "active" ? "WON_VOUCHER" : (v.status as string),
        message: (v.status as string) === "active"
          ? `Chúc mừng! Bạn nhận được ${v.templateName}`
          : "",
      };
    });

    // Send email with vouchers
    const success = await sendTicketEmail({
      to: order.customerEmail,
      customerName: order.customerName,
      orderId: order.id,
      orderNumber: order.orderNumber,
      items: order.items.map((item) => ({
        productName: item.productName,
        productType: item.productType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      })),
      finalAmount: order.finalAmount,
      discountAmount: order.discountAmount,
      passIds: order.passIds ?? [],
      vouchers: vouchers.length > 0 ? vouchers : undefined,
      locale,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resend-ticket-email] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
