"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { User, ShoppingCart, Menu, X, LogOut, Ticket, ShieldCheck, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, routing } from "@/i18n/routing";
import { useCartStore, rehydrateCart } from "@/stores/cart";
import { CartDrawer } from "@/components/customer/CartDrawer";
import { useAuth, useIsAdmin } from "@/lib/auth/hooks";
import { log } from "console";

/* ── Flag data ────────────────────────────────────────────── */
const LOCALE_FLAGS: Record<Locale, { flag: string; label: string }> = {
    vi: { flag: "/flag-icons/vietnam.png", label: "Tiếng Việt" },
    en: { flag: "/flag-icons/united-states-of-america.png", label: "English" },
};

export function Navbar() {
    const t = useTranslations("nav");
    const locale = useLocale() as Locale;
    const pathname = usePathname();
    const router = useRouter();

    // ── Auth ─────────────────────────────────────────────────
    const { user, signOut, loading: authLoading } = useAuth();
    const isAdmin = useIsAdmin();

    // ── Cart ─────────────────────────────────────────────────
    const cartItems = useCartStore((s) => s.items);
    const hasHydrated = useCartStore((s) => s._hasHydrated);
    const cartCount = hasHydrated ? cartItems.reduce((sum, item) => sum + item.quantity, 0) : 0;
    const [cartOpen, setCartOpen] = useState(false);

    useEffect(() => {
        rehydrateCart();
    }, []);

    // ── UI state ─────────────────────────────────────────────
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [isUserOpen, setIsUserOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        if (!isLangOpen && !isUserOpen) return;
        const close = () => { setIsLangOpen(false); setIsUserOpen(false); };
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [isLangOpen, isUserOpen]);

    // links: href = hash anchor (#id) | route = locale-free path (/tickets)
    const NAV_LINKS = [
        { label: t("home"), href: "/" },
        { label: t("products"), route: "/tickets" },
        { label: t("introduction"), href: "#attractions" },
        { label: t("about"), href: "#about" },
        { label: t("contact"), href: "#contact" },
    ];

    // ── Scroll to section (works on homepage; navigate there if on other page) ─
    const scrollTo = (href: string) => {
        setIsMobileMenuOpen(false);
        const id = href.replace("#", "");
        // next-intl's usePathname returns path WITHOUT locale prefix
        const isHome = pathname === "/";

        if (!isHome) {
            // Navigate to homepage with hash — browser will scroll after load
            router.push(`/${href}`);
            return;
        }

        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 60;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    };

    const switchLocale = (newLocale: Locale) => {
        // next-intl's router.push() with {locale} handles as-needed prefix automatically
        router.push(pathname as string, { locale: newLocale });
        setIsLangOpen(false);
    };

    const handleSignOut = async () => {
        await signOut();
        setIsUserOpen(false);
        router.push("/auth/login");
    };

    if (pathname.startsWith("/admin")) {
        return null;
    }

    return (
        <>
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] border-b",
                    isScrolled
                        ? "bg-white/85 backdrop-blur-2xl border-gray-200/50 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] h-[64px]"
                        : "border-transparent h-[84px]"
                )}
            >
                {/* ── Elegant Container ───────────────────────── */}
                <div className="mx-auto max-w-[1400px] w-full h-full flex items-center justify-between px-4 lg:px-8">

                    {/* Left: Dual Logos */}
                    <div className="flex items-center gap-3 shrink-0">
                        <Image
                            src="/images/logo-bduck-cityfuns.png"
                            alt="B.Duck Funland"
                            width={120}
                            height={60}
                            className="h-[60px] w-auto object-contain"
                            priority
                        />
                        <div className="w-px h-6 bg-border-light" />
                        <Image
                            src="/images/logo-bduck-official.png"
                            alt="B.Duck™"
                            width={90}
                            height={30}
                            className="h-[40px] w-auto object-contain"
                            priority
                        />
                    </div>

                    {/* Center + Right */}
                    <div className="flex items-center gap-2">
                        {/* Desktop Nav Links */}
                        <nav className="hidden lg:flex items-center gap-8 mr-6">
                            {NAV_LINKS.map((link) => {
                                const isActive = link.route
                                    ? pathname === link.route || (link.route !== "/" && pathname.startsWith(link.route + "/"))
                                    : (link.href === "/" && pathname === "/");

                                return (
                                    <button
                                        key={link.route || link.href}
                                        onClick={() => link.route ? router.push(link.route) : scrollTo(link.href!)}
                                        className="relative py-2 text-[14px] font-medium tracking-[0.02em] transition-all duration-300 cursor-pointer group"
                                    >
                                        <span className={cn(
                                            "relative z-10 transition-colors duration-500 ease-out",
                                            isActive
                                                ? (isScrolled ? "text-text-primary font-bold" : "text-white font-bold")
                                                : (isScrolled ? "text-text-secondary group-hover:text-text-primary" : "text-white/80 group-hover:text-white")
                                        )}>
                                            {link.label}
                                        </span>
                                        {/* Elegant underline animation */}
                                        <span className={cn(
                                            "absolute bottom-1 left-0 h-[1.5px] bg-duck-yellow transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
                                            isActive ? "w-full" : "w-0 group-hover:w-full opacity-0 group-hover:opacity-100"
                                        )} />
                                    </button>
                                );
                            })}
                        </nav>

                        {/* Right: Icons */}
                        <div className="flex items-center gap-2">

                            {/* ── Account ─────────────────────────────── */}
                            {!authLoading && (
                                <div className="relative">
                                    <NavIconButton
                                        aria-label={t("account")}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!user) {
                                                router.push("/auth/login");
                                            } else {
                                                setIsUserOpen((v) => !v);
                                            }
                                        }}
                                        className={cn(
                                            user ? "ring-2 ring-duck-yellow" : "",
                                            !isScrolled && "hover:bg-white/10"
                                        )}
                                    >
                                        {user?.photoURL ? (
                                            <img
                                                src={user.photoURL}
                                                alt="avatar"
                                                className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            <User className="w-full h-full" color={!isScrolled ? "white" : "currentColor"} fill={!isScrolled ? "white" : "currentColor"} />
                                        )}
                                    </NavIconButton>

                                    {/* User dropdown */}
                                    {isUserOpen && user && (
                                        <div className="absolute right-0 top-full mt-1 py-1.5 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border-light min-w-[180px] z-50">
                                            {/* User info */}
                                            <div className="px-4 py-2 border-b border-gray-100">
                                                <p className="text-xs font-semibold text-text-primary truncate">
                                                    {user.displayName ?? "Tài khoản"}
                                                </p>
                                                <p className="text-xs text-text-secondary truncate">{user.email}</p>
                                            </div>

                                            {/* Admin panel — only for admins */}
                                            {isAdmin && (
                                                <>
                                                    <div className="mx-3 my-1 h-px bg-gray-100" />
                                                    <Link
                                                        href={`/${locale}/admin`}
                                                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-duck-orange transition-colors"
                                                        onClick={() => setIsUserOpen(false)}
                                                    >
                                                        <ShieldCheck className="h-4 w-4" />
                                                        Quản lý Admin
                                                    </Link>
                                                    <div className="mx-3 my-1 h-px bg-gray-100" />
                                                </>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setIsUserOpen(false);
                                                    router.push("/orders");
                                                }}
                                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-text-secondary hover:bg-surface-100 transition-colors"
                                            >
                                                <Ticket className="h-4 w-4" />
                                                Đơn hàng của tôi
                                            </button>

                                            <button
                                                onClick={handleSignOut}
                                                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                                            >
                                                <LogOut className="h-4 w-4" />
                                                Đăng xuất
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Cart ────────────────────────────────── */}
                            <NavIconButton
                                aria-label={t("cart")}
                                onClick={() => setCartOpen(true)}
                                className={cn(!isScrolled && "hover:bg-white/10")}
                            >
                                <ShoppingCart className="w-full h-full" strokeWidth={1.5} color={!isScrolled ? "white" : "currentColor"} fill={!isScrolled ? "white" : "currentColor"} />
                                {cartCount > 0 && (
                                    <span className="absolute top-[0px] right-[0px] min-w-[18px] h-[18px] aspect-square px-[3px] rounded-full bg-duck-yellow text-text-primary text-[11px] font-semibold flex items-center justify-center">
                                        {cartCount > 9 ? "9+" : cartCount}
                                    </span>
                                )}
                            </NavIconButton>

                            {/* ── Language Switcher ─────────────────── */}
                            <div className="relative">
                                <NavIconButton
                                    aria-label={t("language")}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsLangOpen(!isLangOpen);
                                    }}
                                    className={cn(!isScrolled && "hover:bg-white/10")}
                                >
                                    <span className="text-base leading-none">
                                        <Image
                                            src={LOCALE_FLAGS[locale].flag}
                                            alt={LOCALE_FLAGS[locale].label}
                                            width={20}
                                            height={20}
                                            className="w-5 h-5 object-contain"
                                        />
                                    </span>
                                </NavIconButton>

                                {isLangOpen && (
                                    <div className="absolute overflow-hidden right-0 top-full mt-1 py-1 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border-light min-w-[140px] z-50">
                                        {routing.locales.map((loc) => (
                                            <button
                                                key={loc}
                                                onClick={() => switchLocale(loc)}
                                                className={cn(
                                                    "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors",
                                                    loc === locale
                                                        ? "bg-pastel-yellow text-text-primary font-semibold"
                                                        : "text-text-secondary hover:bg-surface-100"
                                                )}
                                            >
                                                <Image
                                                    src={LOCALE_FLAGS[loc as Locale].flag}
                                                    alt={LOCALE_FLAGS[loc as Locale].label}
                                                    width={20}
                                                    height={20}
                                                    className="w-5 h-5 object-contain"
                                                />
                                                {LOCALE_FLAGS[loc as Locale].label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Hamburger (mobile) ─────────────────── */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="lg:hidden relative w-10 h-10 flex items-center justify-center rounded-full transition-colors active:bg-gray-100/50 ml-1 text-text-secondary"
                                aria-label="Toggle menu"
                            >
                                <div className="w-[20px] h-[20px] transition-transform duration-300">
                                    {isMobileMenuOpen ? <X className="w-full h-full" strokeWidth={1.5} /> : <Menu className="w-full h-full" strokeWidth={1.5} />}
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Mobile Menu ───────────────────────────────── */}
                {isMobileMenuOpen && (
                    <div className="lg:hidden bg-white border-t border-border-light">
                        <div className="max-w-[1400px] mx-auto px-4 py-3">
                            <ul className="flex flex-col gap-0.5">
                                {NAV_LINKS.map((link) => {
                                    if (link.route) {
                                        const isActive = pathname === link.route || pathname.startsWith(link.route + "/");
                                        return (
                                            <li key={link.route}>
                                                <button
                                                    onClick={() => {
                                                        setIsMobileMenuOpen(false);
                                                        router.push(link.route!);
                                                    }}
                                                    className={cn(
                                                        "w-full text-left block px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                                                        isActive
                                                            ? "bg-duck-yellow text-text-primary font-semibold"
                                                            : "text-text-secondary hover:bg-pastel-yellow hover:text-text-primary"
                                                    )}
                                                >
                                                    {link.label}
                                                </button>
                                            </li>
                                        );
                                    }
                                    return (
                                        <li key={link.href}>
                                            <button
                                                onClick={() => scrollTo(link.href!)}
                                                className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-pastel-yellow hover:text-text-primary transition-all"
                                            >
                                                {link.label}
                                            </button>
                                        </li>
                                    );
                                })}

                                {/* Mobile: Cart */}
                                <li>
                                    <button
                                        onClick={() => { setIsMobileMenuOpen(false); setCartOpen(true); }}
                                        className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-pastel-yellow hover:text-text-primary transition-all flex items-center gap-2"
                                    >
                                        <ShoppingCart className="h-4 w-4" />
                                        {t("cart")}
                                        {cartCount > 0 && (
                                            <span className="ml-auto min-w-[20px] h-5 px-1 rounded-full bg-duck-yellow text-xs font-bold flex items-center justify-center text-text-primary">
                                                {cartCount}
                                            </span>
                                        )}
                                    </button>
                                </li>

                                {/* Mobile: Auth */}
                                <li>
                                    {user ? (
                                        <div className="px-4 py-2">
                                            <p className="text-xs text-text-secondary mb-1.5">
                                                Đang đăng nhập: <strong>{user.displayName ?? user.email}</strong>
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setIsMobileMenuOpen(false); router.push(`/${locale}/orders`); }}
                                                    className="flex-1 py-1.5 text-xs font-semibold text-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                                                >
                                                    Đơn hàng
                                                </button>
                                                <button
                                                    onClick={() => { setIsMobileMenuOpen(false); handleSignOut(); }}
                                                    className="flex-1 py-1.5 text-xs font-semibold text-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                                >
                                                    Đăng xuất
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => { setIsMobileMenuOpen(false); router.push(`/${locale}/auth/login`); }}
                                            className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-pastel-yellow hover:text-text-primary transition-all"
                                        >
                                            {t("account")}
                                        </button>
                                    )}
                                </li>
                            </ul>
                        </div>
                    </div>
                )}
            </header>

            {/* ── Cart Drawer ───────────────────────────────── */}
            <CartDrawer
                isOpen={cartOpen}
                onClose={() => setCartOpen(false)}
                locale={locale}
            />
        </>
    );
}

/* ── Reusable icon button ─────────────────────────────────── */
function NavIconButton({
    children,
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all duration-300",
                "active:scale-95 group",
                className
            )}
            {...props}
        >
            <div className="w-[18px] h-[18px] text-text-secondary group-hover:text-text-primary transition-colors duration-300 flex items-center justify-center">
                {children}
            </div>
        </button>
    );
}
