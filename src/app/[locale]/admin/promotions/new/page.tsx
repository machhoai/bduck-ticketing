"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { createPromotion } from "@/actions/admin/promotions";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  code: z.string().min(3, "Mã tối thiểu 3 ký tự").toUpperCase(),
  type: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive("Giá trị giảm phải lớn hơn 0"),
  maxDiscountAmount: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
  minOrderValue: z.coerce.number().nonnegative().optional().or(z.literal("").transform(() => undefined)),
  maxUses: z.coerce.number().int().positive("Số lần dùng phải lớn hơn 0"),
  maxUsesPerUser: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default function NewPromotionPage() {
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { type: "percentage", maxUses: 100 },
  });

  const promoType = watch("type");

  function onSubmit(data: FormValues) {
    setSubmitError(null);
    startTransition(async () => {
      const result = await createPromotion(data);
      if (result.success) {
        setSubmitSuccess(true);
        setTimeout(() => router.push(`/${locale}/admin/promotions`), 800);
      } else {
        setSubmitError(result.error ?? "Lỗi không xác định");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🏷️ Tạo mã khuyến mãi</h1>
          <p className="text-sm text-gray-400 mt-0.5">Mã giảm giá cho khách hàng khi thanh toán</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {submitSuccess && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            Tạo mã thành công! Đang chuyển trang...
          </div>
        )}
        {submitError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {submitError}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-[#1A1A2E] text-sm">Cấu hình mã giảm giá</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Mã khuyến mãi *" error={errors.code?.message}>
              <input
                {...register("code")}
                placeholder="DUCK2025"
                className={`${inputCls(!!errors.code)} uppercase`}
                style={{ textTransform: "uppercase" }}
              />
            </Field>

            <Field label="Loại giảm *" error={errors.type?.message}>
              <select {...register("type")} className={inputCls(!!errors.type)}>
                <option value="percentage">Phần trăm (%)</option>
                <option value="fixed">Số tiền cố định (VND)</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label={promoType === "percentage" ? "Giảm (%) *" : "Giảm (VND) *"}
              error={errors.discountValue?.message}
            >
              <input
                {...register("discountValue")}
                type="number"
                min="0"
                step={promoType === "percentage" ? "1" : "1000"}
                placeholder={promoType === "percentage" ? "10" : "50000"}
                className={inputCls(!!errors.discountValue)}
              />
            </Field>

            {promoType === "percentage" && (
              <Field
                label="Giảm tối đa (VND)"
                hint="bỏ trống = không giới hạn"
                error={errors.maxDiscountAmount?.message}
              >
                <input
                  {...register("maxDiscountAmount")}
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="200000"
                  className={inputCls(!!errors.maxDiscountAmount)}
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Đơn hàng tối thiểu (VND)"
              hint="bỏ trống = không giới hạn"
              error={errors.minOrderValue?.message}
            >
              <input
                {...register("minOrderValue")}
                type="number"
                min="0"
                step="1000"
                placeholder="100000"
                className={inputCls(!!errors.minOrderValue)}
              />
            </Field>

            <Field label="Số lần dùng tối đa *" error={errors.maxUses?.message}>
              <input
                {...register("maxUses")}
                type="number"
                min="1"
                placeholder="100"
                className={inputCls(!!errors.maxUses)}
              />
            </Field>
          </div>

          <Field
            label="Số lần dùng / người"
            hint="bỏ trống = không giới hạn"
            error={errors.maxUsesPerUser?.message}
          >
            <input
              {...register("maxUsesPerUser")}
              type="number"
              min="1"
              placeholder="1"
              className={`w-48 ${inputCls(!!errors.maxUsesPerUser)}`}
            />
          </Field>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-bold text-[#1A1A2E] text-sm">Thời gian hiệu lực</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Từ ngày" error={errors.startAt?.message}>
              <input {...register("startAt")} type="date" className={inputCls(false)} />
            </Field>
            <Field label="Đến ngày" error={errors.endAt?.message}>
              <input {...register("endAt")} type="date" className={inputCls(false)} />
            </Field>
          </div>
          <p className="text-xs text-gray-400">Bỏ trống = không giới hạn thời gian</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || submitSuccess}
            className="flex items-center gap-2 px-6 py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Đang tạo...</>
            ) : (
              "Tạo mã khuyến mãi"
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
    </div>
  );
}
