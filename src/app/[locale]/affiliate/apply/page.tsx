"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitApplication, getMyAffiliateProfile } from "@/actions/affiliate/apply";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Loader2,
  Link2,
} from "lucide-react";

// ─── TikTok Icon (Lucide doesn't have it) ────────────────────────────────────
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.77a8.2 8.2 0 004.79 1.53V6.85a4.85 4.85 0 01-1.02-.16z" />
    </svg>
  );
}

export default function AffiliateApplyPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "success" | "pending" | "error">("form");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    displayName: "",
    email: "",
    phoneNumber: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    facebook: "",
    followerCount: "",
    niche: "",
    bio: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const result = await submitApplication({
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim() || undefined,
        socialLinks: {
          instagram: form.instagram.trim() || undefined,
          tiktok: form.tiktok.trim() || undefined,
          youtube: form.youtube.trim() || undefined,
          facebook: form.facebook.trim() || undefined,
        },
        followerCount: form.followerCount ? parseInt(form.followerCount) : undefined,
        niche: form.niche.trim() || undefined,
        bio: form.bio.trim() || undefined,
      });

      if (result.success) {
        setStep("success");
      } else {
        if (result.error.includes("đang chờ")) {
          setStep("pending");
        } else {
          setErrorMsg(result.error);
        }
      }
    } catch {
      setErrorMsg("Có lỗi xảy ra. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "success" || step === "pending") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-md w-full text-center">
          {step === "success" ? (
            <>
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 mb-3">Đã gửi đơn đăng ký!</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Đội ngũ B.Duck Cityfuns sẽ xem xét đơn của bạn trong vòng 1–3 ngày làm việc.
                Bạn sẽ nhận được email thông báo kết quả.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-yellow-500" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 mb-3">Đơn đang chờ xét duyệt</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                Đơn đăng ký của bạn đang được xem xét. Vui lòng chờ email thông báo từ chúng tôi.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-black text-base">
              BD
            </div>
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3">
            Trở thành Affiliate
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500">
              {" "}
              B.Duck Cityfuns
            </span>
          </h1>
          <p className="text-gray-500 max-w-md mx-auto">
            Kiếm hoa hồng mỗi khi khách hàng mua vé qua link của bạn. Đăng ký miễn phí, không cần đặt cọc.
          </p>

          {/* Perks */}
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            {["Hoa hồng hấp dẫn", "Dashboard real-time", "Rút tiền nhanh chóng"].map((perk) => (
              <span
                key={perk}
                className="px-3 py-1.5 bg-white border border-yellow-200 text-yellow-700 text-xs font-semibold rounded-full"
              >
                ✓ {perk}
              </span>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl overflow-hidden">
          {/* Error */}
          {errorMsg && (
            <div className="mx-8 mt-8 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          <div className="p-8 space-y-6">
            {/* Personal Info */}
            <section>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Thông tin cá nhân
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Họ tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    value={form.displayName}
                    onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="0901 234 567"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Tổng followers (tất cả kênh)
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                    <input
                      type="number"
                      min={0}
                      value={form.followerCount}
                      onChange={(e) => setForm((f) => ({ ...f, followerCount: e.target.value }))}
                      placeholder="10000"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Social Links */}
            <section>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Mạng xã hội
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: "instagram", label: "Instagram", placeholder: "@username" },
                  { key: "tiktok", label: "TikTok", placeholder: "@username" },
                  { key: "youtube", label: "YouTube", placeholder: "youtube.com/@channel" },
                  { key: "facebook", label: "Facebook", placeholder: "facebook.com/page" },
                ].map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                      <input
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* About */}
            <section>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 pb-2 border-b border-gray-100">
                Giới thiệu bản thân
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Lĩnh vực content
                  </label>
                  <select
                    value={form.niche}
                    onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent bg-white"
                  >
                    <option value="">Chọn lĩnh vực...</option>
                    <option value="family">Gia đình & Trẻ em</option>
                    <option value="travel">Du lịch & Trải nghiệm</option>
                    <option value="lifestyle">Lifestyle</option>
                    <option value="review">Review & Đánh giá</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Giới thiệu ngắn về bạn
                  </label>
                  <textarea
                    rows={4}
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    placeholder="Chia sẻ về audience của bạn, nội dung bạn thường làm, tại sao bạn muốn hợp tác với B.Duck Cityfuns..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Submit */}
          <div className="px-8 pb-8">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-orange-200 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  Gửi đơn đăng ký
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-center text-xs text-gray-400 mt-3">
              Bằng cách gửi đơn, bạn đồng ý với điều khoản affiliate của B.Duck Cityfuns.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
