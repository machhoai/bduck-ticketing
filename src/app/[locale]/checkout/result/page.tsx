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
  }>;
}

export default async function CheckoutResultPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  const { orderId, status, error } = await searchParams;

  // Fetch full order data server-side for initial render
  let orderData: OrderStatusResult | null = null;

  if (orderId) {
    orderData = await getOrderStatus(orderId);
  }

  // Override with explicit redirect params
  const resolvedStatus =
    status === "failed" || error
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
