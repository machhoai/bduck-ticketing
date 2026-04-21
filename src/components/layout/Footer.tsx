"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import Link from "next/link";
import Image from "next/image";

export function Footer() {
    const t = useTranslations("footer");
    const pathname = usePathname();

    if (pathname.startsWith("/admin")) return null;

    const links = [
        { label: t("terms"), href: "/terms-of-service" },
        { label: t("privacy"), href: "/privacy-policy" },
        { label: t("contactUs"), href: "/tickets" },
    ];

    return (
        <footer className="bg-text-primary text-white/70 py-4">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Brand */}
                <div className="flex items-center gap-2.5">
                    <Image src="/images/avt_bduck-cityfuns.png" alt="B.Duck Cityfuns" width={40} height={40} className="rounded-2xl" />
                    <span className="font-[var(--font-heading)] font-bold text-white">
                        B.Duck Cityfuns
                    </span>
                </div>

                <p className="text-sm text-center">{t("copyright")}</p>

                {/* Links */}
                <div className="flex gap-4">
                    {links.map((link) => (
                        <Link
                            key={link.label}
                            href={link.href}
                            className="text-sm hover:text-duck-yellow transition-colors duration-200"
                        >
                            {link.label}
                        </Link>
                    ))}
                </div>
            </div>
        </footer>
    );
}
