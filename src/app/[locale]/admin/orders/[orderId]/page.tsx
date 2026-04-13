import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminOrderById, voidPass } from "@/actions/admin/orders";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; orderId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;
  return { title: `Đơn hàng #${orderId.slice(-8).toUpperCase()}` };
}

function formatVND(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { locale, orderId } = await params;
  const order = await getAdminOrderById(orderId);
  if (!order) notFound();

  const PASS_STATUS: Record<string, { label: string; style: string }> = {
    active: { label: "Hiệu lực", style: "bg-emerald-50 text-emerald-600" },
    used: { label: "Đã dùng", style: "bg-gray-100 text-gray-500" },
    voided: { label: "Vô hiệu", style: "bg-red-50 text-red-500" },
    expired: { label: "Hết hạn", style: "bg-amber-50 text-amber-600" },
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/admin/orders`} className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-xl transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">
            Đơn #{order.orderNumber}
          </h1>
          <p className="text-sm text-gray-400">ID: {order.id}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
        <h2 className="font-bold text-[#1A1A2E] mb-3">Thông tin khách hàng</h2>
        <p className="text-sm"><span className="text-gray-400">Tên:</span> <span className="font-semibold">{order.customerName}</span></p>
        <p className="text-sm"><span className="text-gray-400">Email:</span> {order.customerEmail}</p>
        {order.customerPhone && <p className="text-sm"><span className="text-gray-400">SDT:</span> {order.customerPhone}</p>}
        <p className="text-sm"><span className="text-gray-400">Loại:</span> {order.isGuestOrder ? "Khách vãng lai" : "Thành viên"}</p>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-[#1A1A2E]">Chi tiết đơn hàng</h2>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gray-50">
            {order.items.map((item, i) => (
              <tr key={i}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-[#1A1A2E]">{item.productName}</p>
                  <p className="text-xs text-gray-400">× {item.quantity}</p>
                </td>
                <td className="px-5 py-3 text-right font-semibold">{formatVND(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            {order.discountAmount > 0 && (
              <tr>
                <td className="px-5 py-2 text-sm text-gray-500">Giảm giá ({order.promotionCode})</td>
                <td className="px-5 py-2 text-right text-emerald-600 font-semibold">-{formatVND(order.discountAmount)}</td>
              </tr>
            )}
            <tr>
              <td className="px-5 py-3 font-bold text-[#1A1A2E]">Tổng thanh toán</td>
              <td className="px-5 py-3 text-right font-extrabold text-[#1A1A2E] text-base">{formatVND(order.finalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Passes */}
      {order.passes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-[#1A1A2E]">Vé đã phát hành ({order.passes.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {order.passes.map((pass) => {
              const st = PASS_STATUS[pass.status] ?? PASS_STATUS.active;
              return (
                <div key={pass.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs text-gray-400 mb-0.5">BDUCK-PASS-{pass.id.slice(-8).toUpperCase()}</p>
                    <p className="text-sm font-semibold text-[#1A1A2E]">{pass.productName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.style}`}>
                      {st.label}
                    </span>
                    {pass.status === "active" && (
                      <form action={async (formData: FormData) => {
                        "use server";
                        const reason = String(formData.get("reason") ?? "Admin void").trim();
                        await voidPass(pass.id, reason);
                      }}>
                        <input name="reason" placeholder="Lý do vô hiệu hóa" required className="text-xs px-2 py-1 border border-gray-200 rounded-lg mr-2 w-36" />
                        <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                          <AlertTriangle className="h-3 w-3" />
                          Vô hiệu hóa
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
