import type { Metadata } from "next";
import { getAffiliateStats } from "@/actions/affiliate/stats";
import { redirect } from "next/navigation";
import { MousePointerClick, ShoppingCart, Coins, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AffiliateDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let statsData: Awaited<ReturnType<typeof getAffiliateStats>>;

  try {
    statsData = await getAffiliateStats();
  } catch {
    redirect(`/${locale}/auth/login?next=/${locale}/affiliate`);
  }

  const { profile, recentConversions } = statsData!;

  const statCards = [
    {
      label: "Tổng lượt click",
      value: (profile.totalClicks ?? 0).toLocaleString("vi-VN"),
      icon: MousePointerClick,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Chuyển đổi",
      value: (profile.totalConversions ?? 0).toLocaleString("vi-VN"),
      icon: ShoppingCart,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Hoa hồng tích lũy",
      value: `${(profile.totalCommissionEarned ?? 0).toLocaleString("vi-VN")} VND`,
      icon: Coins,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      label: "Tỉ lệ chuyển đổi",
      value:
        (profile.totalClicks ?? 0) > 0
          ? `${(((profile.totalConversions ?? 0) / (profile.totalClicks ?? 1)) * 100).toFixed(1)}%`
          : "—",
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">
          Xin chào, {profile.displayName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Tracking link:{" "}
          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
            {profile.trackingLink}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex p-2.5 rounded-xl ${bg} mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-black text-gray-900 leading-tight">{value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-sm font-semibold opacity-80 mb-1">Số dư ví hiện tại</p>
        <p className="text-4xl font-black">
          {(profile.walletBalance ?? 0).toLocaleString("vi-VN")}
          <span className="text-xl font-semibold opacity-70 ml-2">VND</span>
        </p>
        <p className="text-sm opacity-70 mt-2">
          Đã rút: {(profile.totalPaidOut ?? 0).toLocaleString("vi-VN")} VND
        </p>
        <a
          href={`/${locale}/affiliate/payouts`}
          className="inline-block mt-4 px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors"
        >
          Yêu cầu rút tiền →
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Chuyển đổi gần đây</h2>
          <p className="text-xs text-gray-400 mt-0.5">10 đơn hàng mới nhất</p>
        </div>
        {recentConversions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            Chưa có chuyển đổi nào. Hãy chia sẻ tracking link!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Đơn hàng", "Giá trị", "Hoa hồng", "Ngày"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide last:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentConversions.map((c) => (
                <tr key={c.orderId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{c.orderId.slice(0, 8)}…</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{c.amount.toLocaleString("vi-VN")} VND</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">+{c.commission.toLocaleString("vi-VN")} VND</td>
                  <td className="px-6 py-4 text-right text-gray-400 text-xs">{c.date.toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
