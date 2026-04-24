"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDealSection, updateDealSection } from "@/actions/admin/dealSections";
import type { DealSectionDocument } from "@/types/firestore";
import { Save, Loader2, Clock, ShoppingBag } from "lucide-react";

interface DealSectionFormProps {
    section?: DealSectionDocument;
    locale: string;
    /** When provided, the form only updates section metadata (used on /[id] page) */
    compact?: boolean;
}

export function DealSectionForm({ section, locale, compact }: DealSectionFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const isEdit = !!section;

    const [form, setForm] = useState({
        title: section?.title ?? "",
        description: section?.description ?? "",
        badgeLabel: section?.badgeLabel ?? "",
        dailyOpenHour: section?.dailyOpenHour ?? "",
        dailyOpenMinute: section?.dailyOpenMinute ?? 0,
        maxPromoItemsPerOrder: section?.maxPromoItemsPerOrder ?? "",
        maxPromoVariantsPerOrder: section?.maxPromoVariantsPerOrder ?? "",
        order: section?.order ?? 0,
        isActive: section?.isActive ?? true,
    });

    function set(key: string, value: unknown) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        startTransition(async () => {
            const input = {
                title: form.title,
                description: form.description || undefined,
                badgeLabel: form.badgeLabel || undefined,
                dailyOpenHour: form.dailyOpenHour !== "" ? Number(form.dailyOpenHour) : undefined,
                dailyOpenMinute: Number(form.dailyOpenMinute),
                maxPromoItemsPerOrder: form.maxPromoItemsPerOrder !== "" ? Number(form.maxPromoItemsPerOrder) : undefined,
                maxPromoVariantsPerOrder: form.maxPromoVariantsPerOrder !== "" ? Number(form.maxPromoVariantsPerOrder) : undefined,
                order: Number(form.order),
                isActive: form.isActive,
            };

            const result = isEdit
                ? await updateDealSection(section!.id, input)
                : await createDealSection(input);

            if (!result.success) {
                setError(result.error);
                return;
            }

            if (!isEdit) {
                // @ts-ignore
                router.push(`/${locale}/admin/deal-sections/${result.id}`);
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* Basic info */}
            <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 ${compact ? "p-4" : ""}`}>
                {!compact && <h2 className="font-bold text-[#1A1A2E] text-base">Thông tin section</h2>}

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tiêu đề *</label>
                        <input
                            required
                            value={form.title}
                            onChange={(e) => set("title", e.target.value)}
                            placeholder="Mở bán 10h sáng mỗi ngày"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nhãn badge (tùy chọn)</label>
                        <input
                            value={form.badgeLabel}
                            onChange={(e) => set("badgeLabel", e.target.value)}
                            placeholder="🔥 Flash Deal"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Thứ tự hiển thị</label>
                        <input
                            type="number"
                            min={0}
                            value={form.order}
                            onChange={(e) => set("order", Number(e.target.value))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                        />
                    </div>

                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mô tả phụ (tùy chọn)</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => set("description", e.target.value)}
                            placeholder="Giới hạn 30 sản phẩm/ngày, mở bán lúc 10:00 sáng"
                            rows={2}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842] resize-none"
                        />
                    </div>
                </div>
            </div>

            {/* Time gate */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-[#1A1A2E] text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-500" /> Time Gate (Giờ mở bán)
                </h2>
                <p className="text-xs text-gray-400">
                    Nếu điền, section chỉ cho phép mua hàng SAU thời gian này mỗi ngày. Xác thực phía server (không cần cron job).
                    <strong className="text-amber-600"> Yêu cầu TZ=Asia/Ho_Chi_Minh trên Vercel.</strong>
                </p>
                <div className="flex items-center gap-3">
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500">Giờ (0-23)</label>
                        <input
                            type="number"
                            min={0}
                            max={23}
                            value={form.dailyOpenHour}
                            onChange={(e) => set("dailyOpenHour", e.target.value)}
                            placeholder="10"
                            className="w-20 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 text-center"
                        />
                    </div>
                    <span className="text-gray-400 text-lg mt-4">:</span>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500">Phút (0-59)</label>
                        <input
                            type="number"
                            min={0}
                            max={59}
                            value={form.dailyOpenMinute}
                            onChange={(e) => set("dailyOpenMinute", e.target.value)}
                            placeholder="0"
                            className="w-20 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 text-center"
                        />
                    </div>
                    {form.dailyOpenHour !== "" && (
                        <div className="mt-4 px-3 py-1.5 bg-amber-50 rounded-lg text-sm font-bold text-amber-700">
                            Mở lúc {String(form.dailyOpenHour).padStart(2, "0")}:{String(form.dailyOpenMinute).padStart(2, "0")} GMT+7
                        </div>
                    )}
                    {form.dailyOpenHour !== "" && (
                        <button type="button" onClick={() => set("dailyOpenHour", "")} className="mt-4 text-xs text-gray-400 hover:text-red-500">Xoá</button>
                    )}
                </div>
            </div>

            {/* Order constraints */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-[#1A1A2E] text-base flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 text-blue-500" /> Giới hạn mua trong 1 đơn
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tối đa số lượng deal/đơn
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={form.maxPromoItemsPerOrder}
                            onChange={(e) => set("maxPromoItemsPerOrder", e.target.value)}
                            placeholder="Không giới hạn"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                        />
                        <p className="text-xs text-gray-400">Tổng số lượng tất cả các deal trong 1 đơn</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Tối đa số loại deal/đơn
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={form.maxPromoVariantsPerOrder}
                            onChange={(e) => set("maxPromoVariantsPerOrder", e.target.value)}
                            placeholder="Không giới hạn"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                        />
                        <p className="text-xs text-gray-400">Ví dụ: 3 = mua được tối đa 3 loại deal khác nhau</p>
                    </div>
                </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-600">Trạng thái section</label>
                <button
                    type="button"
                    onClick={() => set("isActive", !form.isActive)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                </button>
                <span className="text-sm text-gray-500">{form.isActive ? "Đang hiển thị" : "Ẩn"}</span>
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>
            )}

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors disabled:opacity-60"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? "Lưu thay đổi" : "Tạo section & thêm sản phẩm deal"}
                </button>
                {!compact && (
                    <a href={`/${locale}/admin/deal-sections`} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                        Huỷ
                    </a>
                )}
            </div>
        </form>
    );
}
