"use client";

import { useState, useTransition } from "react";
import { addDealItem, removeDealItem } from "@/actions/admin/dealSections";
import type { DealItemDocument, DealSectionDocument, ProductType, DealType } from "@/types/firestore";
import { Plus, Loader2, Trash2, Package, ChevronDown, ChevronUp } from "lucide-react";

interface DealItemsPanelProps {
    section: DealSectionDocument;
    voucherTemplates: { id: string; name: string }[];
    linkedProducts: { id: string; name: string; price: number; type: ProductType; thumbnailUrl: string }[];
}

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
    { value: "ticket", label: "🎫 Vé" },
    { value: "combo", label: "📦 Combo" },
    { value: "membership", label: "💳 Thẻ thành viên" },
];

const DEAL_TYPES: { value: DealType; label: string }[] = [
    { value: "percentage", label: "Giảm theo %" },
    { value: "fixed", label: "Giảm cố định (VND)" },
    { value: "buy1get1", label: "Mua 1 tặng 1" },
];

function formatVND(v: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

function calcEffectivePrice(originalPrice: number, dealType: DealType, discountValue: number): number {
    if (dealType === "buy1get1") return originalPrice;
    if (dealType === "percentage") return Math.max(0, originalPrice - Math.round(originalPrice * discountValue / 100));
    return Math.max(0, originalPrice - discountValue);
}

export function DealItemsPanel({ section, voucherTemplates, linkedProducts }: DealItemsPanelProps) {
    const [isPending, startTransition] = useTransition();
    const [showForm, setShowForm] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        linkedProductId: "",
        name: "",
        description: "",
        thumbnailUrl: "",
        productType: "ticket" as ProductType,
        originalPrice: 0,
        dealType: "percentage" as DealType,
        discountValue: 20,
        // membership
        membershipBasePoints: 0,
        membershipBonusPoints: 0,
        membershipBonusMultiplier: 1,
        membershipBonusApplyTo: "bonusOnly" as "bonusOnly" | "totalPoints",
        membershipMerch: "",
        // voucher
        giftVoucherTemplateId: "",
        giftVoucherDistribution: "perOrder" as "perProduct" | "perOrder",
        giftMerch: "",
        totalStock: "",
        stockResetPeriod: "none" as "daily" | "none",
        maxQtyPerOrder: 1,
        isActive: true,
        order: section.items.length,
    });

    // Build reset time label from section's dailyOpenHour/Minute
    const resetHour = section.dailyOpenHour ?? 0;
    const resetMinute = section.dailyOpenMinute ?? 0;
    const resetTimeLabel = `${String(resetHour).padStart(2, "0")}:${String(resetMinute).padStart(2, "0")}`;

    function setF(key: string, value: unknown) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    // When a linked product is selected, auto-fill fields
    function handleProductSelect(productId: string) {
        setF("linkedProductId", productId);
        const product = linkedProducts.find((p) => p.id === productId);
        if (product) {
            setF("name", product.name);
            setF("thumbnailUrl", product.thumbnailUrl);
            setF("productType", product.type);
            setF("originalPrice", product.price);
        }
    }

    const effectivePrice = calcEffectivePrice(form.originalPrice, form.dealType, form.discountValue);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const voucherTemplate = voucherTemplates.find((t) => t.id === form.giftVoucherTemplateId);

        startTransition(async () => {
            const result = await addDealItem(section.id, {
                linkedProductId: form.linkedProductId || undefined,
                name: form.name,
                description: form.description || undefined,
                thumbnailUrl: form.thumbnailUrl,
                productType: form.productType,
                originalPrice: form.originalPrice,
                dealType: form.dealType,
                discountValue: form.discountValue,
                effectivePrice,
                membershipConfig: form.productType === "membership" ? {
                    packageName: form.name,
                    basePoints: form.membershipBasePoints,
                    bonusPoints: form.membershipBonusPoints,
                    merch: form.membershipMerch || undefined,
                } : undefined,
                membershipBonusOverride: form.productType === "membership" && form.membershipBonusMultiplier > 1 ? {
                    applyTo: form.membershipBonusApplyTo,
                    multiplier: form.membershipBonusMultiplier,
                } : undefined,
                giftVoucher: form.giftVoucherTemplateId ? {
                    templateId: form.giftVoucherTemplateId,
                    templateName: voucherTemplate?.name ?? "",
                    distribution: form.giftVoucherDistribution,
                } : undefined,
                giftMerch: form.giftMerch || undefined,
                totalStock: form.totalStock !== "" ? Number(form.totalStock) : undefined,
                stockResetPeriod: form.stockResetPeriod,
                stockResetHour: form.stockResetPeriod === "daily" ? resetHour : undefined,
                stockResetMinute: form.stockResetPeriod === "daily" ? resetMinute : undefined,
                maxQtyPerOrder: form.maxQtyPerOrder,
                isActive: form.isActive,
                order: form.order,
            });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setShowForm(false);
            // Reset form
            setForm((prev) => ({ ...prev, name: "", linkedProductId: "", description: "", thumbnailUrl: "", originalPrice: 0, giftMerch: "", giftVoucherTemplateId: "", totalStock: "", order: section.items.length + 1 }));
        });
    }

    return (
        <div className="space-y-4">
            {/* Existing items */}
            <div className="space-y-2">
                {section.items.sort((a, b) => a.order - b.order).map((item) => (
                    <DealItemRow key={item.id} item={item} sectionId={section.id} formatVND={formatVND} resetTimeLabel={resetTimeLabel} />
                ))}
                {section.items.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        Chưa có sản phẩm deal nào. Thêm deal đầu tiên bên dưới.
                    </div>
                )}
            </div>

            {/* Add item form */}
            <div className="border border-dashed border-gray-200 rounded-2xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowForm((v) => !v)}
                    className="w-full flex items-center justify-between p-4 text-sm font-semibold text-gray-500 hover:text-[#1A1A2E] hover:bg-gray-50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Thêm sản phẩm deal mới
                    </div>
                    {showForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showForm && (
                    <form onSubmit={handleSubmit} className="border-t border-gray-100 p-5 space-y-4 bg-gray-50/50">
                        {/* Link to existing product */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Liên kết sản phẩm hiện có (tùy chọn)</label>
                            <select
                                value={form.linkedProductId}
                                onChange={(e) => handleProductSelect(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40"
                            >
                                <option value="">— Không liên kết (deal standalone) —</option>
                                {linkedProducts.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} · {formatVND(p.price)}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 col-span-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên deal *</label>
                                <input required value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="Vé vào cổng giá 88k" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Loại sản phẩm</label>
                                <select value={form.productType} onChange={(e) => setF("productType", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40">
                                    {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Giá gốc (VND)</label>
                                <input type="number" min={0} value={form.originalPrice} onChange={(e) => setF("originalPrice", Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Loại deal</label>
                                <select value={form.dealType} onChange={(e) => setF("dealType", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40">
                                    {DEAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>

                            {form.dealType !== "buy1get1" && (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        Giá trị giảm {form.dealType === "percentage" ? "(%)" : "(VND)"}
                                    </label>
                                    <input type="number" min={0} value={form.discountValue} onChange={(e) => setF("discountValue", Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                                </div>
                            )}

                            {/* Effective price preview */}
                            <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                                <span className="text-xs text-amber-600">Giá thực tế sau deal:</span>
                                <span className="font-bold text-amber-700 text-sm">{formatVND(effectivePrice)}</span>
                                {form.originalPrice > 0 && form.originalPrice !== effectivePrice && (
                                    <span className="text-xs line-through text-gray-400">{formatVND(form.originalPrice)}</span>
                                )}
                            </div>
                        </div>

                        {/* Membership config */}
                        {form.productType === "membership" && (
                            <div className="space-y-3 border border-amber-100 bg-amber-50/50 rounded-xl p-4">
                                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Cấu hình thẻ thành viên</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">Điểm gốc (base)</label>
                                        <input type="number" min={0} value={form.membershipBasePoints} onChange={(e) => setF("membershipBasePoints", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">Điểm thưởng (bonus)</label>
                                        <input type="number" min={0} value={form.membershipBonusPoints} onChange={(e) => setF("membershipBonusPoints", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">Nhân lộc (multiplier)</label>
                                        <input type="number" min={1} step={0.5} value={form.membershipBonusMultiplier} onChange={(e) => setF("membershipBonusMultiplier", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-gray-500">Áp dụng nhân lộc vào</label>
                                        <select value={form.membershipBonusApplyTo} onChange={(e) => setF("membershipBonusApplyTo", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40">
                                            <option value="bonusOnly">Chỉ điểm thưởng</option>
                                            <option value="totalPoints">Tổng cả 2 loại điểm</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs text-gray-500">Quà merch kèm theo (tùy chọn)</label>
                                        <input value={form.membershipMerch} onChange={(e) => setF("membershipMerch", e.target.value)} placeholder="1 gấu bông B.Duck" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Gift voucher */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tặng voucher (tùy chọn)</label>
                                <select value={form.giftVoucherTemplateId} onChange={(e) => setF("giftVoucherTemplateId", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40">
                                    <option value="">— Không tặng voucher —</option>
                                    {voucherTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            {form.giftVoucherTemplateId && (
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phát voucher</label>
                                    <select value={form.giftVoucherDistribution} onChange={(e) => setF("giftVoucherDistribution", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40">
                                        <option value="perOrder">1 voucher/đơn hàng</option>
                                        <option value="perProduct">1 voucher/sản phẩm mua</option>
                                    </select>
                                </div>
                            )}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quà merch vật lý (tùy chọn)</label>
                                <input value={form.giftMerch} onChange={(e) => setF("giftMerch", e.target.value)} placeholder="1 merch B.Duck" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                            </div>
                        </div>

                        {/* Stock */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Số lượng (trống = vô hạn)</label>
                                <input type="number" min={1} value={form.totalStock} onChange={(e) => setF("totalStock", e.target.value)} placeholder="30" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reset tồn kho</label>
                                <select value={form.stockResetPeriod} onChange={(e) => setF("stockResetPeriod", e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40">
                                    <option value="none">Không reset</option>
                                    <option value="daily">Mỗi ngày (lúc {resetTimeLabel} GMT+7)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tối đa/đơn</label>
                                <input type="number" min={1} value={form.maxQtyPerOrder} onChange={(e) => setF("maxQtyPerOrder", Number(e.target.value))} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                            </div>
                        </div>

                        {error && (
                            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl space-y-1">
                                <p className="text-sm font-semibold text-red-700">⚠️ Thêm deal thất bại</p>
                                <p className="text-xs text-red-600 font-mono break-all">{error}</p>
                                <p className="text-xs text-red-400">Kiểm tra console server để xem log đầy đủ.</p>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white font-bold rounded-xl text-sm hover:bg-[#1A1A2E]/90 transition-colors disabled:opacity-60">
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                Thêm deal item
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600">Huỷ</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── Individual deal item row ──────────────────────────────────────────────────

function DealItemRow({ item, sectionId, formatVND, resetTimeLabel }: {
    item: DealItemDocument;
    sectionId: string;
    formatVND: (v: number) => string;
    resetTimeLabel: string;
}) {
    const [isPending, startTransition] = useTransition();

    const stockPct = item.totalStock ? Math.min(100, (item.soldCount / item.totalStock) * 100) : 0;
    const soldOut = item.totalStock ? item.soldCount >= item.totalStock : false;

    function handleRemove() {
        startTransition(async () => {
            await removeDealItem(sectionId, item.id);
        });
    }

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${item.isActive ? "bg-white border-gray-100" : "bg-gray-50 border-gray-100 opacity-60"}`}>
            {/* thumbnail placeholder */}
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
                {item.productType === "membership" ? "💳" : item.productType === "combo" ? "📦" : "🎫"}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[#1A1A2E] text-sm truncate">{item.name}</span>
                    {!item.isActive && <span className="text-xs text-gray-400">Ẩn</span>}
                    {soldOut && <span className="text-xs font-bold text-red-500">HẾT</span>}
                    {item.giftVoucher && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md">🎟 Voucher</span>
                    )}
                    {item.giftMerch && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-md">🎁 {item.giftMerch}</span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs font-bold text-[#1A1A2E]">{formatVND(item.effectivePrice)}</span>
                    {item.originalPrice !== item.effectivePrice && (
                        <span className="text-xs line-through text-gray-400">{formatVND(item.originalPrice)}</span>
                    )}
                    {item.totalStock && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-16 bg-gray-100 rounded-full h-1">
                                <div className={`h-1 rounded-full ${soldOut ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${stockPct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400">{item.soldCount}/{item.totalStock}</span>
                            {item.stockResetPeriod === "daily" && (
                                <span className="text-xs text-blue-400">
                                    · reset lúc {item.stockResetHour !== undefined
                                        ? `${String(item.stockResetHour).padStart(2, "0")}:${String(item.stockResetMinute ?? 0).padStart(2, "0")}`
                                        : resetTimeLabel}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <form action={handleRemove}>
                <button type="submit" disabled={isPending} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40">
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
            </form>
        </div>
    );
}
