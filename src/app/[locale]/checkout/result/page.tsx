// Result page — RSC shell + client polling for pending orders (D4: READ ONLY)
// Pass creation happens in /api/mock-pay webhook, NOT here
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { getOrderStatus } from "@/actions/orders";
import { ResultPoller } from "./ResultPoller";
import type { Metadata } from "next";

export const dynamic = "force-dynamic"; // always fresh

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

  if (!orderId) {
    return (
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#1A1A2E] mb-2">
          Đơn hàng không tìm thấy
        </h1>
        <Link href={`/${locale}`} className="text-sm text-[#F5C842] font-semibold hover:underline">
          ← Quay về trang chủ
        </Link>
      </main>
    );
  }

  // If webhook already redirected with explicit status, skip fetch
  if (status === "failed" || error) {
    return (
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#1A1A2E] mb-2">
          Thanh toán thất bại
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Giao dịch không thành công. Vui lòng thử lại.
        </p>
        <Link href={`/${locale}/checkout`}>
          <button className="px-6 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-full">
            Thử lại
          </button>
        </Link>
      </main>
    );
  }

  // Fetch current order status (RSC — no auth required for polling)
  const orderStatus = await getOrderStatus(orderId);

  if (!orderStatus) {
    return (
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <XCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#1A1A2E]">Không tìm thấy đơn hàng</h1>
      </main>
    );
  }

  // If paid: show success
  if (orderStatus.status === "paid") {
    return (
      <main className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
        <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto" />
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">
            🎉 Thanh toán thành công!
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Vé của bạn đã được tạo. Kiểm tra email để nhận vé điện tử.
          </p>
        </div>

        {orderStatus.passIds.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[#1A1A2E]">
              Vé của bạn ({orderStatus.passIds.length} vé):
            </p>
            {orderStatus.passIds.map((passId) => (
              <Link
                key={passId}
                href={`/${locale}/tickets-wallet/${passId}`}
                className="block px-4 py-3 bg-[#F5C842]/10 border border-[#F5C842] rounded-xl text-sm font-semibold text-[#1A1A2E] hover:bg-[#F5C842]/20 transition-colors"
              >
                🎟️ Xem vé #{passId.slice(-8).toUpperCase()}
              </Link>
            ))}
          </div>
        )}

        <Link href={`/${locale}`}>
          <button className="text-sm text-gray-400 hover:text-[#1A1A2E] transition-colors">
            ← Về trang chủ
          </button>
        </Link>
      </main>
    );
  }

  // If still pending: show polling UI (client component)
  return (
    <main className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
      <Loader2 className="h-16 w-16 text-[#F5C842] mx-auto animate-spin" />
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">
          Đang xử lý thanh toán...
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Vui lòng không đóng trang này.
        </p>
      </div>
      {/* Client component handles polling every 3s */}
      <ResultPoller orderId={orderId} locale={locale} />
    </main>
  );
}
