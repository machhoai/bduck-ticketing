import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Đăng nhập | B.Duck Cityfuns",
  description: "Đăng nhập hoặc tạo tài khoản B.Duck Cityfuns để mua vé, quản lý đơn hàng và trải nghiệm ưu đãi dành riêng cho thành viên.",
  robots: "noindex,nofollow",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  // No sidebar or topbar — pure centered layout
  return <>{children}</>;
}
