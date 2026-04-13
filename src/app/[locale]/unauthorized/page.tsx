import Link from "next/link";
import { ShieldX } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Không có quyền truy cập | B.Duck Cityfuns",
  robots: "noindex,nofollow",
};

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-50 rounded-2xl mb-5">
          <ShieldX className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E] mb-2">
          Không có quyền truy cập
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Tài khoản của bạn không có quyền quản trị. Vui lòng liên hệ admin để được cấp quyền.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="px-5 py-2.5 bg-[#1A1A2E] text-white font-semibold rounded-xl text-sm hover:bg-[#1A1A2E]/90 transition-colors"
          >
            Về trang chủ
          </Link>
          <Link
            href="/auth/login"
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Đăng nhập lại
          </Link>
        </div>
      </div>
    </div>
  );
}
