import { type NextRequest, NextResponse, after } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { OrderDocument } from "@/types/firestore";
import { sendTicketEmail } from "@/lib/email/tickets";
import { issueVouchersFromOrderItems } from "@/lib/deal-checkout";
import { generatePassesInTransaction } from "@/lib/pass-generation";
import { verifyChecksum, parseVNPayParams } from "@/lib/vnpay";

/**
 * VNPay IPN (Instant Payment Notification) Handler
 *
 * Server-to-server callback from VNPay when payment status changes.
 * VNPay sends GET request with payment result params.
 *
 * MUST respond with JSON { RspCode, Message } format.
 * VNPay uses RspCode to decide retry behavior:
 *   - "00" / "02" → stop (success / already confirmed)
 *   - "01" / "04" / "97" / "99" → retry (up to 10 times, every 5 min)
 *
 * IDEMPOTENT: If order.status !== 'pending', respond with RspCode "02".
 *
 * GET /api/vnpay/ipn?vnp_Amount=...&vnp_ResponseCode=00&vnp_SecureHash=...
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = parseVNPayParams(searchParams);

    // ── Step 1: Verify checksum ──
    if (!verifyChecksum(params)) {
      console.error("[vnpay-ipn] Invalid checksum");
      return NextResponse.json({ RspCode: "97", Message: "Invalid signature" });
    }

    const vnpTxnRef = params.vnp_TxnRef;
    const vnpResponseCode = params.vnp_ResponseCode;
    const vnpTransactionStatus = params.vnp_TransactionStatus;
    const vnpAmount = Number(params.vnp_Amount) / 100; // VNPay sends amount × 100

    if (!vnpTxnRef) {
      return NextResponse.json({
        RspCode: "99",
        Message: "Missing vnp_TxnRef",
      });
    }

    // ── Step 2: Find the order by vnpTxnRef ──
    const orderQuery = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .where("vnpTxnRef", "==", vnpTxnRef)
      .limit(1)
      .get();

    if (orderQuery.empty) {
      console.error(
        `[vnpay-ipn] No order found for vnpTxnRef: ${vnpTxnRef}`
      );
      return NextResponse.json({
        RspCode: "01",
        Message: "Order not found",
      });
    }

    const orderDoc = orderQuery.docs[0];
    const orderId = orderDoc.id;
    const order = { id: orderId, ...orderDoc.data() } as OrderDocument;

    // ── Step 3: Check amount ──
    if (order.finalAmount !== vnpAmount) {
      console.error(
        `[vnpay-ipn] Amount mismatch: expected ${order.finalAmount}, got ${vnpAmount}`
      );
      return NextResponse.json({
        RspCode: "04",
        Message: "Invalid amount",
      });
    }

    // ── Step 4: Idempotency check ──
    if (order.status !== "pending") {
      console.log(
        `[vnpay-ipn] Order ${orderId} already ${order.status} — skipping`
      );
      return NextResponse.json({
        RspCode: "02",
        Message: "Order already confirmed",
      });
    }

    // ── Step 5: Check payment result ──
    if (vnpResponseCode !== "00" || vnpTransactionStatus !== "00") {
      // Payment failed at VNPay — do NOT mark as cancelled here.
      // Just acknowledge. Admin or expiry logic handles cancellation.
      console.log(
        `[vnpay-ipn] Payment not successful: ResponseCode=${vnpResponseCode}, TransactionStatus=${vnpTransactionStatus}`
      );
      return NextResponse.json({
        RspCode: "00",
        Message: "Confirm Success",
      });
    }

    // ── Step 6: Firestore Transaction: confirm payment + generate passes ──
    const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);
    const passIds: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const freshOrderSnap = await tx.get(orderRef);
      const freshOrder = {
        id: orderId,
        ...freshOrderSnap.data(),
      } as OrderDocument;

      // Double-check idempotency inside transaction
      if (freshOrder.status !== "pending") return;

      const generatedIds = generatePassesInTransaction(
        tx,
        orderRef,
        freshOrder,
        {
          orderUpdateExtras: {
            paymentDetails: {
              provider: "vnpay",
              providerData: {
                vnpTxnRef,
                vnpTransactionNo: params.vnp_TransactionNo ?? null,
                vnpResponseCode: vnpResponseCode,
                vnpBankCode: params.vnp_BankCode ?? null,
                vnpPayDate: params.vnp_PayDate ?? null,
                vnpCardType: params.vnp_CardType ?? null,
                vnpBankTranNo: params.vnp_BankTranNo ?? null,
              },
            },
          },
        }
      );
      passIds.push(...generatedIds);
    });

    // ── Step 7: Issue vouchers + send ticket email (after response) ──
    const orderForVoucher = { ...order, id: orderId } as OrderDocument;
    const capturedPassIds = [...passIds];

    after(async () => {
      console.log(
        "[vnpay-ipn] after() started — issuing vouchers for order:",
        orderId
      );
      try {
        const { vouchers, issuedIds } =
          await issueVouchersFromOrderItems(orderForVoucher);
        console.log(
          `[vnpay-ipn] Voucher result: ${issuedIds.length} issued, ${vouchers.length} for email`
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
        console.log("[vnpay-ipn] Ticket email sent successfully");
      } catch (err) {
        console.error("[vnpay-ipn] after() voucher/email error:", err);
      }
    });

    return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    console.error(
      "[vnpay-ipn] Handler error:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
  }
}
