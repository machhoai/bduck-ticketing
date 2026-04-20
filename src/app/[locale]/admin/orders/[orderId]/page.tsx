import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminOrderById, voidPass } from "@/actions/admin/orders";
import {
  ArrowLeft, AlertTriangle, CreditCard, User, Package, Ticket,
  Clock, CheckCircle2, XCircle, QrCode, Phone, Mail, Hash,
  Banknote, Tag, UserCheck, Gift, Calendar, FileText
} from "lucide-react";
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
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}

function formatDateTime(ts: { toMillis(): number } | undefined) {
  if (!ts) return "—";
  return new Date(ts.toMillis()).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value, mono = false, accent = false }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className={`text-sm mt-0.5 break-all ${mono ? "font-mono text-xs" : "font-semibold"} ${accent ? "text-[#E68B00]" : "text-[#1A1A2E]"}`}>
          {value ?? "—"}
        </p>
      </div>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, color = "gray" }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  color?: "gray" | "yellow" | "blue" | "emerald" | "red" | "purple";
}) {
  const colors = {
    gray:    "bg-gray-50 text-gray-500",
    yellow:  "bg-[#FFF9E6] text-[#E68B00]",
    blue:    "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    red:     "bg-red-50 text-red-500",
    purple:  "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg ${colors[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-bold text-[#1A1A2E] text-sm">{title}</h2>
      </div>
      <div className="px-5 divide-y divide-gray-50">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { locale, orderId } = await params;
  const order = await getAdminOrderById(orderId);
  if (!order) notFound();

  const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ElementType }> = {
    paid:      { label: "Đã thanh toán",  style: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    pending:   { label: "Chờ thanh toán", style: "bg-amber-50 text-amber-600 border-amber-200",       icon: Clock },
    cancelled: { label: "Đã hủy",         style: "bg-red-50 text-red-500 border-red-200",             icon: XCircle },
  };
  const PASS_STATUS: Record<string, { label: string; style: string }> = {
    active:  { label: "Hiệu lực",  style: "bg-emerald-50 text-emerald-600" },
    used:    { label: "Đã dùng",   style: "bg-gray-100 text-gray-500" },
    voided:  { label: "Vô hiệu",   style: "bg-red-50 text-red-500" },
    expired: { label: "Hết hạn",   style: "bg-amber-50 text-amber-600" },
  };

  const st = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = st.icon;

  // Deserialize payment details
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pd = order.paymentDetails as any;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/admin/orders`}
          className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#1A1A2E]">#{order.orderNumber}</h1>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.style}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {st.label}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{order.id}</p>
        </div>
      </div>

      {/* ── 2-column grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Customer Info */}
        <SectionCard title="Khách hàng" icon={User} color="blue">
          <InfoRow icon={User}     label="Họ tên"   value={order.customerName} />
          <InfoRow icon={Mail}     label="Email"    value={order.customerEmail} mono />
          {order.customerPhone && <InfoRow icon={Phone} label="SĐT" value={order.customerPhone} />}
          <InfoRow
            icon={UserCheck}
            label="Loại"
            value={order.isGuestOrder ? "Khách vãng lai" : "Thành viên"}
          />
          {order.customerId && !order.isGuestOrder && (
            <InfoRow icon={Hash} label="User ID" value={order.customerId} mono />
          )}
        </SectionCard>

        {/* Timing */}
        <SectionCard title="Thời gian" icon={Calendar} color="gray">
          <InfoRow icon={Calendar}     label="Tạo đơn"       value={formatDateTime(order.createdAt as any)} />
          {order.paidAt    && <InfoRow icon={CheckCircle2} label="Thanh toán lúc" value={formatDateTime(order.paidAt)} />}
          {order.cancelledAt && <InfoRow icon={XCircle}   label="Hủy lúc"        value={formatDateTime(order.cancelledAt)} />}
          {order.expiresAt   && (
            <InfoRow icon={Clock} label="Hết hạn (quầy)" value={formatDateTime(order.expiresAt)} />
          )}
          {order.cancelReason && <InfoRow icon={FileText} label="Lý do hủy" value={order.cancelReason} />}
        </SectionCard>
      </div>

      {/* ── Payment Details ── */}
      <SectionCard title="Thanh toán" icon={CreditCard} color="yellow">
        <InfoRow icon={Banknote}   label="Tổng tiền hàng" value={formatVND(order.subtotal)} />
        {order.discountAmount > 0 && (
          <InfoRow icon={Tag} label={`Giảm giá${order.promotionCode ? ` (${order.promotionCode})` : ""}`}
            value={`-${formatVND(order.discountAmount)}`} accent />
        )}
        <InfoRow icon={CreditCard} label="Tổng thanh toán" value={<span className="text-lg font-extrabold text-[#1A1A2E]">{formatVND(order.finalAmount)}</span>} />
        <InfoRow icon={Package}    label="Phương thức"     value={
          pd?.provider === "counter" ? "Thanh toán tại quầy" :
          pd?.provider === "vnpay"   ? "VNPay" :
          pd?.provider === "mock"    ? "Giả lập (dev)" :
          "—"
        } />
        {/* Counter payment details */}
        {pd?.provider === "counter" && (
          <>
            {order.orderCode && (
              <InfoRow icon={QrCode} label="Mã QR quầy" value={order.orderCode} mono accent />
            )}
            {pd?.providerData?.confirmedBy && (
              <InfoRow icon={UserCheck} label="Xác nhận bởi" value={pd.providerData.confirmedBy} mono />
            )}
            {pd?.providerData?.confirmedAt && (
              <InfoRow icon={CheckCircle2} label="Xác nhận lúc" value={formatDateTime(pd.providerData.confirmedAt)} />
            )}
            {pd?.providerData?.note && (
              <InfoRow icon={FileText} label="Ghi chú" value={pd.providerData.note} />
            )}
          </>
        )}
        {/* VNPay details */}
        {pd?.provider === "vnpay" && pd?.providerData && (
          <>
            <InfoRow icon={Hash}    label="VNPay Txn Ref"  value={pd.providerData.vnpTxnRef}        mono />
            {pd.providerData.vnpTransactionNo && (
              <InfoRow icon={Hash}  label="VNPay Txn No"   value={pd.providerData.vnpTransactionNo} mono />
            )}
            {pd.providerData.vnpBankCode && (
              <InfoRow icon={CreditCard} label="Ngân hàng" value={pd.providerData.vnpBankCode} />
            )}
          </>
        )}
      </SectionCard>

      {/* ── Affiliate Tracking ── */}
      {(order.affiliateId || order.affiliateCode) && (
        <SectionCard title="Affiliate" icon={Gift} color="purple">
          {order.affiliateCode && <InfoRow icon={Tag}      label="Mã affiliate"   value={order.affiliateCode} mono />}
          {order.affiliateId   && <InfoRow icon={UserCheck} label="Affiliate ID"  value={order.affiliateId}   mono />}
          {order.affiliateCommissionAmount !== undefined && (
            <InfoRow icon={Banknote} label="Hoa hồng" value={formatVND(order.affiliateCommissionAmount)} accent />
          )}
        </SectionCard>
      )}

      {/* ── Order Items ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Package className="h-4 w-4" />
          </div>
          <h2 className="font-bold text-[#1A1A2E] text-sm">Chi tiết đơn hàng ({order.items.length} sản phẩm)</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Sản phẩm</th>
              <th className="px-5 py-3 text-center font-medium w-16">SL</th>
              <th className="px-5 py-3 text-right font-medium">Đơn giá</th>
              <th className="px-5 py-3 text-right font-medium">Tổng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {order.items.map((item, i) => (
              <tr key={i}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-[#1A1A2E]">{item.productName}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{item.productId}</p>
                  <p className="text-xs text-gray-400 capitalize mt-0.5">{item.productType}</p>
                </td>
                <td className="px-5 py-3 text-center text-gray-600 font-semibold">×{item.quantity}</td>
                <td className="px-5 py-3 text-right text-gray-500">{formatVND(item.unitPrice)}</td>
                <td className="px-5 py-3 text-right font-bold text-[#1A1A2E]">{formatVND(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            {order.discountAmount > 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-2 text-sm text-gray-500">Giảm giá ({order.promotionCode})</td>
                <td className="px-5 py-2 text-right text-emerald-600 font-semibold">-{formatVND(order.discountAmount)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-5 py-3 font-bold text-[#1A1A2E]">Tổng thanh toán</td>
              <td className="px-5 py-3 text-right font-extrabold text-[#1A1A2E] text-base">{formatVND(order.finalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Issued Passes ── */}
      {order.passes.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Ticket className="h-4 w-4" />
            </div>
            <h2 className="font-bold text-[#1A1A2E] text-sm">Vé đã phát hành ({order.passes.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {order.passes.map((pass) => {
              const st = PASS_STATUS[pass.status] ?? PASS_STATUS.active;
              return (
                <div key={pass.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#1A1A2E]">{pass.productName}</p>
                      <p className="font-mono text-xs text-gray-400 mt-0.5">BDUCK-PASS-{pass.id.slice(-10).toUpperCase()}</p>
                      <p className="font-mono text-[10px] text-gray-300 mt-0.5">{pass.id}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.style}`}>
                        {st.label}
                      </span>
                      {pass.status === "active" && (
                        <form action={async (formData: FormData) => {
                          "use server";
                          const reason = String(formData.get("reason") ?? "Admin void").trim();
                          await voidPass(pass.id, reason);
                        }}>
                          <div className="flex items-center gap-1.5">
                            <input
                              name="reason"
                              placeholder="Lý do..."
                              required
                              className="text-xs px-2 py-1 border border-gray-200 rounded-lg w-28 focus:outline-none focus:ring-1 focus:ring-red-300"
                            />
                            <button
                              type="submit"
                              className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              Vô hiệu
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                  {/* Pass metadata */}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(pass as any).validFrom && <span>Hiệu lực từ: <strong className="text-gray-600">{formatDateTime((pass as any).validFrom)}</strong></span>}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(pass as any).validUntil && <span>Đến: <strong className="text-gray-600">{formatDateTime((pass as any).validUntil)}</strong></span>}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(pass as any).usedAt && <span>Đã quét lúc: <strong className="text-gray-600">{formatDateTime((pass as any).usedAt)}</strong></span>}
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
