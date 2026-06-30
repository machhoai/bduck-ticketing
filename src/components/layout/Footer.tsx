"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
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
                            <img
                                src="/images/avt_bduck-cityfuns.png"
                                alt="B.Duck Cityfuns Vietnam"
                                width={44}
                                height={44}
                                className="rounded-2xl ring-2 ring-white/10"
                            />
                            <div>
                                <p className="font-[var(--font-heading)] font-extrabold text-white text-base leading-tight">
                                    B.Duck Cityfuns Vietnam
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
                                    <img
                                        src="/images/facebook-logo.png"
                                        alt="Facebook"
                                        width={18}
                                        height={18}
                                        className="opacity-50 group-hover/social:opacity-100 transition-opacity duration-300"
                                    />
                                </a>

                                {/* Zalo */}
                                <a
                                    href="https://erp.joyworld.vn/r/zalo-group"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Zalo"
                                    className="group/social w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-[#FFD100]/15 hover:border-[#FFD100]/30 transition-all duration-300"
                                >
                                    <img
                                        src="/images/zalo-logo.png"
                                        alt="Zalo"
                                        width={18}
                                        height={18}
                                        className="opacity-50 group-hover/social:opacity-100 transition-opacity duration-300"
                                    />
                                </a>

                                {/* TikTok */}
                                <a
                                    href="https://erp.joyworld.vn/r/tiktok"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="TikTok"
                                    className="group/social w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center hover:bg-[#FFD100]/15 hover:border-[#FFD100]/30 transition-all duration-300"
                                >
                                    <img
                                        src="/images/tiktok-logo.png"
                                        alt="TikTok"
                                        width={18}
                                        height={18}
                                        className="opacity-50 group-hover/social:opacity-100 transition-opacity duration-300"
                                    />
                                </a>
                            </div>
                            <div className="relative w-full h-20 mt-2">
                                <a href="http://online.gov.vn/Home/WebDetails/142281" target="_blank" rel="noopener noreferrer">
                                    <img
                                        src="/20150827110756-dathongbao.png"
                                        alt="BCT Logo"
                                        width={150}
                                        height={100}
                                        className="object-contain"
                                    />
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
                                    {t("hqAddress").split("\n").map((line, i, arr) => (
                                        <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                                    ))}
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
                                    {t("storeName")}
                                </p>
                                <p className="text-[11px] text-white/45 leading-relaxed">
                                    {t("storeAddress").split("\n").map((line, i, arr) => (
                                        <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                                    ))}
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
                        {t("taxIdLabel")}: 0318958531{" | "}{t("address")}
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
