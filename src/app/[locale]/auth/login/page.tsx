"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createUserSession } from "@/actions/auth";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import type { Metadata } from "next";

// Note: metadata export is picked up by the parent RSC layout only
// For the client component itself, title is set via the parent page wrapper.

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Step 1: Firebase client-side auth
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Step 2: Get ID token and mint server-side session cookie
      const idToken = await credential.user.getIdToken();
      await createUserSession(idToken);

      // Step 3: Navigate to destination
      router.push(nextUrl);
      router.refresh(); // Refresh RSC cache so layout picks up new session
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Email hoặc mật khẩu không đúng");
      } else if (code === "auth/too-many-requests") {
        setError("Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Thử lại sau.");
      } else if (code === "auth/user-disabled") {
        setError("Tài khoản này đã bị vô hiệu hóa");
      } else {
        setError("Đăng nhập thất bại. Vui lòng thử lại.");
        console.error("[login]", err);
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header stripe */}
          <div className="bg-[#1A1A2E] px-8 py-7">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-[#F5C842] rounded-xl flex items-center justify-center font-black text-[#1A1A2E] text-base">
                BD
              </div>
              <div>
                <p className="text-white font-bold text-base leading-tight">B.Duck Cityfuns</p>
                <p className="text-white/40 text-xs">Admin Portal</p>
              </div>
            </div>
            <p className="text-white/60 text-sm mt-4">
              Đăng nhập để truy cập trang quản trị
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@bduck.vn"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent transition-all disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent transition-all disabled:opacity-50 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-[#F5C842]/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập →"
              )}
            </button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-5">
          Chỉ dành cho nhân viên B.Duck Cityfuns có quyền admin.
        </p>
      </div>
    </div>
  );
}
