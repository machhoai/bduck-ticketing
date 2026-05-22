import { type NextRequest, NextResponse, after } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { OrderDocument } from "@/types/firestore";
import { sendTicketEmail } from "@/lib/email/tickets";
import { issueVouchersFromOrderItems } from "@/lib/deal-checkout";
import { generatePassesInTransaction } from "@/lib/pass-generation";

/**
 * Mock Payment Webhook — simulates VNPay IPN behavior.
 *
 * CRITICAL (D1): Pass creation happens HERE, not on the result page.
 * This prevents the "abandoned result page" vulnerability where a user
 * closes the browser after paying but before landing on the result page.
 *
 * IDEMPOTENT: If order.status !== 'pending', we exit silently with 200.
 * This prevents duplicate passes from double-webhook fires.
 *
 * GET /api/mock-pay?orderId=xxx&amount=yyy&simulate=success|fail
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const simulate = searchParams.get("simulate") ?? "success";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (!orderId) {
    return NextResponse.redirect(`${appUrl}/checkout/result?error=missing_order`);
  }

  const resultUrl = `${appUrl}/checkout/result?orderId=${orderId}`;

  try {
    // ── Fetch order ──
    const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.redirect(`${resultUrl}&error=not_found`);
    }

    const order = { id: orderSnap.id, ...orderSnap.data() } as OrderDocument;

    // ── Idempotency check ──
    if (order.status !== "pending") {
      // Already processed — redirect to result page
      return NextResponse.redirect(resultUrl);
    }

    // ── Simulated payment failure ──
    if (simulate === "fail") {
      await orderRef.update({
        status: "cancelled",
        cancelReason: "mock_payment_failed",
        cancelledAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        paymentDetails: {
          provider: "mock",
          providerData: {
            simulatedAt: new Date().toISOString(),
            simulateResult: "fail",
          },
        },
      });
      return NextResponse.redirect(`${resultUrl}&status=failed`);
    }

    // ── Firestore Transaction: confirm payment + generate passes ──
    const passIds: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      // Re-read order inside transaction for consistency
      const freshOrderSnap = await tx.get(orderRef);
      const freshOrder = { id: orderId, ...freshOrderSnap.data() } as OrderDocument;

      // Double-check idempotency inside transaction
      if (freshOrder.status !== "pending") return;

      const generatedIds = generatePassesInTransaction(tx, orderRef, freshOrder, {
        orderUpdateExtras: {
          paymentDetails: {
            provider: "mock",
            providerData: {
              simulatedAt: new Date().toISOString(),
              simulateResult: "success",
            },
          },
        },
      });
      passIds.push(...generatedIds);
    });

    // ── Issue vouchers + send ticket email (after response) ──
    // Use after() to keep function alive after redirect on Vercel
    const orderForVoucher = { ...order, id: orderId! } as OrderDocument;
    const capturedPassIds = [...passIds];

    after(async () => {
      console.log("[mock-pay] after() started — issuing vouchers for order:", orderId);
      try {
        const { vouchers, issuedIds } = await issueVouchersFromOrderItems(orderForVoucher);
        console.log(`[mock-pay] Voucher result: ${issuedIds.length} issued, ${vouchers.length} for email`);

        await sendTicketEmail({
          to: order.customerEmail,
          customerName: order.customerName,
          orderId: orderId!,
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
          passIds: capturedPassIds,
          vouchers: vouchers.length > 0 ? vouchers : undefined,
        });
        console.log("[mock-pay] Ticket email sent successfully");
      } catch (err) {
        console.error("[mock-pay] after() voucher/email error:", err);
      }
    });

    return NextResponse.redirect(`${resultUrl}&status=success`);
  } catch (error) {
    console.error("[mock-pay] Transaction failed:", error instanceof Error ? error.message : error);
    console.error("[mock-pay] Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.redirect(`${resultUrl}&error=server_error`);
  }
}
