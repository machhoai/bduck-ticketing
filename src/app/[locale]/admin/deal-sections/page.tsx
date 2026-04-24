import { getAdminDealSections, toggleDealSectionStatus, deleteDealSection } from "@/actions/admin/dealSections";
import Link from "next/link";
import { Plus, Zap, Edit, Trash2, ToggleLeft, ToggleRight, Clock, Package } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Deal Sections — Admin" };
export const dynamic = "force-dynamic";

function formatDate(ts: any) {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function AdminDealSectionsPage() {
    const sections = await getAdminDealSections();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#1A1A2E] flex items-center gap-2">
                        <Zap className="h-6 w-6 text-[#F5C842]" />
                        Deal Sections
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {sections.length} section · Quản lý Flash Sale & chương trình khuyến mãi theo section
                    </p>
                </div>
                <Link href="deal-sections/new">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors">
                        <Plus className="h-4 w-4" /> Tạo section mới
                    </button>
                </Link>
            </div>

            {/* Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
                ⚡ <strong>Time Gate:</strong> Nếu section có cài giờ mở bán (ví dụ 10:00 AM), khách hàng không thể mua trước giờ đó.
                Kiểm tra xác thực được thực hiện phía server, không cần cron job.
            </div>

            {/* Cards */}
            <div className="space-y-4">
                {sections.map((section) => (
                    <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                {/* Order badge */}
                                <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-[#F5C842]/20 flex items-center justify-center text-xs font-bold text-[#1A1A2E]">
                                    #{section.order}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-[#1A1A2E]">{section.title}</h3>
                                        {section.badgeLabel && (
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-500">{section.badgeLabel}</span>
                                        )}
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${section.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-400"}`}>
                                            {section.isActive ? "Đang hiện" : "Ẩn"}
                                        </span>
                                    </div>
                                    {section.description && (
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">{section.description}</p>
                                    )}

                                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                                        {/* Time gate */}
                                        {section.dailyOpenHour !== undefined && (
                                            <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                                <Clock className="h-3 w-3" />
                                                Mở lúc {String(section.dailyOpenHour).padStart(2, "0")}:{String(section.dailyOpenMinute ?? 0).padStart(2, "0")} mỗi ngày
                                            </div>
                                        )}
                                        {/* Validity */}
                                        {(section.startAt || section.endAt) && (
                                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                                <span>{formatDate(section.startAt) || "—"}</span>
                                                <span>→</span>
                                                <span>{formatDate(section.endAt) || "—"}</span>
                                            </div>
                                        )}
                                        {/* Items count */}
                                        <div className="flex items-center gap-1 text-xs text-gray-400">
                                            <Package className="h-3 w-3" />
                                            {section.items.length} sản phẩm deal
                                        </div>
                                        {/* Order constraints */}
                                        {section.maxPromoItemsPerOrder && (
                                            <div className="text-xs text-gray-400">
                                                Tối đa {section.maxPromoItemsPerOrder} deal/đơn
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <Link href={`deal-sections/${section.id}`}>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <Edit className="h-3 w-3" /> Quản lý
                                    </button>
                                </Link>
                                <form action={async () => {
                                    "use server";
                                    await toggleDealSectionStatus(section.id, !section.isActive);
                                }}>
                                    <button type="submit" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#1A1A2E] transition-colors">
                                        {section.isActive ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4" />}
                                    </button>
                                </form>
                                <form action={async () => {
                                    "use server";
                                    await deleteDealSection(section.id);
                                }}>
                                    <button type="submit" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Deal items preview */}
                        {section.items.length > 0 && (
                            <div className="border-t border-gray-50 px-5 py-3 flex flex-wrap gap-2">
                                {section.items.slice(0, 5).map((item) => (
                                    <div key={item.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg text-xs text-gray-600">
                                        {item.productType === "membership" ? "🎟️" : item.productType === "combo" ? "📦" : "🎫"}
                                        <span className="font-medium">{item.name}</span>
                                        <span className="text-gray-400">·</span>
                                        <span className="font-bold text-[#1A1A2E]">
                                            {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(item.effectivePrice)}
                                        </span>
                                        {item.totalStock && (
                                            <span className={`ml-1 text-xs ${item.soldCount >= item.totalStock ? "text-red-500" : "text-emerald-500"}`}>
                                                ({item.soldCount}/{item.totalStock})
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {section.items.length > 5 && (
                                    <span className="text-xs text-gray-400 self-center">+{section.items.length - 5} nữa</span>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {sections.length === 0 && (
                    <div className="text-center py-16 text-gray-400 text-sm">
                        <Zap className="h-10 w-10 mx-auto mb-3 opacity-20" />
                        Chưa có Deal Section nào
                    </div>
                )}
            </div>
        </div>
    );
}
