import { getDashboardStats } from "@/actions/admin/dashboard";
import { DashboardRevenueFilter } from "@/components/admin/DashboardRevenueFilter";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">📊 Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Phân tích doanh thu & tổng quan hoạt động</p>
      </div>

      {/* ── Interactive Revenue Filter (client-driven date picker + orders) ── */}
      <DashboardRevenueFilter
        pendingAffiliates={stats.pendingAffiliates}
        totalPassesIssued={stats.totalPassesIssued}
      />
    </div>
  );
}
