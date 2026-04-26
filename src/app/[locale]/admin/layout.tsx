// Admin Layout — Server-side auth guard
// requireAdmin() throws → redirect before any admin content renders
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { adminAuth } from "@/lib/firebase/admin";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { template: "%s — Admin | B.Duck Cityfuns", default: "Admin | B.Duck Cityfuns" },
  robots: "noindex,nofollow",
};

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AdminLayout({ children, params }: Props) {
  const { locale } = await params;

  // Step 1: Verify session cookie
  const session = await verifySession();
  if (!session) {
    redirect(`/${locale}/auth/login?next=/${locale}/admin`);
  }

  // Step 2: Verify admin role via custom claims
  const user = await adminAuth.getUser(session.uid);
  const claims = user.customClaims as { role?: string } | undefined;

  if (claims?.role !== "admin") {
    redirect(`/${locale}/unauthorized`);
  }

  return (
    <div className="flex h-screen bg-[#F8F7F4] overflow-hidden">
      <AdminSidebar locale={locale} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pt-14 lg:pt-0">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
