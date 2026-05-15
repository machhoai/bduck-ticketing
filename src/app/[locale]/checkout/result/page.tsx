// Result page — RSC shell + client polling for pending orders
// Shows Step 3 of the checkout flow with QR codes for each pass
import { getOrderStatus } from "@/actions/orders";
import type { OrderStatusResult } from "@/actions/orders";
import { getBankTransferSettings } from "@/actions/admin/settings";
import { CheckoutResultClient } from "./CheckoutResultClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kết quả thanh toán — B.Duck Cityfuns",
};

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    orderId?: string;
    status?: string;
    error?: string;
    cancel?: string;  // PayOS sends cancel=true when user cancels
  }>;
}

export default async function CheckoutResultPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { orderId, status, error, cancel } = await searchParams;

  // Fetch full order data server-side for initial render
  let orderData: OrderStatusResult | null = null;

  if (orderId) {
    orderData = await getOrderStatus(orderId);
  }

  // Override with explicit redirect params
  // PayOS redirects with status=CANCELLED&cancel=true on user cancellation
  const isCancelled =
    status === "failed" ||
    status === "CANCELLED" ||
    cancel === "true" ||
    !!error;

  // If PayOS user cancelled and order is still pending → mark cancelled in Firestore
  if (isCancelled && orderId && orderData?.status === "pending" && orderData?.paymentProvider === "payos") {
    const { cancelPayOSOrder } = await import("@/actions/checkout");
    cancelPayOSOrder(orderId).catch((err: unknown) =>
      console.error("[checkout/result] Failed to cancel PayOS order:", err)
    );
  } else if (!isCancelled && status === "PAID" && orderId && orderData?.status === "pending" && orderData?.paymentProvider === "payos") {
    // Active fallback sync: if PayOS redirects with success but webhook was missed (e.g. localhost)
    const { syncPayOSPayment } = await import("@/actions/checkout");
    const fulfilled = await syncPayOSPayment(orderId);
    if (fulfilled) {
      orderData = await getOrderStatus(orderId); // Refresh state
    }
  }

  const resolvedStatus = isCancelled
    ? "failed"
    : orderData?.status ?? null;

  // Fetch bank settings for bank_transfer orders
  let bankSettings: { bankId: string; accountNo: string; template: string; accountName: string } | undefined;
  if (orderData?.paymentProvider === "bank_transfer") {
    const config = await getBankTransferSettings();
    if (config) {
      bankSettings = config;
    }
  }

  return (
    <CheckoutResultClient
      orderId={orderId ?? ""}
      locale={locale}
      initialStatus={resolvedStatus}
      initialPassIds={orderData?.passIds ?? []}
      orderNumber={orderData?.orderNumber ?? ""}
      customerEmail={orderData?.customerEmail ?? ""}
      customerName={orderData?.customerName ?? ""}
      items={orderData?.items ?? []}
      finalAmount={orderData?.finalAmount ?? 0}
      discountAmount={orderData?.discountAmount ?? 0}
      passes={orderData?.passes ?? []}
      orderCode={orderData?.orderCode}
      paymentProvider={orderData?.paymentProvider}
      expiresAt={orderData?.expiresAt}
      qrDescription={orderData?.qrDescription}
      bankSettings={bankSettings}
      initialVouchers={orderData?.vouchers}
    />
  );
}
