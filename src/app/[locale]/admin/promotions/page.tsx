import { getPromotions, deactivatePromotion } from "@/actions/admin/promotions";
import Link from "next/link";
import { Plus, PowerOff } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Khuyến mãi" };
export const dynamic = "force-dynamic";

function formatVND(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

export default async function AdminPromotionsPage() {
  const promos = await getPromotions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🏷️ Khuyến mãi</h1>
          <p className="text-sm text-gray-400 mt-1">{promos.length} mã giảm giá</p>
        </div>
        <Link href="promotions/new">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors">
            <Plus className="h-4 w-4" /> Tạo mã mới
          </button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                {["Mã", "Loại", "Giá trị", "Đã dùng/Max", "Trạng thái", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {promos.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-[#1A1A2E]">{promo.code}</td>
                  <td className="px-4 py-3 text-gray-500">{promo.type === "percentage" ? "Phần trăm" : "Cố định"}</td>
                  <td className="px-4 py-3 font-semibold">
                    {promo.type === "percentage"
                      ? `${promo.discountValue}%`
                      : formatVND(promo.discountValue)}
                    {promo.minOrderValue && (
                      <span className="text-xs text-gray-400 ml-1">
                        (min {formatVND(promo.minOrderValue)})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-[#F5C842] h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, (promo.usedCount / promo.maxUses) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{promo.usedCount}/{promo.maxUses}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${promo.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"}`}>
                      {promo.status === "active" ? "Đang chạy" : "Đã tắt"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {promo.status === "active" && (
                      <form action={async () => {
                        "use server";
                        await deactivatePromotion(promo.id);
                      }}>
                        <button type="submit" className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                          <PowerOff className="h-3 w-3" /> Tắt
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {promos.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">Chưa có mã khuyến mãi nào</div>
          )}
        </div>
      </div>
    </div>
  );
}
