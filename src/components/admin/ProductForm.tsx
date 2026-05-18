"use client";

import { useForm, type Resolver, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useRouter } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import { createProduct, updateProduct, uploadThumbnail } from "@/actions/admin/products";
import type { ProductGroupDocument, ProductDocument } from "@/types/firestore";
import { Upload, Loader2, ImageIcon, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

// ─── Client-side WebP conversion ─────────────────────────────────────────────
/**
 * Converts any image File to WebP using the Canvas API.
 * Resizes down to maxDim (1200px) if either side exceeds it.
 * Returns a new File with .webp extension.
 */
async function convertToWebP(
  file: File,
  quality = 0.85,
  maxDim = 1200
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Conversion failed")); return; }
          const webpFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".webp"),
            { type: "image/webp" }
          );
          resolve(webpFile);
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Failed to load image")); };
    img.src = objectUrl;
  });
}

// ─── Zod Schema (client-side — matches server schema) ────────────────────────
const formSchema = z.object({
  name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  nameEn: z.string().optional(),
  description: z.string().optional(),
  descriptionEn: z.string().optional(),
  type: z.enum(["ticket", "combo", "membership"]),
  price: z.coerce.number().positive("Giá phải lớn hơn 0"),
  groupId: z.string().optional(),
  // Stock
  stockEnabled: z.boolean().default(false),
  totalStock: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  stockResetPeriod: z.enum(["none", "daily", "monthly"]).default("none"),
  commissionRate: z.coerce.number().min(0).max(100).optional().or(z.literal("").transform(() => undefined)),
  validityType: z.enum(["open-dated", "date-specific", "date-range", "time-slot"]),
  validDaysFromPurchase: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  specificDate: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  timeSlotStart: z.string().optional(),
  timeSlotEnd: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ProductFormProps {
  groups: Pick<ProductGroupDocument, "id" | "name">[];
  initialData?: Partial<ProductDocument>;
  productId?: string;
  locale: string;
}

export function ProductForm({ groups, initialData, productId, locale }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [thumbnailUrl, setThumbnailUrl] = useState(initialData?.thumbnailUrl ?? "");
  const [thumbnailPreview, setThumbnailPreview] = useState(initialData?.thumbnailUrl ?? "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<{ before: number; after: number } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [localeLang, setLocaleLang] = useState<"vi" | "en">("vi"); // locale tab for name/description
  const [priceDisplay, setPriceDisplay] = useState<string>(
    initialData?.price ? new Intl.NumberFormat("vi-VN").format(initialData.price) : ""
  );
  const [membershipConfig, setMembershipConfig] = useState({
    packageName: (initialData as any)?.membershipConfig?.packageName ?? "",
    basePoints: (initialData as any)?.membershipConfig?.basePoints ?? 0,
    bonusPoints: (initialData as any)?.membershipConfig?.bonusPoints ?? 0,
    merch: (initialData as any)?.membershipConfig?.merch ?? "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: initialData?.name ?? "",
      nameEn: initialData?.nameLocales?.["en"] ?? "",
      description: initialData?.description ?? "",
      descriptionEn: initialData?.descriptionLocales?.["en"] ?? "",
      type: initialData?.type ?? "ticket",
      price: initialData?.price ?? undefined,
      groupId: initialData?.groupId ?? "",
      stockEnabled: (initialData?.totalStock !== undefined),
      totalStock: initialData?.totalStock ?? undefined,
      stockResetPeriod: (initialData as any)?.stockResetPeriod ?? "none",
      commissionRate: initialData?.commissionRate ? initialData.commissionRate * 100 : undefined,
      validityType: initialData?.validityConfig?.type ?? "open-dated",
      validDaysFromPurchase: initialData?.validityConfig?.validDaysFromPurchase ?? undefined,
      timeSlotStart: initialData?.validityConfig?.timeSlotStart ?? undefined,
      timeSlotEnd: initialData?.validityConfig?.timeSlotEnd ?? undefined,
    },
  });

  const validityType = watch("validityType");
  const stockEnabled = watch("stockEnabled");
  const stockResetPeriod = watch("stockResetPeriod");
  const nameVi = watch("name");
  const nameEn = watch("nameEn");

  // VND price formatter
  function handlePriceInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = parseInt(raw, 10);
    if (isNaN(num)) {
      setPriceDisplay("");
      setValue("price", 0);
    } else {
      setPriceDisplay(new Intl.NumberFormat("vi-VN").format(num));
      setValue("price", num);
    }
  }

  // ─── Thumbnail Upload with WebP conversion ────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setCompressionInfo(null);

    // 20 MB raw limit (before compression)
    const MAX_RAW_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_RAW_BYTES) {
      setUploadError("Ảnh không được vượt quá 20MB");
      // reset input so the same file can be re-selected after user trims it
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!ALLOWED.includes(file.type)) {
      setUploadError("Chỉ chấp nhận JPG, PNG, WebP, GIF, AVIF");
      return;
    }

    setIsUploading(true);
    // Show original file as preview immediately
    setThumbnailPreview(URL.createObjectURL(file));

    try {
      // Convert → WebP on the client before upload
      const webpFile = await convertToWebP(file);
      setCompressionInfo({ before: file.size, after: webpFile.size });

      const formData = new FormData();
      formData.append("thumbnail", webpFile);

      const result = await uploadThumbnail(formData);
      if (result.success && result.data) {
        setThumbnailUrl(result.data.url);
      } else if (!result.success) {
        setUploadError(result.error ?? "Upload thất bại");
        setThumbnailPreview(thumbnailUrl);
        setCompressionInfo(null);
      }
    } catch {
      setUploadError("Không thể xử lý ảnh — vui lòng thử file khác");
      setThumbnailPreview(thumbnailUrl);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // ─── Form Submit ──────────────────────────────────────────────────────────
  function onSubmit(data: FormValues) {
    if (!thumbnailUrl) {
      setSubmitError("Vui lòng upload ảnh sản phẩm");
      return;
    }

    setSubmitError(null);

    // Build validityConfig
    const validityConfig: Record<string, unknown> = { type: data.validityType };
    if (data.validityType === "open-dated" && data.validDaysFromPurchase) {
      validityConfig.validDaysFromPurchase = data.validDaysFromPurchase;
    }
    if (data.validityType === "date-specific" && data.specificDate) {
      validityConfig.specificDate = data.specificDate;
    }
    if (data.validityType === "date-range") {
      if (data.validFrom) validityConfig.validFrom = data.validFrom;
      if (data.validUntil) validityConfig.overallExpiresAt = data.validUntil;
    }
    if (data.validityType === "time-slot") {
      if (data.validDaysFromPurchase) validityConfig.validDaysFromPurchase = data.validDaysFromPurchase;
      if (data.validUntil) validityConfig.overallExpiresAt = data.validUntil;
      if (data.timeSlotStart) validityConfig.timeSlotStart = data.timeSlotStart;
      if (data.timeSlotEnd) validityConfig.timeSlotEnd = data.timeSlotEnd;
    }

    // Build nameLocales: always store vi (= name), add en if provided
    const nameLocales: Record<string, string> = { vi: data.name };
    if (data.nameEn?.trim()) nameLocales["en"] = data.nameEn.trim();

    // Build descriptionLocales
    const descriptionLocales: Record<string, string> = {};
    if (data.description?.trim()) descriptionLocales["vi"] = data.description.trim();
    if (data.descriptionEn?.trim()) descriptionLocales["en"] = data.descriptionEn.trim();

    const payload = {
      name: data.name,
      nameLocales,
      description: data.description,
      ...(Object.keys(descriptionLocales).length > 0 ? { descriptionLocales } : {}),
      type: data.type,
      price: data.price,
      thumbnailUrl,
      groupId: data.groupId || undefined,
      // Stock: only set totalStock if stockEnabled is true
      totalStock: data.stockEnabled ? data.totalStock : undefined,
      stockResetPeriod: data.stockEnabled ? data.stockResetPeriod : undefined,
      commissionRate: data.commissionRate ? data.commissionRate / 100 : undefined,
      validityConfig: validityConfig as Parameters<typeof createProduct>[0]["validityConfig"],
      // Membership config: only if type = membership
      membershipConfig: data.type === "membership" ? {
        packageName: membershipConfig.packageName || data.name,
        basePoints: membershipConfig.basePoints,
        bonusPoints: membershipConfig.bonusPoints,
        merch: membershipConfig.merch || undefined,
      } : undefined,
    };

    startTransition(async () => {
      const result = productId
        ? await updateProduct(productId, payload)
        : await createProduct(payload);

      if (result.success) {
        setSubmitSuccess(true);
        setTimeout(() => router.push(`/${locale}/admin/products`), 800);
      } else {
        setSubmitError(result.error ?? "Lỗi không xác định");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      {/* Success */}
      {submitSuccess && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {productId ? "Đã cập nhật sản phẩm!" : "Đã tạo sản phẩm!"} Đang chuyển trang...
        </div>
      )}

      {/* Error */}
      {submitError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      {/* Thumbnail */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#1A1A2E] text-sm">Ảnh sản phẩm *</h2>
          {/* Mode toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button type="button" onClick={() => setUploadMode("file")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${ uploadMode === "file" ? "bg-white shadow-sm text-[#1A1A2E]" : "text-gray-500 hover:text-gray-700" }`}>
              Upload file
            </button>
            <button type="button" onClick={() => setUploadMode("url")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${ uploadMode === "url" ? "bg-white shadow-sm text-[#1A1A2E]" : "text-gray-500 hover:text-gray-700" }`}>
              Nhập URL
            </button>
          </div>
        </div>

        <div className="flex items-start gap-4">
          {/* Preview */}
          <div
            className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0"
            onClick={() => uploadMode === "file" && fileInputRef.current?.click()}
            style={{ cursor: uploadMode === "file" ? "pointer" : "default" }}
          >
            {thumbnailPreview ? (
              <img src={thumbnailPreview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="h-8 w-8 text-gray-300" />
            )}
          </div>

          <div className="flex-1 space-y-2">
            {uploadMode === "file" ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang xử lý...</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> Chọn ảnh</>
                  )}
                </button>
                <p className="text-xs text-gray-400">JPG, PNG, WebP, GIF · tối đa 20MB · tự động nén sang WebP</p>
                {compressionInfo && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Nén: {(compressionInfo.before / 1024).toFixed(0)}KB → {(compressionInfo.after / 1024).toFixed(0)}KB
                    {" "}(-{Math.round((1 - compressionInfo.after / compressionInfo.before) * 100)}%)
                  </p>
                )}
              </>
            ) : (
              <>
                <input
                  type="url"
                  placeholder="https://example.com/image.png"
                  value={thumbnailUrl}
                  onChange={(e) => {
                    setThumbnailUrl(e.target.value);
                    setThumbnailPreview(e.target.value);
                  }}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent bg-gray-50"
                />
                <p className="text-xs text-gray-400">Dán URL ảnh từ Cloudinary, ImgBB, Firebase Storage, v.v.</p>
              </>
            )}
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
            {thumbnailUrl && !uploadError && uploadMode === "file" && (
              <p className="text-xs text-emerald-600">✓ Upload thành công</p>
            )}
          </div>
        </div>
      </div>

      {/* Base Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-bold text-[#1A1A2E] text-sm">Thông tin cơ bản</h2>

        {/* ── Language Tabs for Name & Description ──────────────────────── */}
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ngôn ngữ:</span>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setLocaleLang("vi")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                  localeLang === "vi" ? "bg-white shadow-sm text-[#1A1A2E]" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                🇻🇳 Tiếng Việt
                {nameVi && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
              </button>
              <button
                type="button"
                onClick={() => setLocaleLang("en")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                  localeLang === "en" ? "bg-white shadow-sm text-[#1A1A2E]" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                🇬🇧 English
                {nameEn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
              </button>
            </div>
          </div>

          {/* Vietnamese fields */}
          <div className={localeLang === "vi" ? "block space-y-4" : "hidden"}>
            <Field label="Tên sản phẩm (Tiếng Việt) *" error={errors.name?.message}>
              <input
                {...register("name")}
                placeholder="VD: Vé vào cổng B.Duck Funland"
                className={inputCls(!!errors.name)}
              />
            </Field>
            <Field label="Mô tả (Tiếng Việt)" error={errors.description?.message}>
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-gray-200 [&_.ql-container]:border-none [&_.ql-editor]:min-h-[120px]">
                    <ReactQuill theme="snow" modules={quillModules} {...field} />
                  </div>
                )}
              />
            </Field>
          </div>

          {/* English fields */}
          <div className={localeLang === "en" ? "block space-y-4" : "hidden"}>
            <Field label="Product Name (English)" error={errors.nameEn?.message}>
              <input
                {...register("nameEn")}
                placeholder="E.g. B.Duck Funland Entrance Ticket"
                className={inputCls(!!errors.nameEn)}
              />
            </Field>
            <Field label="Description (English)" error={errors.descriptionEn?.message}>
              <Controller
                name="descriptionEn"
                control={control}
                render={({ field }) => (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-gray-200 [&_.ql-container]:border-none [&_.ql-editor]:min-h-[120px]">
                    <ReactQuill theme="snow" modules={quillModules} {...field} />
                  </div>
                )}
              />
            </Field>
            <p className="text-xs text-gray-400">
              💡 Để trống nếu không có bản dịch tiếng Anh — tiếng Việt sẽ được dùng làm fallback.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Loại sản phẩm *" error={errors.type?.message}>
            <select {...register("type")} className={inputCls(!!errors.type)}>
              <option value="ticket">Vé đơn (ticket)</option>
              <option value="combo">Combo</option>
              <option value="membership">Thẻ thành viên (membership)</option>
            </select>
          </Field>

          <Field label="Nhóm sản phẩm" error={errors.groupId?.message}>
            <select {...register("groupId")} className={inputCls(false)}>
              <option value="">-- Không phân nhóm --</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* VND Price Input */}
          <Field label="Giá (VND) *" error={errors.price?.message}>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={priceDisplay}
                onChange={handlePriceInput}
                placeholder="150.000"
                className={`${inputCls(!!errors.price)} pr-10`}
              />
              {/* Hidden real value */}
              <input type="hidden" {...register("price")} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">₫</span>
            </div>
            {priceDisplay && (
              <p className="text-[11px] text-gray-400 mt-1 font-mono">
                = {priceDisplay} VNĐ
              </p>
            )}
          </Field>

          <Field label="Hoa hồng affiliate (%)" hint="Bỏ trống = default affiliate" error={errors.commissionRate?.message}>
            <input
              {...register("commissionRate")}
              type="number"
              step="0.5"
              min="0"
              max="100"
              placeholder="10"
              className={inputCls(!!errors.commissionRate)}
            />
          </Field>
        </div>

        {/* ── Stock Configuration ── */}
        <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1A1A2E]">Giới hạn stock</p>
              <p className="text-xs text-gray-400">Bật để giới hạn số lượng vé có thể bán</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                {...register("stockEnabled")}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-[#F5C842] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:w-4 after:h-4 after:bg-white after:rounded-full after:shadow after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          {stockEnabled && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Số lượng tối đa" error={errors.totalStock?.message}>
                  <input
                    {...register("totalStock")}
                    type="number"
                    min="1"
                    placeholder="500"
                    className={inputCls(!!errors.totalStock)}
                  />
                </Field>

                <Field label="Làm mới stock theo" hint="Hết kỳ → stock reset về giá trị trên">
                  <select {...register("stockResetPeriod")} className={inputCls(false)}>
                    <option value="none">Không làm mới (cố định)</option>
                    <option value="daily">Mỗi ngày</option>
                    <option value="monthly">Mỗi tháng</option>
                  </select>
                </Field>
              </div>

              {stockResetPeriod !== "none" && (
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  <span>⚠️</span>
                  <span>
                    Stock sẽ được reset về <strong>{watch("totalStock") ?? "—"}</strong> vào đầu mỗi{" "}
                    {stockResetPeriod === "daily" ? "ngày" : "tháng"}.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Membership Config — only shown when type = membership */}
      {watch("type") === "membership" && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="font-bold text-[#1A1A2E] text-sm flex items-center gap-2">
              <span>💳</span> Cấu hình Thẻ thành viên
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Khách hàng mua online → đổi thẻ nhựa tại cửa hàng. Thẻ sẽ được nạp sắn số điểm tuyền theo cấu hình này.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tên gói">
              <input
                value={membershipConfig.packageName}
                onChange={(e) => setMembershipConfig((p) => ({ ...p, packageName: e.target.value }))}
                placeholder="Gói Bạc"
                className={inputCls(false)}
              />
            </Field>
            <Field label="Điểm gốc (base points)" hint="= số tiền khách trả chia 1000">
              <input
                type="number"
                min={0}
                value={membershipConfig.basePoints}
                onChange={(e) => setMembershipConfig((p) => ({ ...p, basePoints: Number(e.target.value) }))}
                className={inputCls(false)}
              />
            </Field>
            <Field label="Điểm thưởng (bonus points)" hint="Tặng thêm khi mua">
              <input
                type="number"
                min={0}
                value={membershipConfig.bonusPoints}
                onChange={(e) => setMembershipConfig((p) => ({ ...p, bonusPoints: Number(e.target.value) }))}
                className={inputCls(false)}
              />
            </Field>
            <Field label="Quà merch kèm (tùy chọn)">
              <input
                value={membershipConfig.merch}
                onChange={(e) => setMembershipConfig((p) => ({ ...p, merch: e.target.value }))}
                placeholder="1 gấu bông B.Duck"
                className={inputCls(false)}
              />
            </Field>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
            ℹ️ Khi khách thanh toán → pass tạo ra sẽ ghi nhận:
            <strong> {membershipConfig.basePoints || "BasePoints"} điểm gốc + {membershipConfig.bonusPoints || "BonusPoints"} điểm thưởng = {(membershipConfig.basePoints || 0) + (membershipConfig.bonusPoints || 0)} điểm tổng</strong>.
            Nhân viên sẽ thấy thông tin này khi quét mã QR.
          </div>
        </div>
      )}


      {/* Validity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-bold text-[#1A1A2E] text-sm">Cấu hình hiệu lực vé</h2>

        <Field label="Loại hiệu lực *" error={errors.validityType?.message}>
          <select {...register("validityType")} className={inputCls(false)}>
            <option value="open-dated">Open-dated (số ngày từ khi mua)</option>
            <option value="date-specific">Ngày cụ thể</option>
            <option value="date-range">Khoảng thời gian</option>
            <option value="time-slot">Kích hoạt theo giờ (Time-slot)</option>
          </select>
        </Field>

        {validityType === "open-dated" && (
          <Field label="Hiệu lực (ngày)" hint="VD: 365 = dùng trong 1 năm từ khi mua" error={errors.validDaysFromPurchase?.message}>
            <input
              {...register("validDaysFromPurchase")}
              type="number"
              min="1"
              placeholder="365"
              className={inputCls(!!errors.validDaysFromPurchase)}
            />
          </Field>
        )}

        {validityType === "date-specific" && (
          <Field label="Ngày sử dụng cụ thể" error={errors.specificDate?.message}>
            <input {...register("specificDate")} type="date" className={inputCls(!!errors.specificDate)} />
          </Field>
        )}

        {validityType === "date-range" && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Từ ngày" error={errors.validFrom?.message}>
              <input {...register("validFrom")} type="date" className={inputCls(!!errors.validFrom)} />
            </Field>
            <Field label="Đến ngày" error={errors.validUntil?.message}>
              <input {...register("validUntil")} type="date" className={inputCls(!!errors.validUntil)} />
            </Field>
          </div>
        )}

        {validityType === "time-slot" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Giờ bắt đầu" hint="VD: 09:00" error={errors.timeSlotStart?.message}>
                <input {...register("timeSlotStart")} type="time" className={inputCls(!!errors.timeSlotStart)} />
              </Field>
              <Field label="Giờ kết thúc" hint="VD: 11:00" error={errors.timeSlotEnd?.message}>
                <input {...register("timeSlotEnd")} type="time" className={inputCls(!!errors.timeSlotEnd)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Hiệu lực (ngày)" hint="Từ lúc mua" error={errors.validDaysFromPurchase?.message}>
                <input
                  {...register("validDaysFromPurchase")}
                  type="number"
                  min="1"
                  placeholder="365"
                  className={inputCls(!!errors.validDaysFromPurchase)}
                />
              </Field>
              <Field label="Hạn chót" hint="Ngày hết hạn (tùy chọn)" error={errors.validUntil?.message}>
                <input {...register("validUntil")} type="date" className={inputCls(!!errors.validUntil)} />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || isUploading || submitSuccess}
          className="flex items-center gap-2 px-6 py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{productId ? "Đang cập nhật..." : "Đang tạo..."}</>
          ) : (
            productId ? "Lưu thay đổi" : "Tạo sản phẩm"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-3 bg-white border border-gray-200 text-gray-600 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function inputCls(hasError: boolean) {
  return `w-full px-3 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all bg-gray-50 ${
    hasError
      ? "border-red-300 focus:ring-red-200"
      : "border-gray-200 focus:ring-[#F5C842] focus:border-transparent"
  }`;
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
        {label}
        {hint && <span className="ml-1.5 text-gray-300 normal-case font-normal">· {hint}</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
