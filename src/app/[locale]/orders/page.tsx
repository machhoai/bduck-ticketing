// Orders page — RSC with D8 security: session cookie verification
// Guest users must use emailed link with HMAC token (not this page)
import { setRequestLocale } from "next-intl/server";
import { getMyOrders } from "@/actions/orders";
import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi — B.Duck Cityfuns",
  robots: "noindex",
};

interface PageProps {
  params: Promise<{ locale: string }>;
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function formatDate(ts: { toDate(): Date }): string {
  return ts.toDate().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  paid: { label: "Đã thanh toán", color: "text-emerald-600 bg-emerald-50" },
  pending: { label: "Đang xử lý", color: "text-amber-600 bg-amber-50" },
  cancelled: { label: "Đã hủy", color: "text-red-600 bg-red-50" },
};

export default async function OrdersPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  // D8: getMyOrders() reads session cookie server-side — never trusts client UID
  const orders = await getMyOrders();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-8">
        📦 Đơn hàng của tôi
      </h1>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400 space-y-3">
          <Package className="h-16 w-16 mx-auto opacity-20" />
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link href={`/${locale}`}>
            <button className="mt-2 px-6 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-full text-sm">
              Mua vé ngay
            </button>
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            Là khách vãng lai? Kiểm tra email để tìm link xem đơn hàng của bạn.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusConfig =
              STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            return (
              <div
                key={order.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-bold text-[#1A1A2E] text-sm">
                      {order.orderNumber}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(order.createdAt as any)}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Items summary */}
                <div className="mt-3 space-y-1">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-gray-600 line-clamp-1">
                        {item.productName} × {item.quantity}
                      </span>
                      <span className="text-gray-800 font-medium flex-shrink-0 ml-2">
                        {formatVND(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex items-center justify-between">
                  <span className="font-bold text-[#1A1A2E]">
                    {formatVND(order.finalAmount)}
                  </span>
                  {order.passIds.length > 0 && (
                    <Link
                      href={`/${locale}/tickets-wallet/${order.passIds[0]}`}
                      className="flex items-center gap-1 text-sm text-[#F5C842] font-semibold hover:underline"
                    >
                      Xem vé <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
