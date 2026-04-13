import { getDashboardStats } from "@/actions/admin/dashboard";
import { StatCard } from "@/components/admin/StatCard";
import { DollarSign, ShoppingBag, Ticket, Users } from "lucide-react";
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

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  cancelled: "bg-red-50 text-red-500",
};

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">📊 Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Tổng quan 30 ngày gần nhất</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Doanh thu (30 ngày)"
          value={formatVND(stats.revenueThirtyDays)}
          icon={DollarSign}
          color="yellow"
        />
        <StatCard
          label="Đơn hàng (30 ngày)"
          value={stats.ordersThirtyDays}
          icon={ShoppingBag}
          color="blue"
        />
        <StatCard
          label="Vé đã phát hành"
          value={stats.totalPassesIssued}
          icon={Ticket}
          color="emerald"
        />
        <StatCard
          label="Affiliate chờ duyệt"
          value={stats.pendingAffiliates}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-[#1A1A2E]">Đơn hàng gần nhất</h2>
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
              {stats.recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{order.orderNumber}</td>
                  <td className="px-4 py-3 font-medium text-[#1A1A2E]">{order.customerName}</td>
                  <td className="px-4 py-3 font-semibold">{formatVND(order.finalAmount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[order.status] ?? ""}`}>
                      {order.status === "paid" ? "Đã TT" : order.status === "pending" ? "Chờ TT" : "Đã hủy"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(order.createdAt as any)}</td>
                </tr>
              ))}
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
