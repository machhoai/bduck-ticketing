// Affiliate Portal Layout — Server-side auth guard
// Checks: authenticated + role === 'affiliate' + applicationStatus === 'approved'
import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { AffiliateProfileDocument } from "@/types/firestore";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Wallet, Settings } from "lucide-react";

export const metadata: Metadata = {
  title: {
    template: "%s — Affiliate | B.Duck Cityfuns",
    default: "Affiliate Portal | B.Duck Cityfuns",
  },
  robots: "noindex,nofollow",
};

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AffiliatePortalLayout({ children, params }: Props) {
  const { locale } = await params;

  // Step 1: Verify session
  const session = await verifySession();
  if (!session) {
    redirect(`/${locale}/auth/login?next=/${locale}/affiliate`);
  }

  // Step 2: Verify affiliate role via custom claims
  const user = await adminAuth.getUser(session.uid);
  const claims = user.customClaims as { role?: string } | undefined;

  if (claims?.role !== "affiliate") {
    redirect(`/${locale}/unauthorized`);
  }

  // Step 3: Verify applicationStatus === 'approved' by querying by userId
  const profileSnap = await adminDb
    .collection(COLLECTIONS.AFFILIATE_PROFILES)
    .where("userId", "==", session.uid)
    .limit(1)
    .get();

  if (profileSnap.empty) {
    redirect(`/${locale}/affiliate/apply`);
  }

  const profile = profileSnap.docs[0].data() as AffiliateProfileDocument;

  if (profile.applicationStatus !== "approved") {
    redirect(`/${locale}/unauthorized`);
  }

  const navLinks = [
    { href: `/${locale}/affiliate`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/${locale}/affiliate/stats`, label: "Thống kê", icon: BarChart3 },
    { href: `/${locale}/affiliate/payouts`, label: "Rút tiền", icon: Wallet },
    { href: `/${locale}/affiliate/payouts/bank-info`, label: "Ngân hàng", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#F8F7F4] overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-black text-sm">
              BD
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">B.Duck Cityfuns</p>
              <p className="text-xs text-gray-400 font-medium">Affiliate Portal</p>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-100">
          <p className="text-xs text-gray-500 font-medium mb-1">Số dư ví</p>
          <p className="text-xl font-black text-gray-900">
            {(profile.walletBalance ?? 0).toLocaleString("vi-VN")}
            <span className="text-sm font-semibold text-gray-500 ml-1">VND</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Code: <span className="font-bold text-orange-600">{profile.referralCode}</span>
          </p>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Commission: {((profile.defaultCommissionRate ?? 0) * 100).toFixed(0)}% / đơn hàng
          </p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
