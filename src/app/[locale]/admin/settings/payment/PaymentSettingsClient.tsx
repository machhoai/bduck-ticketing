"use client";

import { useState, useCallback } from "react";
import {
  Settings,
  Save,
  ToggleLeft,
  ToggleRight,
  Building2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  updatePaymentMethodsSettings,
  updateBankTransferSettings,
  type BankTransferConfig,
} from "@/actions/admin/settings";
import type { PaymentMethodToggle } from "@/types/firestore";

// ─── Labels ───────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  counter: "Thanh toán tại quầy",
  bank_transfer: "Chuyển khoản ngân hàng (VietQR)",
  vnpay_card: "Thẻ ATM / Internet Banking (Napas)",
  vnpay_intl: "Thẻ quốc tế Visa / Mastercard / JCB",
  vnpay_transfer: "Chuyển khoản qua VNPay",
  vnpay_qr: "QR Pay (VNPay)",
  vnpay_wallet: "Ví VNPay",
  momo: "Ví MoMo",
  zalopay: "Ví ZaloPay",
  apple_pay: "Apple Pay",
};

export function PaymentSettingsClient({
  initialMethods,
  initialBankConfig,
}: {
  initialMethods: PaymentMethodToggle[];
  initialBankConfig: BankTransferConfig | null;
}) {
  // ── Payment Methods State ──
  const [methods, setMethods] = useState<PaymentMethodToggle[]>(initialMethods);
  const [methodsSaving, setMethodsSaving] = useState(false);
  const [methodsMessage, setMethodsMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Bank Transfer Config State ──
  const [bankConfig, setBankConfig] = useState<BankTransferConfig>({
    bankId: initialBankConfig?.bankId ?? "",
    accountNo: initialBankConfig?.accountNo ?? "",
    template: initialBankConfig?.template ?? "compact2",
    accountName: initialBankConfig?.accountName ?? "",
  });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankMessage, setBankMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ── Handlers ──
  const toggleMethod = useCallback(
    (id: string) => {
      setMethods((prev) =>
        prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
      );
    },
    []
  );

  const handleSaveMethods = useCallback(async () => {
    setMethodsSaving(true);
    setMethodsMessage(null);
    const result = await updatePaymentMethodsSettings(methods);
    setMethodsSaving(false);
    if (result.success) {
      setMethodsMessage({ type: "success", text: "Đã lưu thành công" });
    } else {
      setMethodsMessage({ type: "error", text: result.error ?? "Lỗi" });
    }
    setTimeout(() => setMethodsMessage(null), 3000);
  }, [methods]);

  const handleSaveBank = useCallback(async () => {
    setBankSaving(true);
    setBankMessage(null);
    const result = await updateBankTransferSettings(bankConfig);
    setBankSaving(false);
    if (result.success) {
      setBankMessage({ type: "success", text: "Đã lưu thành công" });
    } else {
      setBankMessage({ type: "error", text: result.error ?? "Lỗi" });
    }
    setTimeout(() => setBankMessage(null), 3000);
  }, [bankConfig]);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <Settings className="h-7 w-7 text-gray-500" />
          Cấu hình thanh toán
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Bật/tắt phương thức thanh toán và cấu hình thông tin ngân hàng
        </p>
      </div>

      {/* Payment Methods Toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-500" />
          Phương thức thanh toán
        </h2>

        <div className="space-y-3">
          {methods.map((method) => (
            <div
              key={method.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                method.enabled
                  ? "border-blue-200 bg-blue-50/50"
                  : "border-gray-100 bg-gray-50/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    method.enabled ? "bg-blue-100" : "bg-gray-100"
                  }`}
                >
                  <CreditCard
                    className={`h-5 w-5 ${
                      method.enabled ? "text-blue-500" : "text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {METHOD_LABELS[method.id] ?? method.id}
                  </p>
                  <p className="text-xs text-gray-400">ID: {method.id}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleMethod(method.id)}
                className="focus:outline-none"
              >
                {method.enabled ? (
                  <ToggleRight className="h-8 w-8 text-blue-500" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-gray-300" />
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSaveMethods}
            loading={methodsSaving}
          >
            <Save className="h-4 w-4" />
            Lưu phương thức
          </Button>
          {methodsMessage && (
            <span
              className={`text-sm flex items-center gap-1 ${
                methodsMessage.type === "success"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {methodsMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {methodsMessage.text}
            </span>
          )}
        </div>
      </div>

      {/* Bank Transfer Configuration */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-500" />
          Cấu hình ngân hàng (VietQR)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Bank ID (VietQR)
            </label>
            <input
              type="text"
              value={bankConfig.bankId}
              onChange={(e) =>
                setBankConfig((c) => ({ ...c, bankId: e.target.value }))
              }
              placeholder="970436"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <p className="text-xs text-gray-400 mt-1">
              Ví dụ: 970436 (Vietcombank), 970418 (BIDV), 970415 (Vietinbank)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Số tài khoản
            </label>
            <input
              type="text"
              value={bankConfig.accountNo}
              onChange={(e) =>
                setBankConfig((c) => ({ ...c, accountNo: e.target.value }))
              }
              placeholder="1234567890"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Tên chủ tài khoản
            </label>
            <input
              type="text"
              value={bankConfig.accountName}
              onChange={(e) =>
                setBankConfig((c) => ({
                  ...c,
                  accountName: e.target.value.toUpperCase(),
                }))
              }
              placeholder="NGUYEN VAN A"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 uppercase"
            />
            <p className="text-xs text-gray-400 mt-1">
              Viết in hoa, không dấu
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              VietQR Template
            </label>
            <select
              value={bankConfig.template}
              onChange={(e) =>
                setBankConfig((c) => ({ ...c, template: e.target.value }))
              }
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="compact2">compact2 (mặc định)</option>
              <option value="compact">compact</option>
              <option value="qr_only">qr_only</option>
              <option value="print">print</option>
            </select>
          </div>
        </div>

        {/* Preview */}
        {bankConfig.bankId && bankConfig.accountNo && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500">Xem trước mã QR thanh toán:</p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.vietqr.io/image/${bankConfig.bankId}-${bankConfig.accountNo}-${bankConfig.template}.png?amount=100000&addInfo=PREVIEW&accountName=${encodeURIComponent(bankConfig.accountName)}`}
                alt="VietQR Preview"
                className="max-w-[320px] w-full rounded-xl border border-gray-200 shadow-sm"
              />
            </div>
            <p className="text-[11px] text-gray-400 text-center">
              Đây là ảnh mẫu với số tiền 100.000₫ — mã QR thực tế sẽ được tạo tự động theo từng đơn hàng
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSaveBank}
            loading={bankSaving}
          >
            <Save className="h-4 w-4" />
            Lưu cấu hình ngân hàng
          </Button>
          {bankMessage && (
            <span
              className={`text-sm flex items-center gap-1 ${
                bankMessage.type === "success"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {bankMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {bankMessage.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
