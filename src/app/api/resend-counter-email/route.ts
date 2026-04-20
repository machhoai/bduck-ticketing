/**
 * POST /api/resend-counter-email
 * Body: { orderId: string }
 *
 * Re-sends the counter order confirmation email (QR + amount due).
 * Only works for counter-payment orders that are still pending.
 */
import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { sendCounterOrderEmail } from "@/lib/email/counter-order";
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

        const orderSnap = await adminDb
            .collection(COLLECTIONS.ORDERS)
            .doc(orderId)
            .get();

        if (!orderSnap.exists) {
            return NextResponse.json(
                { error: "Order not found" },
                { status: 404 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const order = { id: orderSnap.id, ...orderSnap.data() } as OrderDocument & Record<string, any>;

        // Guard: only for counter + pending orders
        if (order.paymentDetails?.provider !== "counter") {
            return NextResponse.json(
                { error: "Not a counter payment order" },
                { status: 400 }
            );
        }
        if (order.status !== "pending") {
            return NextResponse.json(
                { error: "Order is no longer pending" },
                { status: 400 }
            );
        }
        if (!order.orderCode) {
            return NextResponse.json(
                { error: "Order has no orderCode" },
                { status: 400 }
            );
        }

        // Resolve expiresAt → Date
        const expiresAt: Date = order.expiresAt?.toDate?.()
            ? order.expiresAt.toDate()
            : new Date(Date.now() + 24 * 3600 * 1000);

        const success = await sendCounterOrderEmail({
            to: order.customerEmail,
            customerName: order.customerName,
            orderId: order.id,
            orderNumber: order.orderNumber ?? "",
            orderCode: order.orderCode,
            items: order.items.map((i) => ({
                productName: i.productName,
                productType: i.productType,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                subtotal: i.subtotal,
            })),
            finalAmount: order.finalAmount,
            discountAmount: order.discountAmount ?? 0,
            expiresAt,
        });

        if (!success) {
            return NextResponse.json(
                { error: "Failed to send email" },
                { status: 500 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error("[resend-counter-email] Error:", err);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
