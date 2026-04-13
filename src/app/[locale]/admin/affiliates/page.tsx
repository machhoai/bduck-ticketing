import { getAffiliateApplications, approveAffiliate, rejectAffiliate, suspendAffiliate } from "@/actions/admin/affiliates";
import { CheckCircle2, XCircle, PauseCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Affiliate" };
export const dynamic = "force-dynamic";

const TAB_CONFIG = [
  { status: "pending" as const, label: "Chờ duyệt", color: "amber" },
  { status: "approved" as const, label: "Đã duyệt", color: "emerald" },
  { status: "rejected" as const, label: "Từ chối", color: "red" },
  { status: "suspended" as const, label: "Tạm khóa", color: "gray" },
];

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function formatVND(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(v);
}

export default async function AdminAffiliatesPage({ searchParams }: PageProps) {
  const { tab = "pending" } = await searchParams;
  const currentStatus = (tab as "pending" | "approved" | "rejected" | "suspended") || "pending";

  const affiliates = await getAffiliateApplications(currentStatus);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🤝 Affiliate</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TAB_CONFIG.map(({ status, label }) => (
          <a key={status} href={`?tab=${status}`}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${status === currentStatus ? "bg-[#1A1A2E] text-white" : "text-gray-500 hover:text-[#1A1A2E]"}`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {affiliates.map((aff) => (
          <div key={aff.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-bold text-[#1A1A2E]">{aff.displayName}</p>
                <p className="text-sm text-gray-500">{aff.email}</p>
                {aff.socialLinks && Object.entries(aff.socialLinks).map(([k, v]) => (
                  <p key={k} className="text-xs text-blue-500">{k}: {v}</p>
                ))}
                {aff.applicationStatus === "approved" && (
                  <p className="text-sm mt-1">
                    <span className="text-gray-400">Hoa hồng:</span>{" "}
                    <span className="font-semibold text-[#1A1A2E]">{(aff.defaultCommissionRate ?? 0) * 100}%</span>
                    {"  "}
                    <span className="text-gray-400 ml-3">Ví:</span>{" "}
                    <span className="font-semibold text-emerald-600">{formatVND(aff.walletBalance ?? 0)}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentStatus === "pending" && (
                  <>
                    <form action={async (fd: FormData) => {
                      "use server";
                      const rate = parseFloat(String(fd.get("rate") ?? "0.1"));
                      await approveAffiliate(aff.id, rate);
                    }} className="flex items-center gap-2">
                      <input name="rate" type="number" step="0.01" min="0" max="1" defaultValue="0.1"
                        className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" placeholder="Rate (0-1)" />
                      <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-semibold rounded-lg hover:bg-emerald-100 transition-colors">
                        <CheckCircle2 className="h-3 w-3" /> Duyệt
                      </button>
                    </form>
                    <form action={async (fd: FormData) => {
                      "use server";
                      const reason = String(fd.get("reason") ?? "Không đủ điều kiện");
                      await rejectAffiliate(aff.id, reason);
                    }} className="flex items-center gap-2">
                      <input name="reason" placeholder="Lý do từ chối" required className="w-36 px-2 py-1.5 text-xs border border-gray-200 rounded-lg" />
                      <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-500 border border-red-200 text-xs font-semibold rounded-lg hover:bg-red-100 transition-colors">
                        <XCircle className="h-3 w-3" /> Từ chối
                      </button>
                    </form>
                  </>
                )}

                {currentStatus === "approved" && (
                  <form action={async () => {
                    "use server";
                    await suspendAffiliate(aff.id);
                  }}>
                    <button type="submit" className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 text-xs font-semibold rounded-lg hover:bg-amber-100 transition-colors">
                      <PauseCircle className="h-3 w-3" /> Tạm khóa
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ))}

        {affiliates.length === 0 && (
          <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
            Không có affiliate nào trong danh mục này
          </div>
        )}
      </div>
    </div>
  );
}
