import type { Metadata } from "next";
import { getAffiliateStats } from "@/actions/affiliate/stats";
import { redirect } from "next/navigation";
import { MousePointerClick, ShoppingBag, ArrowUpRight, Calendar } from "lucide-react";

export const metadata: Metadata = { title: "Thống kê chi tiết" };

export default async function AffiliateStatsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let statsData: Awaited<ReturnType<typeof getAffiliateStats>>;

  try {
    statsData = await getAffiliateStats();
  } catch {
    redirect(`/${locale}/auth/login?next=/${locale}/affiliate/stats`);
  }

  const { profile, recentConversions } = statsData!;

  const conversionRate =
    (profile.totalClicks ?? 0) > 0
      ? (((profile.totalConversions ?? 0) / (profile.totalClicks ?? 1)) * 100).toFixed(2)
      : "0.00";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Thống kê chi tiết</h1>
        <p className="text-sm text-gray-500 mt-1">
          Code: <span className="font-bold text-orange-600 font-mono">{profile.referralCode}</span>
          {" · "}
          <span className="text-xs text-gray-400">{profile.trackingLink}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Tổng lượt click",
            value: (profile.totalClicks ?? 0).toLocaleString("vi-VN"),
            icon: MousePointerClick,
            color: "text-blue-600",
            bg: "bg-blue-50",
            sub: "Từ tất cả nguồn",
          },
          {
            label: "Chuyển đổi",
            value: (profile.totalConversions ?? 0).toLocaleString("vi-VN"),
            icon: ShoppingBag,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            sub: `Tỉ lệ ${conversionRate}%`,
          },
          {
            label: "Tổng hoa hồng",
            value: `${(profile.totalCommissionEarned ?? 0).toLocaleString("vi-VN")} đ`,
            icon: ArrowUpRight,
            color: "text-yellow-600",
            bg: "bg-yellow-50",
            sub: `Rate: ${((profile.defaultCommissionRate ?? 0) * 100).toFixed(0)}%`,
          },
          {
            label: "Số dư ví",
            value: `${(profile.walletBalance ?? 0).toLocaleString("vi-VN")} đ`,
            icon: Calendar,
            color: "text-purple-600",
            bg: "bg-purple-50",
            sub: "Khả dụng để rút",
          },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-black text-gray-900 leading-tight">{value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-1">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Lịch sử chuyển đổi</h2>
        </div>
        {recentConversions.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">Chưa có chuyển đổi</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Đơn hàng", "Ngày", "Giá trị đơn", "Hoa hồng"].map((h) => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentConversions.map((c) => (
                <tr key={c.orderId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{c.orderId.slice(0, 12)}…</td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{c.date.toLocaleDateString("vi-VN")}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{c.amount.toLocaleString("vi-VN")} VND</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">+{c.commission.toLocaleString("vi-VN")} VND</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
