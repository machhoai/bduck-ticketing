import Link from "next/link";
import { getAdminOrders } from "@/actions/admin/orders";
import { Search } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Đơn hàng" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { label: string; style: string }> = {
  paid: { label: "Đã TT", style: "bg-emerald-50 text-emerald-600" },
  pending: { label: "Chờ TT", style: "bg-amber-50 text-amber-600" },
  cancelled: { label: "Đã hủy", style: "bg-red-50 text-red-500" },
};

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string; cursor?: string }>;
}

function formatVND(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}
function formatDate(ts: { toDate(): Date }) {
  return ts.toDate().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const { status, q, cursor } = await searchParams;

  const { orders, hasMore } = await getAdminOrders({
    status: status as "pending" | "paid" | "cancelled" | undefined,
    search: q,
    startAfter: cursor,
    limit: 25,
  });

  const statusTabs = ["", "paid", "pending", "cancelled"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">📦 Đơn hàng</h1>
        <p className="text-sm text-gray-400 mt-1">{orders.length} kết quả</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {statusTabs.map((s) => (
            <Link
              key={s}
              href={`?${s ? `status=${s}` : ""}${q ? `&q=${q}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                (status ?? "") === s
                  ? "bg-[#1A1A2E] text-white"
                  : "text-gray-500 hover:text-[#1A1A2E]"
              }`}
            >
              {s === "" ? "Tất cả" : STATUS_STYLE[s]?.label ?? s}
            </Link>
          ))}
        </div>

        <form className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 min-w-52">
          <Search className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Tìm theo mã đơn, email, tên..."
            className="text-sm flex-1 outline-none bg-transparent"
          />
          {status && <input type="hidden" name="status" value={status} />}
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                {["Mã đơn", "Khách hàng", "Email", "Tổng tiền", "Trạng thái", "Ngày", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => {
                const st = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending;
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.orderNumber}</td>
                    <td className="px-4 py-3 font-semibold text-[#1A1A2E]">{order.customerName}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{order.customerEmail}</td>
                    <td className="px-4 py-3 font-semibold">{formatVND(order.finalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.style}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(order.createdAt as any)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`orders/${order.id}`}
                        className="text-xs text-[#F5C842] font-semibold hover:underline"
                      >
                        Chi tiết →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {orders.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">Không có đơn hàng nào</div>
          )}
        </div>

        {hasMore && orders.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-center">
            <Link
              href={`?${status ? `status=${status}&` : ""}${q ? `q=${q}&` : ""}cursor=${orders[orders.length - 1].id}`}
              className="text-sm text-[#1A1A2E] font-semibold hover:underline"
            >
              Xem thêm →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
