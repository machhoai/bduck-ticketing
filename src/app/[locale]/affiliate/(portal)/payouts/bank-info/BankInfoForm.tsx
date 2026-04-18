"use client";

import { useState, useTransition } from "react";
import { updateBankInfo } from "@/actions/affiliate/apply";
import type { BankInfo } from "@/types/firestore";
import { Building2, CreditCard, User, MapPin, Loader2, CheckCircle2, AlertCircle, ShieldCheck, ShieldAlert } from "lucide-react";

const POPULAR_BANKS = [
  "Vietcombank", "VietinBank", "BIDV", "Agribank", "Techcombank",
  "MB Bank", "ACB", "VPBank", "TPBank", "Sacombank", "SHB", "HDBank",
];

interface Props {
  currentBankInfo?: BankInfo;
  isVerified: boolean;
}

export function BankInfoForm({ currentBankInfo, isVerified }: Props) {
  const [form, setForm] = useState<BankInfo>({
    bankName: currentBankInfo?.bankName ?? "",
    accountNumber: currentBankInfo?.accountNumber ?? "",
    accountHolderName: currentBankInfo?.accountHolderName ?? "",
    branch: currentBankInfo?.branch ?? "",
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      const res = await updateBankInfo({
        bankName: form.bankName.trim(),
        accountNumber: form.accountNumber.trim(),
        accountHolderName: form.accountHolderName.trim(),
        branch: form.branch?.trim() || undefined,
      });
      setResult(res.success
        ? { success: true, message: "Đã lưu thông tin ngân hàng. Chờ admin xác minh." }
        : { success: false, message: (res as { success: false; error: string }).error }
      );
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Thông tin ngân hàng</h1>
        <p className="text-sm text-gray-500 mt-1">Tài khoản nhận tiền khi rút hoa hồng</p>
      </div>

      <div className={`flex items-center gap-3 p-4 rounded-2xl border ${isVerified ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-yellow-50 border-yellow-100 text-yellow-700"}`}>
        {isVerified ? <ShieldCheck className="w-5 h-5 flex-shrink-0" /> : <ShieldAlert className="w-5 h-5 flex-shrink-0" />}
        <p className="text-sm font-medium">
          {isVerified ? "Tài khoản đã được xác minh. Bạn có thể rút tiền." : "Tài khoản chưa được xác minh. Admin sẽ xác minh sau khi bạn cập nhật."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <h2 className="font-bold text-gray-900 mb-6">Cập nhật tài khoản ngân hàng</h2>

        {result && (
          <div className={`flex items-start gap-3 p-4 rounded-xl mb-6 text-sm ${result.success ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-700"}`}>
            {result.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            {result.message}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Ngân hàng <span className="text-red-500">*</span></label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <select required value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white appearance-none">
                <option value="">Chọn ngân hàng...</option>
                {POPULAR_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="other">Khác</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Số tài khoản <span className="text-red-500">*</span></label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input required value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
                placeholder="1234567890" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tên chủ tài khoản <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(Viết in hoa, không dấu)</span></label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input required value={form.accountHolderName} onChange={(e) => setForm((f) => ({ ...f, accountHolderName: e.target.value.toUpperCase() }))}
                placeholder="NGUYEN VAN A" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Chi nhánh <span className="text-gray-400 font-normal">(không bắt buộc)</span></label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input value={form.branch ?? ""} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))}
                placeholder="Hồ Chí Minh" className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={isPending}
          className="w-full mt-8 flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isPending ? "Đang lưu..." : "Lưu thông tin ngân hàng"}
        </button>
      </form>
    </div>
  );
}
