import { getAdminVoucherTemplates, toggleVoucherTemplateStatus, deleteVoucherTemplate } from "@/actions/admin/voucherTemplates";
import Link from "next/link";
import { Plus, TicketPercent, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { Metadata } from "next";
import type { VoucherTemplateDocument } from "@/types/firestore";

export const metadata: Metadata = { title: "Mẫu Voucher — Admin" };
export const dynamic = "force-dynamic";

const VOUCHER_TYPE_LABELS: Record<VoucherTemplateDocument["voucherType"], string> = {
    online_discount: "Giảm giá online",
    instore_points: "Điểm cửa hàng",
    instore_gift: "Quà tặng tại quầy",
};

const VOUCHER_TYPE_COLORS: Record<VoucherTemplateDocument["voucherType"], string> = {
    online_discount: "bg-blue-50 text-blue-600",
    instore_points: "bg-amber-50 text-amber-600",
    instore_gift: "bg-emerald-50 text-emerald-600",
};

export default async function AdminVoucherTemplatesPage() {
    const templates = await getAdminVoucherTemplates();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#1A1A2E] flex items-center gap-2">
                        <TicketPercent className="h-6 w-6 text-[#F5C842]" />
                        Mẫu Voucher
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {templates.length} mẫu · Quản lý cấu hình voucher phát tự động
                    </p>
                </div>
                <Link href="voucher-templates/new">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors">
                        <Plus className="h-4 w-4" /> Tạo mẫu mới
                    </button>
                </Link>
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                💡 <strong>Voucher tự động:</strong> Khi khách mua sản phẩm trong Deal Section có gắn mẫu voucher, hệ thống sẽ tự tạo và gửi code qua email sau khi thanh toán. Kho lịch sử phát voucher ghi đầy đủ trên trang chi tiết mỗi mẫu.
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                            <tr>
                                {["Tên mẫu", "Loại", "Mã (prefix…suffix)", "Hạn sử dụng", "Đã phát / Đã đổi", "Trạng thái", ""].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {templates.map((tpl) => (
                                <tr key={tpl.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-[#1A1A2E]">{tpl.name}</div>
                                        {tpl.description && (
                                            <div className="text-xs text-gray-400 truncate max-w-[200px]">{tpl.description}</div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${VOUCHER_TYPE_COLORS[tpl.voucherType]}`}>
                                            {VOUCHER_TYPE_LABELS[tpl.voucherType]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                                        {tpl.codePrefix || ""}<span className="text-gray-300">{"X".repeat(tpl.codeLength)}</span>{tpl.codeSuffix || ""}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">
                                        {tpl.validDays} ngày
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-semibold text-gray-700">{tpl.totalIssued}</span>
                                        <span className="text-gray-400 mx-1">/</span>
                                        <span className="text-emerald-600 font-semibold">{tpl.totalRedeemed}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tpl.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                            {tpl.isActive ? "Đang dùng" : "Tắt"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Link href={`voucher-templates/${tpl.id}`}>
                                                <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#1A1A2E] transition-colors" title="Chỉnh sửa">
                                                    <Edit className="h-3.5 w-3.5" />
                                                </button>
                                            </Link>
                                            <form action={async () => {
                                                "use server";
                                                await toggleVoucherTemplateStatus(tpl.id, !tpl.isActive);
                                            }}>
                                                <button type="submit" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#1A1A2E] transition-colors" title={tpl.isActive ? "Tắt" : "Bật"}>
                                                    {tpl.isActive ? <ToggleRight className="h-3.5 w-3.5 text-emerald-500" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                                </button>
                                            </form>
                                            {tpl.totalIssued === 0 && (
                                                <form action={async () => {
                                                    "use server";
                                                    await deleteVoucherTemplate(tpl.id);
                                                }}>
                                                    <button type="submit" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="Xoá">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </form>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {templates.length === 0 && (
                        <div className="text-center py-16 text-gray-400 text-sm">
                            <TicketPercent className="h-10 w-10 mx-auto mb-3 opacity-20" />
                            Chưa có mẫu voucher nào
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
