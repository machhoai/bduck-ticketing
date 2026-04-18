"use client";

import { useState, useTransition } from "react";
import { requestPayout } from "@/actions/affiliate/payouts";
import type { PayoutRequestDocument } from "@/types/firestore";
import {
  Wallet,
  ArrowDownToLine,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  BadgeCheck,
} from "lucide-react";

function StatusBadge({ status }: { status: PayoutRequestDocument["status"] }) {
  const map = {
    pending: { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700", icon: Clock },
    approved: { label: "Đã duyệt", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    processing: { label: "Đang xử lý", color: "bg-purple-100 text-purple-700", icon: Loader2 },
    completed: { label: "Hoàn thành", color: "bg-emerald-100 text-emerald-700", icon: BadgeCheck },
    rejected: { label: "Từ chối", color: "bg-red-100 text-red-700", icon: XCircle },
  };
  const { label, color, icon: Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

interface Props {
  walletBalance: number;
  history: PayoutRequestDocument[];
}

export function PayoutsView({ walletBalance, history }: Props) {
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRequest = () => {
    const parsed = parseInt(amount.replace(/\D/g, ""));
    if (!parsed || parsed < 100_000) {
      setResult({ success: false, message: "Số tiền tối thiểu là 100.000 VND." });
      return;
    }
    startTransition(async () => {
      const res = await requestPayout(parsed);
      if (res.success) {
        setResult({ success: true, message: "Yêu cầu rút tiền đã được gửi!" });
        setAmount("");
      } else {
        setResult({ success: false, message: res.error });
      }
    });
  };

  const formatDate = (ts: unknown) => {
    try {
      const d = (ts as { toDate?: () => Date }).toDate?.() ?? new Date(ts as string);
      return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return "—"; }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Rút tiền</h1>
        <p className="text-sm text-gray-500 mt-1">Yêu cầu rút hoa hồng về tài khoản ngân hàng</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-3 opacity-80">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-semibold">Số dư khả dụng</span>
          </div>
          <p className="text-4xl font-black">
            {walletBalance.toLocaleString("vi-VN")}
            <span className="text-lg font-semibold opacity-70 ml-2">VND</span>
          </p>
          <p className="text-xs opacity-60 mt-2">Tối thiểu: 100.000 VND</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Tạo yêu cầu rút</h2>
          {result && (
            <div className={`flex items-start gap-3 p-3 rounded-xl mb-4 text-sm ${result.success ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-red-50 border border-red-100 text-red-700"}`}>
              {result.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              {result.message}
            </div>
          )}
          <input
            type="text"
            value={amount}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "");
              setAmount(raw ? parseInt(raw).toLocaleString("vi-VN") : "");
            }}
            placeholder="100.000"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 mb-3"
          />
          <div className="flex gap-2 mb-4">
            {[500_000, 1_000_000, 2_000_000].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(v.toLocaleString("vi-VN"))}
                className="flex-1 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:border-yellow-400 hover:text-yellow-600 transition-colors">
                {(v / 1_000_000).toFixed(v < 1_000_000 ? 1 : 0)}M
              </button>
            ))}
          </div>
          <button onClick={handleRequest} disabled={isPending || !amount}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
            {isPending ? "Đang xử lý..." : "Yêu cầu rút tiền"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Lịch sử rút tiền</h2>
        </div>
        {history.length === 0 ? (
          <div className="p-14 text-center text-gray-400 text-sm">Chưa có yêu cầu rút tiền nào.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Ngày yêu cầu", "Số tiền", "Ngân hàng", "Trạng thái"].map((h) => (
                  <th key={h} className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left last:text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {history.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-500 text-xs">{formatDate(req.createdAt)}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{req.amount.toLocaleString("vi-VN")} VND</td>
                  <td className="px-6 py-4 text-gray-600 text-xs">
                    {req.bankInfoSnapshot?.bankName} · ****{req.bankInfoSnapshot?.accountNumber?.slice(-4)}
                  </td>
                  <td className="px-6 py-4 text-center"><StatusBadge status={req.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
