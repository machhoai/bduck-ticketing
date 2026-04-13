"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useRouter } from "next/navigation";
import { useState, useRef, useTransition } from "react";
import { createProduct, updateProduct, uploadThumbnail } from "@/actions/admin/products";
import type { ProductGroupDocument, ProductDocument } from "@/types/firestore";
import { Upload, Loader2, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";

// ─── Zod Schema (client-side — matches server schema) ────────────────────────
const formSchema = z.object({
  name: z.string().min(2, "Tên tối thiểu 2 ký tự"),
  description: z.string().optional(),
  type: z.enum(["ticket", "combo"]),
  price: z.coerce.number().positive("Giá phải lớn hơn 0"),
  groupId: z.string().optional(),
  totalStock: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  commissionRate: z.coerce.number().min(0).max(100).optional().or(z.literal("").transform(() => undefined)),
  validityType: z.enum(["open-dated", "date-specific", "date-range"]),
  validDaysFromPurchase: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  specificDate: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      type: initialData?.type ?? "ticket",
      price: initialData?.price ?? undefined,
      groupId: initialData?.groupId ?? "",
      totalStock: initialData?.totalStock ?? undefined,
      commissionRate: initialData?.commissionRate ? initialData.commissionRate * 100 : undefined,
      validityType: initialData?.validityConfig?.type ?? "open-dated",
      validDaysFromPurchase: initialData?.validityConfig?.validDaysFromPurchase ?? undefined,
    },
  });

  const validityType = watch("validityType");

  // ─── Thumbnail Upload ─────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);

    // Local preview
    setThumbnailPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("thumbnail", file);

    const result = await uploadThumbnail(formData);
    if (result.success && result.data) {
      setThumbnailUrl(result.data.url);
    } else if (!result.success) {
      setUploadError(result.error ?? "Upload thất bại");
      setThumbnailPreview(thumbnailUrl);
    }
    setIsUploading(false);
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

    const payload = {
      name: data.name,
      description: data.description,
      type: data.type,
      price: data.price,
      thumbnailUrl,
      groupId: data.groupId || undefined,
      totalStock: data.totalStock,
      commissionRate: data.commissionRate ? data.commissionRate / 100 : undefined,
      validityConfig: validityConfig as Parameters<typeof createProduct>[0]["validityConfig"],
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
                  accept="image/jpeg,image/png,image/webp"
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
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang upload...</>
                  ) : (
                    <><Upload className="h-3.5 w-3.5" /> Chọn ảnh</>
                  )}
                </button>
                <p className="text-xs text-gray-400">JPG, PNG, WebP · tối đa 5MB</p>
                <p className="text-xs text-amber-500">⚠ Yêu cầu Firebase Storage đã được kích hoạt</p>
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

        <Field label="Tên sản phẩm *" error={errors.name?.message}>
          <input
            {...register("name")}
            placeholder="VD: Vé vào cổng B.Duck Funland"
            className={inputCls(!!errors.name)}
          />
        </Field>

        <Field label="Mô tả" error={errors.description?.message}>
          <textarea
            {...register("description")}
            rows={3}
            placeholder="Mô tả ngắn về sản phẩm..."
            className={`${inputCls(false)} resize-none`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Loại sản phẩm *" error={errors.type?.message}>
            <select {...register("type")} className={inputCls(!!errors.type)}>
              <option value="ticket">Vé đơn (ticket)</option>
              <option value="combo">Combo</option>
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
          <Field label="Giá (VND) *" error={errors.price?.message}>
            <input
              {...register("price")}
              type="number"
              step="1000"
              min="0"
              placeholder="150000"
              className={inputCls(!!errors.price)}
            />
          </Field>

          <Field label="Tổng stock (để trống = không giới hạn)" error={errors.totalStock?.message}>
            <input
              {...register("totalStock")}
              type="number"
              min="1"
              placeholder="500"
              className={inputCls(!!errors.totalStock)}
            />
          </Field>
        </div>

        <Field
          label="Hoa hồng affiliate (%)"
          hint="Bỏ trống để dùng default của affiliate"
          error={errors.commissionRate?.message}
        >
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

      {/* Validity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-bold text-[#1A1A2E] text-sm">Cấu hình hiệu lực vé</h2>

        <Field label="Loại hiệu lực *" error={errors.validityType?.message}>
          <select {...register("validityType")} className={inputCls(false)}>
            <option value="open-dated">Open-dated (số ngày từ khi mua)</option>
            <option value="date-specific">Ngày cụ thể</option>
            <option value="date-range">Khoảng thời gian</option>
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
