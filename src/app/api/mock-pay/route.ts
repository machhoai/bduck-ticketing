import { type NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { OrderDocument, PassDocument } from "@/types/firestore";
import { sendTicketEmail } from "@/lib/email/tickets";

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
      const freshOrder = freshOrderSnap.data() as OrderDocument;

      // Double-check idempotency inside transaction
      if (freshOrder.status !== "pending") return;

      const now = Timestamp.now();

      // Generate a PassDocument for each order item × quantity
      for (const item of freshOrder.items) {
        for (let i = 0; i < item.quantity; i++) {
          const passRef = adminDb.collection(COLLECTIONS.PASSES).doc();

          // Resolve validity dates from config
          let validFrom: Timestamp | undefined;
          let validUntil: Timestamp | undefined;
          let visitDate: Timestamp | undefined;

          const validity = item.validityConfig;

          if (validity.type === "date-specific" && validity.specificDate) {
            visitDate = validity.specificDate;
            validUntil = validity.specificDate;
          } else if (validity.type === "open-dated" && validity.validDaysFromPurchase) {
            // Open-dated: valid for N days from purchase
            validFrom = now;
            const expiryMs =
              now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
            validUntil = Timestamp.fromMillis(expiryMs);
          } else if (validity.type === "date-range") {
            // Date-range: valid from purchase date for N days
            validFrom = now;
            if (validity.validDaysFromPurchase) {
              const expiryMs =
                now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
              validUntil = Timestamp.fromMillis(expiryMs);
            }
            if (validity.overallExpiresAt) validUntil = validity.overallExpiresAt;
          }

          // Override with hard deadline if set
          if (validity.overallExpiresAt) {
            validUntil = validity.overallExpiresAt;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const passData: Record<string, any> = {
            orderId: orderId,
            orderNumber: freshOrder.orderNumber,
            customerId: freshOrder.customerId ?? "",
            customerName: freshOrder.customerName,
            customerEmail: freshOrder.customerEmail,
            productId: item.productId,
            productName: item.productName,
            productType: item.productType,
            thumbnailUrl: item.thumbnailUrl ?? "",
            validityType: validity.type,
            status: "active",
            createdAt: now,
          };

          // Only set optional fields if they have values
          // (Firestore rejects undefined)
          if (item.comboItems) passData.comboItems = item.comboItems;
          if (visitDate) passData.visitDate = visitDate;
          if (validFrom) passData.validFrom = validFrom;
          if (validUntil) passData.validUntil = validUntil;
          if (freshOrder.affiliateId) passData.affiliateId = freshOrder.affiliateId;

          tx.set(passRef, passData);
          passIds.push(passRef.id);
        }

        // Increment product soldCount
        const productRef = adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .doc(item.productId);
        tx.update(productRef, {
          soldCount: FieldValue.increment(item.quantity),
        });
      }

      // Increment promotion usedCount
      if (freshOrder.promotionId) {
        const promoRef = adminDb
          .collection(COLLECTIONS.PROMOTIONS)
          .doc(freshOrder.promotionId);
        tx.update(promoRef, { usedCount: FieldValue.increment(1) });
      }

      // Update order to paid
      tx.update(orderRef, {
        status: "paid",
        passIds,
        paidAt: now,
        updatedAt: now,
        paymentDetails: {
          provider: "mock",
          providerData: {
            simulatedAt: new Date().toISOString(),
            simulateResult: "success",
          },
        },
      });
    });

    // Fire-and-forget ticket email — don't block the redirect
    sendTicketEmail({
      to: order.customerEmail,
      customerName: order.customerName,
      orderId: orderId,
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
      passIds,
    }).catch(() => {}); // logged inside sendTicketEmail

    return NextResponse.redirect(`${resultUrl}&status=success`);
  } catch (error) {
    console.error("[mock-pay] Transaction failed:", error instanceof Error ? error.message : error);
    console.error("[mock-pay] Stack:", error instanceof Error ? error.stack : "no stack");
    return NextResponse.redirect(`${resultUrl}&error=server_error`);
  }
}
