import { getPayoutRequests, approvePayoutRequest, completePayoutRequest, rejectPayoutRequest } from "@/actions/admin/payouts";
import { CheckCircle2, XCircle, Banknote } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Payouts" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

function formatVND(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}
function formatDate(ts: { toDate(): Date }) {
  return ts.toDate().toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const TABS = ["pending", "approved", "completed", "rejected"] as const;
const TAB_LABEL: Record<string, string> = {
  pending: "Chờ xử lý",
  approved: "Đã duyệt",
  completed: "Hoàn thành",
  rejected: "Từ chối",
};

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const { tab = "pending" } = await searchParams;
  const status = (tab as typeof TABS[number]) || "pending";
  const requests = await getPayoutRequests(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">💰 Payouts</h1>
        <p className="text-sm text-gray-400 mt-1">Quản lý yêu cầu rút tiền affiliate</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TABS.map((t) => (
          <a key={t} href={`?tab=${t}`}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${t === status ? "bg-[#1A1A2E] text-white" : "text-gray-500 hover:text-[#1A1A2E]"}`}
          >
            {TAB_LABEL[t]}
          </a>
        ))}
      </div>

      {/* Requests */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                {["Affiliate", "Số tiền", "Ngân hàng", "Tài khoản", "Ngày YC", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-[#1A1A2E]">{req.affiliateId}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{formatVND(req.amount)}</td>
                  <td className="px-4 py-3 text-gray-500">{req.bankInfoSnapshot?.bankName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{req.bankInfoSnapshot?.accountNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(req.createdAt as any)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {status === "pending" && (
                        <form action={async () => {
                          "use server";
                          await approvePayoutRequest(req.id);
                        }}>
                          <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors">
                            <CheckCircle2 className="h-3 w-3" /> Duyệt
                          </button>
                        </form>
                      )}
                      {status === "approved" && (
                        <form action={async () => {
                          "use server";
                          await completePayoutRequest(req.id);
                        }}>
                          <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                            <Banknote className="h-3 w-3" /> Đã chuyển khoản
                          </button>
                        </form>
                      )}
                      {(status === "pending" || status === "approved") && (
                        <form action={async (fd: FormData) => {
                          "use server";
                          const reason = String(fd.get("reason") ?? "Từ chối");
                          await rejectPayoutRequest(req.id, reason);
                        }} className="flex items-center gap-1">
                          <input name="reason" placeholder="Lý do" required className="w-28 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
                          <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                            <XCircle className="h-3 w-3" /> Từ chối
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">Không có yêu cầu nào</div>
          )}
        </div>
      </div>
    </div>
  );
}
