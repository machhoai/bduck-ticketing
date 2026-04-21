"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { Mail, MapPin, Clock, Phone, Building2, ShieldCheck } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface NavLink {
    readonly label: string;
    readonly href: string;
}

interface ContactItem {
    readonly icon: React.ReactNode;
    readonly label: string;
    readonly value: string;
    readonly href?: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const FooterHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/35 mb-5 flex items-center gap-2">
        <span className="w-4 h-px bg-gradient-to-r from-[#FFD100]/60 to-transparent" />
        {children}
    </h3>
);

const FooterLink: React.FC<NavLink> = ({ label, href }) => (
    <li>
        <Link
            href={href}
            className="group flex items-center gap-1.5 text-[13px] text-white/55 hover:text-[#FFD100] transition-colors duration-200"
        >
            <span className="w-1 h-1 rounded-full bg-white/20 group-hover:bg-[#FFD100]/70 transition-colors duration-200 flex-shrink-0" />
            {label}
        </Link>
    </li>
);

// ── Main Component ────────────────────────────────────────────────────────────

export const Footer: React.FC = () => {
    const t = useTranslations("footer");
    const pathname = usePathname();

    if (pathname.startsWith("/admin")) return null;

    const policies: NavLink[] = [
        { label: t("purchaseGuide"), href: "/huong-dan-mua-hang" },
        { label: t("deliveryPolicy"), href: "/chinh-sach-giao-hang" },
        { label: t("paymentMethods"), href: "/hinh-thuc-thanh-toan" },
        { label: t("returnPolicy"), href: "/chinh-sach-doi-tra" },
        { label: t("privacy"), href: "/privacy-policy" },
    ];

    const legal: NavLink[] = [
        { label: t("terms"), href: "/terms-of-service" },
    ];

    const contacts: ContactItem[] = [
        {
            icon: <Phone className="w-3.5 h-3.5 flex-shrink-0 text-[#FFD100]/70" />,
            label: t("phoneLabel"),
            value: "0969 271 737",
            href: "tel:+84969271737",
        },
        {
            icon: <Mail className="w-3.5 h-3.5 flex-shrink-0 text-[#FFD100]/70" />,
            label: t("emailLabel"),
            value: "ask@bduckcityfuns.com.vn",
            href: "mailto:ask@bduckcityfuns.com.vn",
        },
        {
            icon: <Clock className="w-3.5 h-3.5 flex-shrink-0 text-[#FFD100]/70" />,
            label: t("hoursLabel"),
            value: t("hours"),
        },
    ];

    return (
        <footer className="bg-[#12122A] text-white relative overflow-hidden">

            {/* Subtle decorative glow */}
            <div
                className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[2px]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,209,0,0.25), transparent)" }}
            />

            {/* ── Main body ── */}
            <div className="max-w-7xl mx-auto px-6 pt-12 pb-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

                    {/* ── Col 1: Brand ── */}
                    <div className="sm:col-span-2 lg:col-span-1 flex flex-col gap-5">
                        <div className="flex items-center gap-3">
                            <Image
                                src="/images/avt_bduck-cityfuns.png"
                                alt="B.Duck Cityfuns"
                                width={44}
                                height={44}
                                className="rounded-2xl ring-2 ring-white/10"
                            />
                            <div>
                                <p className="font-[var(--font-heading)] font-extrabold text-white text-base leading-tight">
                                    B.Duck Cityfuns
                                </p>
                                <p className="text-[10px] text-white/30 mt-0.5">Joy World Entertainment</p>
                            </div>
                        </div>

                        <p className="text-[12px] text-white/45 leading-relaxed">
                            {t("brandTagline")}
                        </p>

                        {/* Social media links */}
                        <div className="flex flex-col gap-3 mt-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
                                {t("socialHeading")}
                            </p>
                            <div className="flex items-center gap-2.5">
                                {/* Facebook */}
                                <a
                                    href="https://erp.joyworld.vn/r/facebook"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Facebook"
                                    className="group/social w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-[#FFD100]/15 hover:border-[#FFD100]/30 transition-all duration-300"
                                >
                                    <svg className="w-4 h-4 text-white/50 group-hover/social:text-[#FFD100] transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                    </svg>
                                </a>

                                {/* Zalo */}
                                <a
                                    href="https://erp.joyworld.vn/r/zalo-group"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Zalo"
                                    className="group/social w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-[#FFD100]/15 hover:border-[#FFD100]/30 transition-all duration-300"
                                >
                                    <svg className="w-4 h-4 text-white/50 group-hover/social:text-[#FFD100] transition-colors duration-300" viewBox="0 0 48 48" fill="currentColor">
                                        <path d="M12.5 6C8.91 6 6 8.91 6 12.5v23C6 39.09 8.91 42 12.5 42h23c3.59 0 6.5-2.91 6.5-6.5v-23C42 8.91 39.09 6 35.5 6h-23zm2.05 8h18.9c.28 0 .55.09.55.52 0 .86-1.28 2.5-1.73 3.08-.12.16-.24.17-.48.17H17.73c-.48 0-.73-.14-.73-.67 0-.76 1.2-2.34 1.65-2.84.14-.16.28-.26.52-.26h-.62zm-.55 7h12c.55 0 1 .45 1 1v9c0 .55-.45 1-1 1H18l-4 3v-3c-.55 0-1-.45-1-1v-9c0-.55.45-1 1-1zm14 1h6c.55 0 1 .45 1 1v7c0 .55-.45 1-1 1h-1v3l-3-3h-2c-.55 0-1-.45-1-1v-7c0-.55.45-1 1-1z" />
                                    </svg>
                                </a>

                                {/* TikTok */}
                                <a
                                    href="https://erp.joyworld.vn/r/tiktok"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="TikTok"
                                    className="group/social w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-[#FFD100]/15 hover:border-[#FFD100]/30 transition-all duration-300"
                                >
                                    <svg className="w-4 h-4 text-white/50 group-hover/social:text-[#FFD100] transition-colors duration-300" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.81.11v-3.51a6.27 6.27 0 0 0-.81-.05A6.34 6.34 0 0 0 3.16 15.2a6.34 6.34 0 0 0 6.33 6.33 6.34 6.34 0 0 0 6.33-6.33V8.86a8.27 8.27 0 0 0 4.84 1.56V6.97a4.84 4.84 0 0 1-1.07-.28z" />
                                    </svg>
                                </a>
                            </div>
                        </div>

                        {/* BCT compliance badge */}
                        {/* <div className="inline-flex items-center gap-2 self-start bg-gradient-to-r from-[#FFD100]/10 to-transparent border border-[#FFD100]/20 rounded-xl px-3 py-2">
                            <ShieldCheck className="w-4 h-4 text-[#FFD100]/70 flex-shrink-0" />
                            <span className="text-[10px] text-white/50 leading-tight">
                                {t("bctNote")}
                            </span>
                        </div> */}
                    </div>

                    {/* ── Col 2: Company info ── */}
                    <div className="flex flex-col gap-1">
                        <FooterHeading>{t("companyHeading")}</FooterHeading>

                        {/* Company name */}
                        <div className="mb-4">
                            <p className="text-[12px] font-semibold text-white/70 leading-snug flex items-start gap-2">
                                <Building2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#FFD100]/70" />
                                {t("companyName")}
                            </p>
                            <p className="text-[11px] text-white/35 ml-[22px] mt-0.5">
                                {t("companyNameEn")}
                            </p>
                        </div>

                        {/* Tax ID */}
                        <div className="bg-white/4 rounded-lg px-3 py-2 mb-4 border border-white/8">
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-0.5">{t("taxIdLabel")}</p>
                            <p className="text-[13px] font-mono font-semibold text-white/60">0318958531</p>
                        </div>

                        {/* HQ Address */}
                        <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#FFD100]/70" />
                            <div>
                                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{t("hqLabel")}</p>
                                <p className="text-[11px] text-white/50 leading-relaxed">
                                    154A Nguyễn Thị Thập, P. Tân Thuận,<br />TP. Hồ Chí Minh
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ── Col 3: Store & Contact ── */}
                    <div className="flex flex-col gap-1">
                        <FooterHeading>{t("storeHeading")}</FooterHeading>

                        {/* Store address */}
                        <div className="flex items-start gap-2 mb-5">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#FFD100]/70" />
                            <div>
                                <p className="text-[12px] font-semibold text-white/65 mb-1">
                                    B.Duck Cityfuns Landmark 81
                                </p>
                                <p className="text-[11px] text-white/45 leading-relaxed">
                                    720A Nguyễn Hữu Cảnh,<br />
                                    P. Thạnh Mỹ Tây (Mới), P. 22,<br />
                                    Q. Bình Thạnh, TP. HCM
                                </p>
                            </div>
                        </div>

                        {/* Contact items */}
                        <div className="flex flex-col gap-3">
                            {contacts.map((item) => (
                                <div key={item.value} className="flex items-start gap-2">
                                    {item.icon}
                                    <div>
                                        <p className="text-[10px] text-white/30 uppercase tracking-wider">{item.label}</p>
                                        {item.href ? (
                                            <a
                                                href={item.href}
                                                className="text-[12px] text-white/55 hover:text-[#FFD100] transition-colors duration-200 mt-0.5 block"
                                            >
                                                {item.value}
                                            </a>
                                        ) : (
                                            <p className="text-[12px] text-white/55 mt-0.5">{item.value}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Col 4: Policies ── */}
                    <div className="flex flex-col gap-1">
                        <FooterHeading>{t("policyHeading")}</FooterHeading>
                        <ul className="flex flex-col gap-2.5 mb-6">
                            {policies.map((link) => (
                                <FooterLink key={link.href} {...link} />
                            ))}
                        </ul>

                        <FooterHeading>{t("legalHeading")}</FooterHeading>
                        <ul className="flex flex-col gap-2.5">
                            {legal.map((link) => (
                                <FooterLink key={link.href} {...link} />
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* ── Copyright bar ── */}
            <div className="border-t border-white/8">
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                    <p className="text-[11px] text-white/25">{t("copyright")}</p>
                    <p className="text-[11px] text-white/18">
                        {t("taxIdLabel")}: 0318958531 &nbsp;|&nbsp; {t("address")}
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
