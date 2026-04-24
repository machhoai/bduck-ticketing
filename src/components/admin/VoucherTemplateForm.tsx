"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createVoucherTemplate, updateVoucherTemplate } from "@/actions/admin/voucherTemplates";
import type { VoucherTemplateDocument, VoucherType } from "@/types/firestore";
import { Save, Loader2 } from "lucide-react";

interface VoucherTemplateFormProps {
    template?: VoucherTemplateDocument; // undefined = create mode
    locale: string;
}

const VOUCHER_TYPES: { value: VoucherType; label: string; hint: string }[] = [
    { value: "online_discount", label: "Giảm giá online", hint: "Khách dùng code này khi checkout để được giảm giá trên website" },
    { value: "instore_points", label: "Điểm thưởng cửa hàng", hint: "Nhân viên quét code để cộng thêm điểm cho thẻ của khách" },
    { value: "instore_gift", label: "Quà tặng tại quầy", hint: "Nhân viên quét code để xác nhận và đổi quà cho khách" },
];

export function VoucherTemplateForm({ template, locale }: VoucherTemplateFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const isEdit = !!template;

    const [form, setForm] = useState({
        name: template?.name ?? "",
        description: template?.description ?? "",
        imageUrl: template?.imageUrl ?? "",
        voucherType: (template?.voucherType ?? "instore_gift") as VoucherType,
        codePrefix: template?.codePrefix ?? "DUCK-",
        codeSuffix: template?.codeSuffix ?? "",
        codeLength: template?.codeLength ?? 6,
        validDays: template?.validDays ?? 30,
        // online_discount
        odType: (template?.onlineDiscount?.type ?? "percentage") as "percentage" | "fixed",
        odValue: template?.onlineDiscount?.value ?? 10,
        odMin: template?.onlineDiscount?.minOrderValue ?? 0,
        odMax: template?.onlineDiscount?.maxDiscountAmount ?? 0,
        // instore
        instoreDescription: template?.instoreDescription ?? "",
        instorePoints: template?.instorePoints ?? 0,
        isActive: template?.isActive ?? true,
    });

    function set(key: string, value: unknown) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        startTransition(async () => {
            const input = {
                name: form.name,
                description: form.description || undefined,
                imageUrl: form.imageUrl || undefined,
                voucherType: form.voucherType,
                codePrefix: form.codePrefix || undefined,
                codeSuffix: form.codeSuffix || undefined,
                codeLength: form.codeLength,
                validDays: form.validDays,
                onlineDiscount: form.voucherType === "online_discount" ? {
                    type: form.odType,
                    value: form.odValue,
                    minOrderValue: form.odMin || undefined,
                    maxDiscountAmount: form.odMax || undefined,
                    applicableProductIds: [],
                } : undefined,
                instoreDescription: form.voucherType !== "online_discount" ? form.instoreDescription : undefined,
                instorePoints: form.voucherType === "instore_points" ? form.instorePoints : undefined,
                isActive: form.isActive,
            };

            const result = isEdit
                ? await updateVoucherTemplate(template!.id, input)
                : await createVoucherTemplate(input);

            if (!result.success) {
                setError(result.error);
                return;
            }
            router.push(`/${locale}/admin/voucher-templates`);
        });
    }

    const previewCode = `${form.codePrefix}${"X".repeat(Math.max(1, form.codeLength))}${form.codeSuffix}`;
    const selectedType = VOUCHER_TYPES.find((t) => t.value === form.voucherType);

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            {/* Basic info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-[#1A1A2E] text-base">Thông tin cơ bản</h2>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên mẫu</label>
                    <input
                        required
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="Voucher chơi game miễn phí"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mô tả (hiển thị với khách)</label>
                    <textarea
                        value={form.description}
                        onChange={(e) => set("description", e.target.value)}
                        placeholder="Bạn nhận được 1 voucher chơi game miễn phí tại khu vui chơi B.Duck..."
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842] resize-none"
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hình ảnh voucher (URL)</label>
                    <input
                        value={form.imageUrl}
                        onChange={(e) => set("imageUrl", e.target.value)}
                        placeholder="https://firebasestorage.googleapis.com/..."
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</label>
                    <button
                        type="button"
                        onClick={() => set("isActive", !form.isActive)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? "bg-emerald-500" : "bg-gray-200"}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.isActive ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                    <span className="text-sm text-gray-500">{form.isActive ? "Đang hoạt động" : "Tắt"}</span>
                </div>
            </div>

            {/* Voucher type */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-[#1A1A2E] text-base">Loại voucher</h2>

                <div className="grid grid-cols-1 gap-2">
                    {VOUCHER_TYPES.map((t) => (
                        <label key={t.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${form.voucherType === t.value ? "border-[#F5C842] bg-amber-50/40" : "border-gray-100 hover:border-gray-200"}`}>
                            <input
                                type="radio"
                                name="voucherType"
                                value={t.value}
                                checked={form.voucherType === t.value}
                                onChange={() => set("voucherType", t.value)}
                                className="mt-0.5 accent-[#F5C842]"
                            />
                            <div>
                                <div className="text-sm font-semibold text-[#1A1A2E]">{t.label}</div>
                                <div className="text-xs text-gray-400">{t.hint}</div>
                            </div>
                        </label>
                    ))}
                </div>

                {/* Online discount config */}
                {form.voucherType === "online_discount" && (
                    <div className="mt-4 space-y-3 border-t border-gray-50 pt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cấu hình giảm giá online</p>
                        <div className="flex gap-3">
                            <select
                                value={form.odType}
                                onChange={(e) => set("odType", e.target.value)}
                                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40"
                            >
                                <option value="percentage">Phần trăm (%)</option>
                                <option value="fixed">Cố định (VND)</option>
                            </select>
                            <input
                                type="number"
                                min={0}
                                value={form.odValue}
                                onChange={(e) => set("odValue", Number(e.target.value))}
                                placeholder={form.odType === "percentage" ? "10" : "50000"}
                                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40"
                            />
                            <span className="self-center text-sm text-gray-400">{form.odType === "percentage" ? "%" : "VND"}</span>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-gray-400">Đơn tối thiểu (VND, 0 = không giới hạn)</label>
                                <input type="number" min={0} value={form.odMin} onChange={(e) => set("odMin", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                            </div>
                            {form.odType === "percentage" && (
                                <div className="flex-1 space-y-1">
                                    <label className="text-xs text-gray-400">Giảm tối đa (VND, 0 = không giới hạn)</label>
                                    <input type="number" min={0} value={form.odMax} onChange={(e) => set("odMax", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Instore config */}
                {(form.voucherType === "instore_gift" || form.voucherType === "instore_points") && (
                    <div className="mt-4 space-y-3 border-t border-gray-50 pt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Cấu hình tại quầy</p>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-400">Mô tả hiển thị cho nhân viên khi quét</label>
                            <input
                                value={form.instoreDescription}
                                onChange={(e) => set("instoreDescription", e.target.value)}
                                placeholder="1 lượt chơi game tại khu vui chơi B.Duck"
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40"
                            />
                        </div>
                        {form.voucherType === "instore_points" && (
                            <div className="space-y-1">
                                <label className="text-xs text-gray-400">Số điểm thưởng cộng thêm</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={form.instorePoints}
                                    onChange={(e) => set("instorePoints", Number(e.target.value))}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Code generation */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                <h2 className="font-bold text-[#1A1A2E] text-base">Cấu hình mã code</h2>

                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tiền tố (prefix)</label>
                        <input
                            value={form.codePrefix}
                            onChange={(e) => set("codePrefix", e.target.value.toUpperCase())}
                            placeholder="DUCK-"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842] uppercase"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Độ dài ngẫu nhiên</label>
                        <input
                            type="number"
                            min={4}
                            max={16}
                            value={form.codeLength}
                            onChange={(e) => set("codeLength", Number(e.target.value))}
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hậu tố (suffix)</label>
                        <input
                            value={form.codeSuffix}
                            onChange={(e) => set("codeSuffix", e.target.value.toUpperCase())}
                            placeholder="-VIP"
                            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842] uppercase"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs text-gray-400">Ví dụ code:</span>
                    <code className="text-sm font-mono font-bold text-[#1A1A2E]">{previewCode}</code>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hạn sử dụng sau khi phát (ngày)</label>
                    <input
                        type="number"
                        min={1}
                        value={form.validDays}
                        onChange={(e) => set("validDays", Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 focus:border-[#F5C842]"
                    />
                    <p className="text-xs text-gray-400">Code sẽ hết hạn {form.validDays} ngày sau khi được tạo</p>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    {error}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors disabled:opacity-60"
                >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? "Lưu thay đổi" : "Tạo mẫu voucher"}
                </button>
                <a href={`/${locale}/admin/voucher-templates`} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                    Huỷ
                </a>
            </div>
        </form>
    );
}
