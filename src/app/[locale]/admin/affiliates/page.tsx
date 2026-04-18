import {
  getAffiliateApplications,
  approveAffiliate,
  rejectAffiliate,
  suspendAffiliate,
} from "@/actions/admin/affiliates";
import { CheckCircle2, XCircle, PauseCircle, ExternalLink, Users, CalendarDays, Info } from "lucide-react";
import type { Metadata } from "next";
import type { AffiliateProfileDocument } from "@/types/firestore";
import { Timestamp } from "firebase/firestore";

export const metadata: Metadata = { title: "Affiliate" };
export const dynamic = "force-dynamic";

const TAB_CONFIG = [
  { status: "pending" as const, label: "Chờ duyệt", dot: "bg-amber-400" },
  { status: "approved" as const, label: "Đã duyệt", dot: "bg-emerald-400" },
  { status: "rejected" as const, label: "Từ chối", dot: "bg-red-400" },
  { status: "suspended" as const, label: "Tạm khóa", dot: "bg-gray-400" },
];

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  try {
    const d = (ts as Timestamp).toDate?.() ?? new Date(ts as string);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function AffiliateCard({
  aff,
  isPending,
  isApproved,
}: {
  aff: AffiliateProfileDocument;
  isPending: boolean;
  isApproved: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {aff.displayName?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{aff.displayName}</p>
              <a
                href={`mailto:${aff.email}`}
                className="text-xs text-blue-500 hover:underline"
              >
                {aff.email}
              </a>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
              <CalendarDays className="w-3 h-3" />
              {formatDate(aff.appliedAt)}
            </p>
            {aff.phoneNumber && (
              <p className="text-xs text-gray-500 mt-1">{aff.phoneNumber}</p>
            )}
          </div>
        </div>
      </div>

      {/* Application Details */}
      <div className="p-5 space-y-3">
        {/* Niche + Followers */}
        <div className="flex gap-3 flex-wrap">
          {aff.niche && (
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full">
              {aff.niche}
            </span>
          )}
          {aff.followerCount && (
            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full flex items-center gap-1">
              <Users className="w-3 h-3" />
              {aff.followerCount.toLocaleString("vi-VN")} followers
            </span>
          )}
        </div>

        {/* Bio */}
        {aff.bio && (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{aff.bio}</p>
        )}

        {/* Social Links */}
        {aff.socialLinks && Object.entries(aff.socialLinks).some(([, v]) => v) && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(aff.socialLinks)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <a
                  key={k}
                  href={v!.startsWith("http") ? v! : `https://${v}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 hover:border-gray-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {k}: {v}
                </a>
              ))}
          </div>
        )}

        {/* Approved info */}
        {isApproved && (
          <div className="pt-2 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Referral Code</p>
                <p className="font-mono font-bold text-gray-900 text-sm">{aff.referralCode}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">Hoa hồng</p>
                <p className="font-bold text-gray-900 text-sm">
                  {((aff.defaultCommissionRate ?? 0) * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-600 mb-1">Clicks</p>
                <p className="font-bold text-blue-900">{aff.totalClicks ?? 0}</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-xs text-emerald-600 mb-1">Đơn hàng</p>
                <p className="font-bold text-emerald-900">{aff.totalConversions ?? 0}</p>
              </div>
              <div className="bg-yellow-50 rounded-xl p-3 text-center">
                <p className="text-xs text-yellow-600 mb-1">Số dư ví</p>
                <p className="font-bold text-yellow-900 text-xs">
                  {(aff.walletBalance ?? 0).toLocaleString("vi-VN")}đ
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {aff.applicationStatus === "rejected" && aff.rejectionReason && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100">
            <Info className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">
              <strong>Lý do từ chối:</strong> {aff.rejectionReason}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {(isPending || isApproved) && (
        <div className="px-5 pb-5">
          <div className="pt-4 border-t border-gray-100">
            {isPending && (
              <div className="flex flex-col gap-3">
                {/* Approve form */}
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    const rate = parseFloat(String(fd.get("rate") ?? "0.1"));
                    await approveAffiliate(aff.id, rate);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    name="rate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    defaultValue="0.1"
                    className="w-28 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    placeholder="Hoa hồng (0-1)"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Duyệt & Gửi thông tin đăng nhập
                  </button>
                </form>

                {/* Reject form */}
                <form
                  action={async (fd: FormData) => {
                    "use server";
                    const reason = String(fd.get("reason") ?? "");
                    await rejectAffiliate(aff.id, reason);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    name="reason"
                    required
                    placeholder="Lý do từ chối (bắt buộc)"
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors flex-shrink-0"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Từ chối & Gửi email
                  </button>
                </form>
              </div>
            )}

            {isApproved && (
              <form
                action={async () => {
                  "use server";
                  await suspendAffiliate(aff.id);
                }}
              >
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-200 transition-colors"
                >
                  <PauseCircle className="h-3.5 w-3.5" />
                  Tạm khóa affiliate
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function AdminAffiliatesPage({ searchParams }: PageProps) {
  const { tab = "pending" } = await searchParams;
  const currentStatus =
    (tab as "pending" | "approved" | "rejected" | "suspended") || "pending";

  const affiliates = await getAffiliateApplications(currentStatus);

  const counts = await Promise.all(
    TAB_CONFIG.map(async ({ status }) => {
      const list = await getAffiliateApplications(status);
      return { status, count: list.length };
    })
  );
  const countMap = Object.fromEntries(counts.map(({ status, count }) => [status, count]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🤝 Affiliate</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quản lý đơn đăng ký KOL/affiliate và gửi thông tin đăng nhập tự động
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {TAB_CONFIG.map(({ status, label, dot }) => (
          <a
            key={status}
            href={`?tab=${status}`}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              status === currentStatus
                ? "bg-[#1A1A2E] text-white"
                : "text-gray-500 hover:text-[#1A1A2E]"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            {label}
            {countMap[status] > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                  status === currentStatus
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {countMap[status]}
              </span>
            )}
          </a>
        ))}
      </div>

      {/* Note for pending */}
      {currentStatus === "pending" && affiliates.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          <Info className="w-4 h-4 flex-shrink-0" />
          Khi duyệt, hệ thống sẽ tự tạo tài khoản Firebase và gửi email kèm thông tin đăng nhập cho affiliate.
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {affiliates.map((aff) => (
          <AffiliateCard
            key={aff.id}
            aff={aff}
            isPending={currentStatus === "pending"}
            isApproved={currentStatus === "approved"}
          />
        ))}
      </div>

      {affiliates.length === 0 && (
        <div className="text-center py-20 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
          <p className="text-3xl mb-3">📭</p>
          Không có đơn nào trong danh mục này
        </div>
      )}
    </div>
  );
}
