"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { User, ShoppingCart, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Locale, routing } from "@/i18n/routing";

/* ── Flag data ────────────────────────────────────────────────── */
const LOCALE_FLAGS: Record<Locale, { flag: string; label: string }> = {
    vi: { flag: "🇻🇳", label: "Tiếng Việt" },
    en: { flag: "🇬🇧", label: "English" },
};

export function Navbar() {
    const t = useTranslations("nav");
    const locale = useLocale() as Locale;
    const pathname = usePathname();
    const router = useRouter();

    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [cartCount] = useState(0);

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close lang dropdown on outside click
    useEffect(() => {
        if (!isLangOpen) return;
        const close = () => setIsLangOpen(false);
        document.addEventListener("click", close);
        return () => document.removeEventListener("click", close);
    }, [isLangOpen]);

    const NAV_LINKS = [
        { label: t("home"), href: "#home" },
        { label: t("products"), href: "#tickets" },
        { label: t("introduction"), href: "#attractions" },
        { label: t("about"), href: "#about" },
        { label: t("contact"), href: "#contact" },
    ];

    const scrollTo = (href: string) => {
        setIsMobileMenuOpen(false);
        const id = href.replace("#", "");
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 60;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    };

    const switchLocale = (newLocale: Locale) => {
        // Remove current locale prefix and prepend new one
        const pathWithoutLocale = pathname.replace(/^\/(vi|en)/, "") || "/";
        const newPath =
            newLocale === routing.defaultLocale
                ? pathWithoutLocale
                : `/${newLocale}${pathWithoutLocale}`;
        router.push(newPath);
        setIsLangOpen(false);
    };

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-none"
            )}
        >
            {/* ── Main Bar ────────────────────────────────────── */}
            <div className=" mx-auto px-4 lg:px-8 flex items-center justify-between h-[52px]">
                {/* Left: Dual Logos */}
                <div className="flex items-center gap-3 shrink-0">
                    {/* Logo 1 — Funland wordmark */}
                    <Image
                        src="/images/logo-bduck-cityfuns.png"
                        alt="B.Duck Funland"
                        width={120}
                        height={40}
                        className="h-[40px] w-auto object-contain"
                        priority
                    />

                    {/* Divider */}
                    <div className="w-px h-6 bg-border-light" />

                    {/* Logo 2 — B.Duck brand */}
                    <Image
                        src="/images/logo-bduck-official.png"
                        alt="B.Duck™"
                        width={90}
                        height={30}
                        className="h-[30px] w-auto object-contain"
                        priority
                    />
                </div>

                {/* Center: Nav Links — desktop only */}
                <div className="flex items-center gap-2">
                    <nav className="hidden lg:flex items-center gap-1 bg-white px-4 h-9 rounded-full border border-border-light">
                        {NAV_LINKS.map((link) => (
                            <button
                                key={link.href}
                                onClick={() => scrollTo(link.href)}
                                className={cn(
                                    "px-4 py-1.5 rounded-full text-[13px] font-medium cursor-pointer",
                                    "text-text-secondary hover:text-text-primary",
                                    "transition-colors duration-200",
                                    "hover:bg-surface-100"
                                )}
                            >
                                {link.label}
                            </button>
                        ))}
                    </nav>

                    {/* Right: Icons */}
                    <div className="flex items-center gap-2">
                        {/* Account */}
                        <NavIconButton aria-label={t("account")}>
                            <User className="w-full h-full" />
                        </NavIconButton>

                        {/* Cart */}
                        <NavIconButton aria-label={t("cart")} className="relative">
                            <ShoppingCart className="w-full h-full" />
                            {cartCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-duck-yellow text-[0.6rem] font-bold flex items-center justify-center text-text-primary">
                                    {cartCount}
                                </span>
                            )}
                        </NavIconButton>

                        {/* Language Switcher */}
                        <div className="relative">
                            <NavIconButton
                                aria-label={t("language")}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsLangOpen(!isLangOpen);
                                }}
                            >
                                <span className="text-base leading-none">
                                    {LOCALE_FLAGS[locale].flag}
                                </span>
                            </NavIconButton>

                            {/* Dropdown */}
                            {isLangOpen && (
                                <div className="absolute right-0 top-full mt-1 py-1 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-border-light min-w-[140px] animate-slide-down z-50">
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
                                            <span className="text-base">
                                                {LOCALE_FLAGS[loc as Locale].flag}
                                            </span>
                                            {LOCALE_FLAGS[loc as Locale].label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Hamburger — mobile only */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-surface-100 transition-colors ml-1"
                            aria-label="Toggle menu"
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-full h-full" />
                            ) : (
                                <Menu className="w-full h-full" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Mobile Menu ─────────────────────────────────── */}
            {isMobileMenuOpen && (
                <div className="lg:hidden bg-white border-t border-border-light animate-slide-down">
                    <div className="max-w-[1400px] mx-auto px-4 py-3">
                        <ul className="flex flex-col gap-0.5">
                            {NAV_LINKS.map((link) => (
                                <li key={link.href}>
                                    <button
                                        onClick={() => scrollTo(link.href)}
                                        className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-pastel-yellow hover:text-text-primary transition-all"
                                    >
                                        {link.label}
                                    </button>
                                </li>
                            ))}
                            <li>
                                <button
                                    onClick={() => scrollTo("#dashboard")}
                                    className="w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-pastel-yellow hover:text-text-primary transition-all"
                                >
                                    {t("myTickets")}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </header>
    );
}

/* ── Reusable icon button ─────────────────────────────────────── */
function NavIconButton({
    children,
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            className={cn(
                "w-9 h-9 cursor-pointer bg-white border border-border-light p-2 flex items-center justify-center rounded-full",
                "text-text-secondary hover:text-text-primary hover:bg-surface-100",
                "transition-all duration-200",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
