"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import { type Locale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/hooks";
import {
  LayoutDashboard,
  Ticket,
  ShoppingBag,
  Tag,
  QrCode,
  Users,
  Wallet,
  Layers,
  ChevronRight,
  Globe,
  LogOut,
  Image as ImageIcon,
  UserCog,
} from "lucide-react";

const LOCALE_FLAGS: Record<Locale, { flag: string; label: string }> = {
    vi: { flag: "/flag-icons/vietnam.png", label: "Tiếng Việt" },
    en: { flag: "/flag-icons/united-states-of-america.png", label: "English" },
};

const NAV_ITEMS = [
  { href: "/admin", key: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", key: "products", icon: Ticket },
  { href: "/admin/product-groups", key: "productGroups", icon: Layers },
  { href: "/admin/orders", key: "orders", icon: ShoppingBag },
  { href: "/admin/promotions", key: "promotions", icon: Tag },
  { href: "/admin/gallery", key: "gallery", icon: ImageIcon },
  { href: "/admin/scan", key: "scan", icon: QrCode },
  { href: "/admin/affiliates", key: "affiliates", icon: Users },
  { href: "/admin/payouts", key: "payouts", icon: Wallet },
  { href: "/admin/accounts", key: "accounts", icon: UserCog },
];

interface AdminSidebarProps {
  locale: string;
}

export function AdminSidebar({ locale }: AdminSidebarProps) {
  const t = useTranslations("admin.sidebar");
  const currentLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const switchLocale = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-[#1A1A2E] flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <Link href={`/${locale}/admin`} className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#F5C842] rounded-lg flex items-center justify-center font-black text-[#1A1A2E] text-sm">
            BD
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">B.Duck</p>
            <p className="text-white/40 text-xs">Admin Portal</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                active
                  ? "bg-[#F5C842] text-[#1A1A2E]"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
            >
              <item.icon
                className={`h-4 w-4 flex-shrink-0 ${active ? "text-[#1A1A2E]" : ""}`}
              />
              <span className="flex-1">{t(item.key as any)}</span>
              {active && <ChevronRight className="h-3 w-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
        {user?.email && (
          <p className="px-3 py-1 text-white/30 text-xs truncate">{user.email}</p>
        )}
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 text-sm hover:text-white hover:bg-white/8 transition-colors"
        >
          <Globe className="h-4 w-4" />
          <span>{t("viewWebsite")}</span>
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/50 text-sm hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>{t("logout")}</span>
        </button>

        {/* Language Switcher */}
        <div className="pt-2 px-1 flex items-center justify-between gap-1 border-t border-white/5 mt-2">
          {(Object.keys(LOCALE_FLAGS) as Locale[]).map((loc) => {
             const isCurrent = loc === currentLocale;
             return (
               <button 
                 key={loc}
                 onClick={() => switchLocale(loc)}
                 className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 rounded-lg transition-colors ${
                   isCurrent 
                     ? "bg-white/10 text-white shadow-inner" 
                     : "text-white/40 hover:bg-white/5 hover:text-white/80"
                 }`}
               >
                 <Image src={LOCALE_FLAGS[loc].flag} alt={loc} width={16} height={16} className="rounded-sm opacity-90" />
                 <span className="text-[11px] font-medium uppercase tracking-wider">{loc}</span>
               </button>
             );
          })}
        </div>
      </div>
    </aside>
  );
}
