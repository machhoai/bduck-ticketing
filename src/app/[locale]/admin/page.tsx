import { getDashboardStats } from "@/actions/admin/dashboard";
import { DashboardRevenueFilter } from "@/components/admin/DashboardRevenueFilter";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function formatVND(amount: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ts: { toDate(): Date }) {
  return ts.toDate().toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

const STATUS_STYLE: Record<string, { label: string; style: string }> = {
  paid:      { label: "Đã TT",  style: "bg-emerald-50 text-emerald-600" },
  pending:   { label: "Chờ TT", style: "bg-amber-50 text-amber-600" },
  cancelled: { label: "Đã hủy", style: "bg-red-50 text-red-500" },
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">📊 Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Phân tích doanh thu & tổng quan hoạt động</p>
      </div>

      {/* ── Interactive Revenue Filter (client-driven date picker) ── */}
      <DashboardRevenueFilter
        pendingAffiliates={stats.pendingAffiliates}
        totalPassesIssued={stats.totalPassesIssued}
      />

      {/* ── Recent Orders ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-[#1A1A2E]">Đơn hàng gần nhất</h2>
          <Link
            href="admin/orders"
            className="text-xs font-semibold text-gray-400 hover:text-[#1A1A2E] flex items-center gap-1 transition-colors"
          >
            Xem tất cả <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                {["Mã đơn", "Khách hàng", "Tổng tiền", "Trạng thái", "Ngày"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentOrders.map((order) => {
                const st = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending;
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      <Link href={`admin/orders/${order.id}`} className="hover:text-[#1A1A2E] transition-colors">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1A1A2E]">{order.customerName}</td>
                    <td className="px-4 py-3 font-semibold">{formatVND(order.finalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.style}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {formatDate(order.createdAt as any)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {stats.recentOrders.length === 0 && (
            <div className="text-center py-12 text-gray-400">Chưa có đơn hàng nào</div>
          )}
        </div>
      </div>
    </div>
  );
}
