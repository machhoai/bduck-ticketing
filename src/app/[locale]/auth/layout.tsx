import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Đăng nhập | B.Duck Cityfuns Admin",
  description: "Trang đăng nhập quản trị B.Duck Cityfuns",
  robots: "noindex,nofollow",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  // No sidebar or topbar — pure centered layout
  return <>{children}</>;
}
