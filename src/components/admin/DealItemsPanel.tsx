"use client";

import { useState, useTransition, useRef } from "react";
import { addDealItem, removeDealItem, createDealProduct, updateDealItem } from "@/actions/admin/dealSections";
import { uploadThumbnail } from "@/actions/admin/products";
import type { DealItemDocument, DealSectionDocument, ProductType, DealType } from "@/types/firestore";
import { Plus, Loader2, Trash2, Package, ChevronDown, ChevronUp, Upload, ImageIcon, Sparkles, Pencil, X, Save, Globe } from "lucide-react";

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
    const [mode, setMode] = useState<"link" | "create">("link");

    // Image upload state (for "create" mode)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState("");
    const [compressionInfo, setCompressionInfo] = useState<{ before: number; after: number } | null>(null);

    const [form, setForm] = useState({
        linkedProductId: "",
        name: "",
        description: "",
        thumbnailUrl: "",
        productType: "ticket" as ProductType,
        originalPrice: 0,
        dealType: "percentage" as DealType,
        discountValue: 20,
        validDaysFromPurchase: 365,
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

    // ── WebP conversion (client-side) ──
    async function convertToWebP(file: File, quality = 0.85, maxDim = 1200): Promise<File> {
        return new Promise((resolve, reject) => {
            const img = new window.Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                let { width, height } = img;
                if (width > maxDim || height > maxDim) {
                    if (width >= height) { height = Math.round((height / width) * maxDim); width = maxDim; }
                    else { width = Math.round((width / height) * maxDim); height = maxDim; }
                }
                const canvas = document.createElement("canvas");
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) { reject(new Error("Canvas not supported")); return; }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) { reject(new Error("Conversion failed")); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" }));
                }, "image/webp", quality);
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load")); };
            img.src = objectUrl;
        });
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError(null); setCompressionInfo(null);
        if (file.size > 20 * 1024 * 1024) { setUploadError("Ảnh không được vượt quá 20MB"); return; }
        const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
        if (!ALLOWED.includes(file.type)) { setUploadError("Chỉ chấp nhận JPG, PNG, WebP, GIF, AVIF"); return; }
        setIsUploading(true);
        setThumbnailPreview(URL.createObjectURL(file));
        try {
            const webpFile = await convertToWebP(file);
            setCompressionInfo({ before: file.size, after: webpFile.size });
            const fd = new FormData(); fd.append("thumbnail", webpFile);
            const result = await uploadThumbnail(fd);
            if (result.success && result.data) { setF("thumbnailUrl", result.data.url); }
            else { setUploadError((result as any).error ?? "Upload thất bại"); setThumbnailPreview(""); }
        } catch { setUploadError("Không thể xử lý ảnh"); setThumbnailPreview(""); }
        finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    }

    const effectivePrice = calcEffectivePrice(form.originalPrice, form.dealType, form.discountValue);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (mode === "create" && !form.thumbnailUrl) {
            setError("Vui lòng upload ảnh sản phẩm");
            return;
        }

        const voucherTemplate = voucherTemplates.find((t) => t.id === form.giftVoucherTemplateId);

        startTransition(async () => {
            if (mode === "create") {
                // Create new ProductDocument + deal item
                const result = await createDealProduct(section.id, {
                    name: form.name,
                    description: form.description || undefined,
                    thumbnailUrl: form.thumbnailUrl,
                    productType: form.productType,
                    originalPrice: form.originalPrice,
                    validDaysFromPurchase: form.validDaysFromPurchase,
                    dealType: form.dealType,
                    discountValue: form.discountValue,
                    effectivePrice,
                    totalStock: form.totalStock !== "" ? Number(form.totalStock) : undefined,
                    stockResetPeriod: form.stockResetPeriod,
                    stockResetHour: form.stockResetPeriod === "daily" ? resetHour : undefined,
                    stockResetMinute: form.stockResetPeriod === "daily" ? resetMinute : undefined,
                    maxQtyPerOrder: form.maxQtyPerOrder,
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
                    isActive: form.isActive,
                    order: form.order,
                });
                if (!result.success) { setError(result.error); return; }
            } else {
                // Link existing product
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
                if (!result.success) { setError(result.error); return; }
            }

            setShowForm(false);
            setThumbnailPreview("");
            setCompressionInfo(null);
            setForm((prev) => ({ ...prev, name: "", linkedProductId: "", description: "", thumbnailUrl: "", originalPrice: 0, giftMerch: "", giftVoucherTemplateId: "", totalStock: "", order: section.items.length + 1, validDaysFromPurchase: 365 }));
        });
    }

    return (
        <div className="space-y-4">
            {/* Existing items */}
            <div className="space-y-2">
                {section.items.sort((a, b) => a.order - b.order).map((item) => (
                    <DealItemRow key={item.id} item={item} sectionId={section.id} formatVND={formatVND} resetTimeLabel={resetTimeLabel} voucherTemplates={voucherTemplates} />
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
                        {/* Mode tabs */}
                        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                            <button type="button" onClick={() => setMode("link")}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${mode === "link" ? "bg-white shadow-sm text-[#1A1A2E]" : "text-gray-500 hover:text-gray-700"}`}>
                                🔗 Link sản phẩm có sẵn
                            </button>
                            <button type="button" onClick={() => setMode("create")}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${mode === "create" ? "bg-white shadow-sm text-[#1A1A2E]" : "text-gray-500 hover:text-gray-700"}`}>
                                ✨ Tạo vé mới cho deal
                            </button>
                        </div>

                        {/* Link mode — dropdown */}
                        {mode === "link" && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Liên kết sản phẩm hiện có</label>
                                <select
                                    value={form.linkedProductId}
                                    onChange={(e) => handleProductSelect(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40"
                                >
                                    <option value="">— Chọn sản phẩm —</option>
                                    {linkedProducts.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} · {formatVND(p.price)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Create mode — image upload */}
                        {mode === "create" && (
                            <div className="space-y-2 border border-blue-100 bg-blue-50/30 rounded-xl p-4">
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Ảnh sản phẩm *</p>
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-white flex-shrink-0 cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {thumbnailPreview || form.thumbnailUrl ? (
                                            <img src={thumbnailPreview || form.thumbnailUrl} alt="preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon className="h-6 w-6 text-gray-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden" onChange={handleFileChange} />
                                        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
                                            {isUploading ? <><Loader2 className="h-3 w-3 animate-spin" /> Đang xử lý...</> : <><Upload className="h-3 w-3" /> Chọn ảnh</>}
                                        </button>
                                        <p className="text-[10px] text-gray-400">JPG, PNG, WebP · tối đa 20MB · tự nén WebP</p>
                                        {compressionInfo && (
                                            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                                                <Sparkles className="h-2.5 w-2.5" />
                                                {(compressionInfo.before / 1024).toFixed(0)}KB → {(compressionInfo.after / 1024).toFixed(0)}KB
                                                {" "}(-{Math.round((1 - compressionInfo.after / compressionInfo.before) * 100)}%)
                                            </p>
                                        )}
                                        {uploadError && <p className="text-[10px] text-red-500">{uploadError}</p>}
                                        {form.thumbnailUrl && !uploadError && <p className="text-[10px] text-emerald-600">✓ Upload thành công</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1 col-span-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên deal *</label>
                                <input required value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="Vé vào cổng giá 88k" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                            </div>

                            {/* Create mode — description */}
                            {mode === "create" && (
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mô tả (tùy chọn)</label>
                                    <textarea value={form.description} onChange={(e) => setF("description", e.target.value)} rows={2} placeholder="Mô tả ngắn..." className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40 resize-none" />
                                </div>
                            )}

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

                        {/* Validity config — only in create mode */}
                        {mode === "create" && (
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hiệu lực vé (số ngày từ khi mua)</label>
                                <input type="number" min={1} value={form.validDaysFromPurchase} onChange={(e) => setF("validDaysFromPurchase", Number(e.target.value))} placeholder="365" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F5C842]/40" />
                                <p className="text-[10px] text-gray-400">VD: 365 = vé có hiệu lực 1 năm kể từ ngày mua</p>
                            </div>
                        )}

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
                            <button type="submit" disabled={isPending || (mode === "create" && isUploading)} className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white font-bold rounded-xl text-sm hover:bg-[#1A1A2E]/90 transition-colors disabled:opacity-60">
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                {mode === "create" ? "Tạo vé & thêm vào deal" : "Thêm deal item"}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600">Huỷ</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── Individual deal item row (with inline edit) ───────────────────────────────

function DealItemRow({ item, sectionId, formatVND, resetTimeLabel, voucherTemplates }: {
    item: DealItemDocument;
    sectionId: string;
    formatVND: (v: number) => string;
    resetTimeLabel: string;
    voucherTemplates: { id: string; name: string }[];
}) {
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const stockPct = item.totalStock ? Math.min(100, (item.soldCount / item.totalStock) * 100) : 0;
    const soldOut = item.totalStock ? item.soldCount >= item.totalStock : false;

    // Edit form state — pre-filled from the item
    const [edit, setEdit] = useState(() => ({
        name: item.name,
        nameEn: item.nameLocales?.en ?? "",
        description: item.description ?? "",
        descriptionEn: item.descriptionLocales?.en ?? "",
        productType: item.productType as ProductType,
        originalPrice: item.originalPrice,
        dealType: item.dealType as DealType,
        discountValue: item.discountValue,
        totalStock: item.totalStock?.toString() ?? "",
        stockResetPeriod: (item.stockResetPeriod ?? "none") as "daily" | "none",
        maxQtyPerOrder: item.maxQtyPerOrder,
        isActive: item.isActive,
        giftVoucherTemplateId: item.giftVoucher?.templateId ?? "",
        giftVoucherDistribution: (item.giftVoucher?.distribution ?? "perOrder") as "perProduct" | "perOrder",
        giftMerch: item.giftMerch ?? "",
        membershipBasePoints: item.membershipConfig?.basePoints ?? 0,
        membershipBonusPoints: item.membershipConfig?.bonusPoints ?? 0,
        membershipMerch: item.membershipConfig?.merch ?? "",
        hasOptions: !!(item.options && item.options.length > 0),
        options: (item.options ?? []).map((o) => ({
            id: o.id, label: o.label, labelEn: o.labelLocales?.en ?? "",
            description: o.description ?? "", descriptionEn: o.descriptionLocales?.en ?? "",
            originalPrice: o.originalPrice,
        })),
    }));

    function setE(key: string, value: unknown) {
        setEdit((prev) => ({ ...prev, [key]: value }));
    }

    function handleRemove() {
        startTransition(async () => {
            await removeDealItem(sectionId, item.id);
        });
    }

    function handleStartEdit() {
        setEdit({
            name: item.name,
            nameEn: item.nameLocales?.en ?? "",
            description: item.description ?? "",
            descriptionEn: item.descriptionLocales?.en ?? "",
            productType: item.productType as ProductType,
            originalPrice: item.originalPrice,
            dealType: item.dealType as DealType,
            discountValue: item.discountValue,
            totalStock: item.totalStock?.toString() ?? "",
            stockResetPeriod: (item.stockResetPeriod ?? "none") as "daily" | "none",
            maxQtyPerOrder: item.maxQtyPerOrder,
            isActive: item.isActive,
            giftVoucherTemplateId: item.giftVoucher?.templateId ?? "",
            giftVoucherDistribution: (item.giftVoucher?.distribution ?? "perOrder") as "perProduct" | "perOrder",
            giftMerch: item.giftMerch ?? "",
            membershipBasePoints: item.membershipConfig?.basePoints ?? 0,
            membershipBonusPoints: item.membershipConfig?.bonusPoints ?? 0,
            membershipMerch: item.membershipConfig?.merch ?? "",
            hasOptions: !!(item.options && item.options.length > 0),
            options: (item.options ?? []).map((o) => ({
                id: o.id, label: o.label, labelEn: o.labelLocales?.en ?? "",
                description: o.description ?? "", descriptionEn: o.descriptionLocales?.en ?? "",
                originalPrice: o.originalPrice,
            })),
        });
        setIsEditing(true);
        setEditError(null);
    }

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        setEditError(null);

        const voucherTemplate = voucherTemplates.find((t) => t.id === edit.giftVoucherTemplateId);
        const effectivePrice = edit.hasOptions && edit.options.length > 0
            ? calcEffectivePrice(edit.options[0].originalPrice, edit.dealType, edit.discountValue)
            : calcEffectivePrice(edit.originalPrice, edit.dealType, edit.discountValue);
        const resolvedOriginalPrice = edit.hasOptions && edit.options.length > 0
            ? edit.options[0].originalPrice : edit.originalPrice;

        // Build options with effectivePrice calculated
        const resolvedOptions = edit.hasOptions ? edit.options.map((o) => ({
            id: o.id,
            label: o.label,
            labelLocales: o.labelEn ? { en: o.labelEn } : undefined,
            description: o.description || undefined,
            descriptionLocales: o.descriptionEn ? { en: o.descriptionEn } : undefined,
            originalPrice: o.originalPrice,
            effectivePrice: calcEffectivePrice(o.originalPrice, edit.dealType, edit.discountValue),
        })) : undefined;

        // Build i18n
        const nameLocales = edit.nameEn ? { en: edit.nameEn } : undefined;
        const descriptionLocales = edit.descriptionEn ? { en: edit.descriptionEn } : undefined;

        startTransition(async () => {
            const result = await updateDealItem(sectionId, item.id, {
                name: edit.name,
                description: edit.description || undefined,
                productType: edit.productType,
                nameLocales,
                descriptionLocales,
                originalPrice: resolvedOriginalPrice,
                dealType: edit.dealType,
                discountValue: edit.discountValue,
                effectivePrice,
                options: resolvedOptions,
                totalStock: edit.totalStock !== "" ? Number(edit.totalStock) : undefined,
                stockResetPeriod: edit.stockResetPeriod,
                maxQtyPerOrder: edit.maxQtyPerOrder,
                isActive: edit.isActive,
                membershipConfig: edit.productType === "membership" ? {
                    packageName: edit.name,
                    basePoints: edit.membershipBasePoints,
                    bonusPoints: edit.membershipBonusPoints,
                    merch: edit.membershipMerch || undefined,
                } : undefined,
                giftVoucher: edit.giftVoucherTemplateId ? {
                    templateId: edit.giftVoucherTemplateId,
                    templateName: voucherTemplate?.name ?? "",
                    distribution: edit.giftVoucherDistribution,
                } : undefined,
                giftMerch: edit.giftMerch || undefined,
            });
            if (result.success) {
                setIsEditing(false);
            } else {
                setEditError(result.error);
            }
        });
    }

    const editEffectivePrice = calcEffectivePrice(edit.originalPrice, edit.dealType, edit.discountValue);

    // Option helpers
    function addOption() {
        setEdit((prev) => ({
            ...prev,
            options: [...prev.options, { id: crypto.randomUUID(), label: "", labelEn: "", description: "", descriptionEn: "", originalPrice: 0 }],
        }));
    }
    function removeOption(idx: number) {
        setEdit((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
    }
    function setOption(idx: number, key: string, value: unknown) {
        setEdit((prev) => ({
            ...prev,
            options: prev.options.map((o, i) => i === idx ? { ...o, [key]: value } : o),
        }));
    }

    if (isEditing) {
        return (
            <form onSubmit={handleSave} className="border border-blue-200 rounded-xl bg-blue-50/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">✏️ Chỉnh sửa: {item.name}</p>
                    <button type="button" onClick={() => setIsEditing(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* Product type + Name */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Loại sản phẩm</label>
                        <select value={edit.productType} onChange={(e) => setE("productType", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                            {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tên deal</label>
                        <input required value={edit.name} onChange={(e) => setE("name", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="space-y-1 col-span-2">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mô tả</label>
                        <textarea value={edit.description} onChange={(e) => setE("description", e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
                    </div>
                </div>

                {/* 🌐 i18n English */}
                <details className="border border-indigo-100 rounded-xl bg-indigo-50/30">
                    <summary className="px-3 py-2 cursor-pointer text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5" /> English (i18n)
                    </summary>
                    <div className="px-3 pb-3 pt-1 grid grid-cols-2 gap-3">
                        <div className="space-y-1 col-span-2">
                            <label className="text-xs text-gray-500">Name (EN)</label>
                            <input value={edit.nameEn} onChange={(e) => setE("nameEn", e.target.value)} placeholder="English name" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className="text-xs text-gray-500">Description (EN)</label>
                            <textarea value={edit.descriptionEn} onChange={(e) => setE("descriptionEn", e.target.value)} rows={2} placeholder="English description" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
                        </div>
                    </div>
                </details>

                {/* Deal type + discount */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Loại deal</label>
                        <select value={edit.dealType} onChange={(e) => setE("dealType", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                            {DEAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                    </div>
                    {edit.dealType !== "buy1get1" && (
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Giá trị giảm {edit.dealType === "percentage" ? "(%)" : "(VND)"}
                            </label>
                            <input type="number" min={0} value={edit.discountValue} onChange={(e) => setE("discountValue", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                    )}
                </div>

                {/* Multi-option toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={edit.hasOptions} onChange={(e) => {
                        const on = e.target.checked;
                        setEdit((prev) => ({
                            ...prev,
                            hasOptions: on,
                            options: on && prev.options.length === 0
                                ? [{ id: crypto.randomUUID(), label: "Gói Bạc", labelEn: "", description: "", descriptionEn: "", originalPrice: prev.originalPrice }]
                                : prev.options,
                        }));
                    }} className="rounded border-gray-300" />
                    <span className="text-xs font-semibold text-gray-600">Sản phẩm có nhiều option giá</span>
                </label>

                {/* Options builder or single price */}
                {edit.hasOptions ? (
                    <div className="space-y-2 border border-emerald-100 rounded-xl bg-emerald-50/30 p-3">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">📦 Các option giá</p>
                        {edit.options.map((opt, idx) => (
                            <div key={opt.id} className="grid grid-cols-12 gap-2 items-start bg-white rounded-lg border border-gray-100 p-2">
                                <div className="col-span-3 space-y-1">
                                    <label className="text-xs text-gray-400">Tên option</label>
                                    <input required value={opt.label} onChange={(e) => setOption(idx, "label", e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs text-gray-400">EN</label>
                                    <input value={opt.labelEn} onChange={(e) => setOption(idx, "labelEn", e.target.value)} placeholder="EN" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs text-gray-400">Giá gốc</label>
                                    <input type="number" min={0} value={opt.originalPrice} onChange={(e) => setOption(idx, "originalPrice", Number(e.target.value))} className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs text-gray-400">Sau deal</label>
                                    <p className="px-2 py-1.5 text-xs font-bold text-amber-700">{formatVND(calcEffectivePrice(opt.originalPrice, edit.dealType, edit.discountValue))}</p>
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs text-gray-400">Mô tả</label>
                                    <input value={opt.description} onChange={(e) => setOption(idx, "description", e.target.value)} placeholder="Mô tả option" className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                                </div>
                                <div className="col-span-1 pt-5">
                                    <button type="button" onClick={() => removeOption(idx)} disabled={edit.options.length <= 1} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 disabled:opacity-30">
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button type="button" onClick={addOption} className="flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-700">
                            <Plus className="h-3 w-3" /> Thêm option
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Giá gốc (VND)</label>
                            <input type="number" min={0} value={edit.originalPrice} onChange={(e) => setE("originalPrice", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <div className="flex items-end gap-2 px-3 py-2 bg-amber-50 rounded-xl border border-amber-100">
                            <span className="text-xs text-amber-600">Sau deal:</span>
                            <span className="font-bold text-amber-700 text-sm">{formatVND(editEffectivePrice)}</span>
                            {edit.originalPrice > 0 && edit.originalPrice !== editEffectivePrice && (
                                <span className="text-xs line-through text-gray-400">{formatVND(edit.originalPrice)}</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Stock */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Số lượng</label>
                        <input type="number" min={1} value={edit.totalStock} onChange={(e) => setE("totalStock", e.target.value)} placeholder="∞" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Reset tồn kho</label>
                        <select value={edit.stockResetPeriod} onChange={(e) => setE("stockResetPeriod", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="none">Không reset</option>
                            <option value="daily">Mỗi ngày (lúc {resetTimeLabel} GMT+7)</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tối đa/đơn</label>
                        <input type="number" min={1} value={edit.maxQtyPerOrder} onChange={(e) => setE("maxQtyPerOrder", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                </div>

                {/* Gift voucher */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tặng voucher</label>
                        <select value={edit.giftVoucherTemplateId} onChange={(e) => setE("giftVoucherTemplateId", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                            <option value="">— Không —</option>
                            {voucherTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    {edit.giftVoucherTemplateId && (
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phát voucher</label>
                            <select value={edit.giftVoucherDistribution} onChange={(e) => setE("giftVoucherDistribution", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                                <option value="perOrder">1 voucher/đơn</option>
                                <option value="perProduct">1 voucher/sản phẩm</option>
                            </select>
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quà merch (tùy chọn)</label>
                        <input value={edit.giftMerch} onChange={(e) => setE("giftMerch", e.target.value)} placeholder="1 merch B.Duck" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                </div>

                {/* Membership config */}
                {item.productType === "membership" && (
                    <div className="grid grid-cols-3 gap-3 border border-amber-100 bg-amber-50/50 rounded-xl p-3">
                        <p className="col-span-3 text-xs font-bold text-amber-700 uppercase tracking-wider">Thẻ thành viên</p>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">Điểm gốc</label>
                            <input type="number" min={0} value={edit.membershipBasePoints} onChange={(e) => setE("membershipBasePoints", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">Điểm thưởng</label>
                            <input type="number" min={0} value={edit.membershipBonusPoints} onChange={(e) => setE("membershipBonusPoints", Number(e.target.value))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs text-gray-500">Quà merch kèm</label>
                            <input value={edit.membershipMerch} onChange={(e) => setE("membershipMerch", e.target.value)} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
                        </div>
                    </div>
                )}

                {/* Active toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={edit.isActive} onChange={(e) => setE("isActive", e.target.checked)} className="rounded border-gray-300" />
                    <span className="text-xs font-semibold text-gray-600">Hiện trên trang khách hàng</span>
                </label>

                {editError && (
                    <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-xs text-red-600">{editError}</p>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-60">
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Lưu thay đổi
                    </button>
                    <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-gray-400 hover:text-gray-600">Huỷ</button>
                </div>
            </form>
        );
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
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md">{item.productType === "membership" ? "Thẻ thành viên" : item.productType === "combo" ? "Combo" : "Vé"}</span>
                    {!item.isActive && <span className="text-xs text-gray-400">Ẩn</span>}
                    {soldOut && <span className="text-xs font-bold text-red-500">HẾT</span>}
                    {item.options && item.options.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md">📦 {item.options.length} options</span>
                    )}
                    {item.nameLocales?.en && (
                        <span className="text-xs px-1.5 py-0.5 bg-indigo-50 text-indigo-500 rounded-md">🌐 EN</span>
                    )}
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

            <div className="flex items-center gap-1">
                <button type="button" onClick={handleStartEdit} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-300 hover:text-blue-500 transition-colors" title="Chỉnh sửa">
                    <Pencil className="h-3.5 w-3.5" />
                </button>
                <form action={handleRemove}>
                    <button type="submit" disabled={isPending} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40" title="Xoá">
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                </form>
            </div>
        </div>
    );
}
