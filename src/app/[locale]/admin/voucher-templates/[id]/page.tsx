import { getAdminVoucherTemplate, getIssuedVouchersForTemplate } from "@/actions/admin/voucherTemplates";
import { VoucherTemplateForm } from "@/components/admin/VoucherTemplateForm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { IssuedVoucherDocument } from "@/types/firestore";

export const metadata: Metadata = { title: "Chỉnh sửa mẫu Voucher — Admin" };
export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ locale: string; id: string }>;
}

function formatDate(ts: any) {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const STATUS_BADGE: Record<IssuedVoucherDocument["status"], string> = {
    active: "bg-emerald-50 text-emerald-600",
    redeemed: "bg-blue-50 text-blue-600",
    expired: "bg-gray-100 text-gray-400",
};
const STATUS_LABEL: Record<IssuedVoucherDocument["status"], string> = {
    active: "Còn hiệu lực",
    redeemed: "Đã đổi",
    expired: "Hết hạn",
};

export default async function EditVoucherTemplatePage({ params }: Props) {
    const { locale, id } = await params;
    const [template, issued] = await Promise.all([
        getAdminVoucherTemplate(id),
        getIssuedVouchersForTemplate(id, 50),
    ]);

    if (!template) notFound();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-extrabold text-[#1A1A2E]">✏️ Chỉnh sửa mẫu Voucher</h1>
                <p className="text-sm text-gray-400 mt-1">{template.name}</p>
            </div>

            <VoucherTemplateForm template={template} locale={locale} />

            {/* Issued voucher history */}
            <div className="space-y-3">
                <h2 className="text-lg font-bold text-[#1A1A2E]">
                    📋 Kho lịch sử phát ({template.totalIssued})
                </h2>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                                <tr>
                                    {["Code", "Khách hàng", "Đơn hàng", "Phát lúc", "Hết hạn", "Trạng thái"].map((h) => (
                                        <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {issued.map((v: any) => (
                                    <tr key={v.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono font-bold text-[#1A1A2E] text-xs">{v.code}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-700">{v.customerName}</div>
                                            <div className="text-xs text-gray-400">{v.customerPhone || v.customerEmail}</div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.orderNumber}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(v.issuedAt)}</td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{formatDate(v.expiresAt)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[v.status as IssuedVoucherDocument["status"]]}`}>
                                                {STATUS_LABEL[v.status as IssuedVoucherDocument["status"]]}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {issued.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm">Chưa có voucher nào được phát từ mẫu này</div>
                        )}
                    </div>
                    {template.totalIssued > 50 && (
                        <div className="px-4 py-3 bg-gray-50 text-xs text-gray-400 border-t border-gray-100">
                            Hiển thị 50 / {template.totalIssued} voucher gần nhất
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
