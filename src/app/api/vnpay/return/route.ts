import { type NextRequest, NextResponse } from "next/server";
import { verifyChecksum, parseVNPayParams } from "@/lib/vnpay";

/**
 * VNPay Return URL Handler
 *
 * Browser redirect from VNPay after customer finishes payment.
 * This route ONLY verifies checksum and redirects to the result page.
 * It does NOT update order status — that's the IPN handler's responsibility.
 *
 * GET /api/vnpay/return?vnp_Amount=...&vnp_ResponseCode=00&vnp_SecureHash=...
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const params = parseVNPayParams(searchParams);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const locale = request.cookies.get("NEXT_LOCALE")?.value || "vi";
  const basePath = locale === "vi" 
    ? `${appUrl}/checkout/result` 
    : `${appUrl}/${locale}/checkout/result`;

  const vnpTxnRef = params.vnp_TxnRef ?? "";
  const vnpResponseCode = params.vnp_ResponseCode ?? "";

  // Try to find orderId from vnpTxnRef for redirect
  // vnpTxnRef format: "BDUCK-{date}-{random}" — we use it as lookup key
  let orderId = "";

  try {
    // Verify checksum
    const isValid = verifyChecksum(params);

    if (!isValid) {
      console.error("[vnpay-return] Invalid checksum");
      return NextResponse.redirect(`${basePath}?error=invalid_signature`);
    }

    // Look up order by vnpTxnRef to get orderId for redirect
    if (vnpTxnRef) {
      const { adminDb } = await import("@/lib/firebase/admin");
      const { COLLECTIONS } = await import("@/lib/firebase/client");

      const orderQuery = await adminDb
        .collection(COLLECTIONS.ORDERS)
        .where("vnpTxnRef", "==", vnpTxnRef)
        .limit(1)
        .get();

      if (!orderQuery.empty) {
        orderId = orderQuery.docs[0].id;
      }
    }

    // Determine payment result
    const isSuccess = vnpResponseCode === "00";

    if (orderId) {
      const status = isSuccess ? "success" : "failed";
      return NextResponse.redirect(
        `${basePath}?orderId=${orderId}&status=${status}`
      );
    } else {
      return NextResponse.redirect(
        `${basePath}?error=order_not_found`
      );
    }
  } catch (error) {
    console.error(
      "[vnpay-return] Error:",
      error instanceof Error ? error.message : error
    );
    if (orderId) {
      return NextResponse.redirect(
        `${basePath}?orderId=${orderId}&error=server_error`
      );
    }
    return NextResponse.redirect(
      `${basePath}?error=server_error`
    );
  }
}
