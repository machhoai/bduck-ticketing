import { type NextRequest, NextResponse, after } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { OrderDocument, PassDocument } from "@/types/firestore";
import { sendTicketEmail } from "@/lib/email/tickets";
import { issueVouchersFromOrderItems } from "@/lib/deal-checkout";
import { getPayOS } from "@/lib/payos";
import type { Webhook, WebhookData } from "@payos/node/lib/resources/webhooks/webhook";

/**
 * PayOS Payment Webhook Handler
 *
 * PayOS sends a POST webhook when a payment status changes.
 * This handler verifies the signature, then processes the payment
 * identically to mock-pay: generates passes + sends ticket email.
 *
 * IDEMPOTENT: If order.status !== 'pending', exit silently with 200.
 *
 * POST /api/payos/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Verify webhook signature ──
    const payos = getPayOS();
    let webhookData: WebhookData;

    try {
      webhookData = await payos.webhooks.verify(body as Webhook);
    } catch (err) {
      console.error("[payos-webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // PayOS uses code "00" for success
    if (webhookData.code !== "00") {
      console.log(
        `[payos-webhook] Non-success code: ${webhookData.code} — ${webhookData.desc}`
      );
      // Acknowledge but don't process
      return NextResponse.json({ success: true });
    }

    const orderCode = webhookData.orderCode;

    // ── Handle PayOS Test Webhook ──
    // The PayOS dashboard "Send Test Webhook" button sends orderCode 123 and amount 3000.
    if (orderCode === 123) {
      console.log("[payos-webhook] Received PayOS TEST webhook successfully! Signature is valid.");
      return NextResponse.json({ success: true });
    }

    // ── Find the order by payosOrderCode ──
    const orderQuery = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .where("payosOrderCode", "==", orderCode)
      .limit(1)
      .get();

    if (orderQuery.empty) {
      console.error(
        `[payos-webhook] No order found for payosOrderCode: ${orderCode}`
      );
      // Return 200 to prevent PayOS retry for unknown orders
      return NextResponse.json({ success: true });
    }

    const orderDoc = orderQuery.docs[0];
    const orderId = orderDoc.id;
    const order = { id: orderId, ...orderDoc.data() } as OrderDocument;

    // ── Idempotency check ──
    if (order.status !== "pending") {
      console.log(
        `[payos-webhook] Order ${orderId} already ${order.status} — skipping`
      );
      return NextResponse.json({ success: true });
    }

    // ── Firestore Transaction: confirm payment + generate passes ──
    const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);
    const passIds: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const freshOrderSnap = await tx.get(orderRef);
      const freshOrder = freshOrderSnap.data() as OrderDocument;

      // Double-check idempotency inside transaction
      if (freshOrder.status !== "pending") return;

      const now = Timestamp.now();

      // Generate a PassDocument for each order item × quantity
      for (const item of freshOrder.items) {
        for (let i = 0; i < item.quantity; i++) {
          const passRef = adminDb.collection(COLLECTIONS.PASSES).doc();

          let validFrom: FirebaseFirestore.Timestamp | undefined;
          let validUntil: FirebaseFirestore.Timestamp | undefined;
          let visitDate: FirebaseFirestore.Timestamp | undefined;

          const validity = item.validityConfig;

          if (validity.type === "date-specific" && validity.specificDate) {
            visitDate =
              validity.specificDate as unknown as FirebaseFirestore.Timestamp;
            validUntil =
              validity.specificDate as unknown as FirebaseFirestore.Timestamp;
          } else if (
            validity.type === "open-dated" &&
            validity.validDaysFromPurchase
          ) {
            validFrom = now;
            const expiryMs =
              now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
            validUntil = Timestamp.fromMillis(expiryMs);
          } else if (validity.type === "date-range") {
            validFrom = now;
            if (validity.validDaysFromPurchase) {
              const expiryMs =
                now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
              validUntil = Timestamp.fromMillis(expiryMs);
            }
            if (validity.overallExpiresAt)
              validUntil =
                validity.overallExpiresAt as unknown as FirebaseFirestore.Timestamp;
          }

          // Override with hard deadline if set
          if (validity.overallExpiresAt) {
            validUntil =
              validity.overallExpiresAt as unknown as FirebaseFirestore.Timestamp;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const passData: Record<string, any> = {
            orderId,
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

          if (item.comboItems) passData.comboItems = item.comboItems;
          if (visitDate) passData.visitDate = visitDate;
          if (validFrom) passData.validFrom = validFrom;
          if (validUntil) passData.validUntil = validUntil;
          if (freshOrder.affiliateId)
            passData.affiliateId = freshOrder.affiliateId;

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
          provider: "payos",
          providerData: {
            payosOrderCode: orderCode,
            paymentLinkId: webhookData.paymentLinkId,
            reference: webhookData.reference,
            amount: webhookData.amount,
            transactionDateTime: webhookData.transactionDateTime,
            counterAccountBankId: webhookData.counterAccountBankId ?? null,
            counterAccountBankName: webhookData.counterAccountBankName ?? null,
            counterAccountName: webhookData.counterAccountName ?? null,
            counterAccountNumber: webhookData.counterAccountNumber ?? null,
          },
        },
      });
    });

    // ── Issue vouchers + send ticket email (after response) ──
    const orderForVoucher = { ...order, id: orderId } as OrderDocument;
    const capturedPassIds = [...passIds];

    after(async () => {
      console.log(
        "[payos-webhook] after() started — issuing vouchers for order:",
        orderId
      );
      try {
        const { vouchers, issuedIds } =
          await issueVouchersFromOrderItems(orderForVoucher);
        console.log(
          `[payos-webhook] Voucher result: ${issuedIds.length} issued, ${vouchers.length} for email`
        );

        await sendTicketEmail({
          to: order.customerEmail,
          customerName: order.customerName,
          orderId,
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
        console.log("[payos-webhook] Ticket email sent successfully");
      } catch (err) {
        console.error("[payos-webhook] after() voucher/email error:", err);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[payos-webhook] Handler error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
