/**
 * POST /api/resend-ticket-email
 * Body: { orderId: string }
 *
 * Re-sends the ticket confirmation email for a paid order.
 * Used by the "Resend email" button on the checkout result page.
 */
import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { sendTicketEmail } from "@/lib/email/tickets";
import type { OrderDocument } from "@/types/firestore";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body as { orderId?: string };

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

    // Send email
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
