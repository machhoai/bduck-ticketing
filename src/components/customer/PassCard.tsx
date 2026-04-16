"use client";

import { QRCodeCanvas } from "qrcode.react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
    CheckCircle2,
    Clock,
    Calendar,
    Download,
    Ticket,
    User,
    Hash,
    Ban,
    AlertTriangle,
} from "lucide-react";

// ─── Serialized pass (timestamps already → ISO strings) ───────────────────────
export interface SerializedPass {
    id: string;
    orderId: string;
    orderNumber: string;
    customerId: string;
    customerName: string;
    customerEmail: string;
    productId: string;
    productName: string;
    productType: string;
    thumbnailUrl: string;
    validityType: string;
    status: string;
    comboItems?: { productName: string; quantity: number }[] | null;
    walletPassUrl?: string | null;
    affiliateId?: string | null;
    visitDate?: string;
    validFrom?: string;
    validUntil?: string;
    createdAt?: string;
    usedAt?: string;
}

interface PassCardProps {
    pass: SerializedPass;
    locale: string;
}

function formatDate(iso: string | undefined, locale: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

export function PassCard({ pass, locale }: PassCardProps) {
    const t = useTranslations("ticketWallet");

    const isActive = pass.status === "active";
    const isUsed = pass.status === "used";
    const isVoided = pass.status === "voided";
    const isExpired = pass.status === "expired";

    const qrValue = `BDUCK-PASS-${pass.id}`;

    // Status config
    type StatusCfg = { label: string; icon: React.ReactNode; bg: string; text: string; border: string };
    const statusCfg: StatusCfg = isActive
        ? { label: t("statusActive"), icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" }
        : isUsed
            ? { label: t("statusUsed"), icon: <CheckCircle2 className="h-3.5 w-3.5" />, bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" }
            : isVoided
                ? { label: t("statusVoided"), icon: <Ban className="h-3.5 w-3.5" />, bg: "bg-red-50", text: "text-red-600", border: "border-red-200" }
                : { label: t("statusExpired"), icon: <AlertTriangle className="h-3.5 w-3.5" />, bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" };

    return (
        <article className={`relative bg-white rounded-3xl overflow-hidden shadow-[0_8px_40px_-8px_rgba(0,0,0,0.12)] border-2 transition-all duration-300 ${isActive ? "border-[#F5C842]" : "border-gray-200"}`}>

            {/* ── Product Banner ─────────────────────────────────────── */}
            <div className="relative h-36 bg-[#1A1A2E] overflow-hidden">
                {pass.thumbnailUrl ? (
                    <Image
                        src={pass.thumbnailUrl}
                        alt={pass.productName}
                        fill
                        className={`object-cover transition-all duration-300 ${isActive ? "opacity-50" : "opacity-20"}`}
                    />
                ) : null}
                {/* Dark gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A2E] via-[#1A1A2E]/60 to-transparent" />

                {/* Product name */}
                <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">
                        B.Duck Cityfuns
                    </p>
                    <h2 className="text-white font-extrabold text-lg leading-tight line-clamp-2">
                        {pass.productName}
                    </h2>
                </div>

                {/* Status badge */}
                <div className={`absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                    {statusCfg.icon}
                    {statusCfg.label}
                </div>
            </div>

            {/* ── Perforated divider ────────────────────────────────── */}
            <div className="relative flex items-center px-5 py-1">
                <div className="absolute -left-3 w-6 h-6 rounded-full bg-gray-100" />
                <div className="flex-1 border-t-2 border-dashed border-gray-200" />
                <div className="absolute -right-3 w-6 h-6 rounded-full bg-gray-100" />
            </div>

            <div className="px-5 pb-5 space-y-5">
                {/* ── Validity Info ───────────────────────────────────── */}
                <div className="pt-2 flex flex-wrap gap-3">
                    {pass.validityType === "date-specific" && pass.visitDate && (
                        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-sm">
                            <Calendar className="h-4 w-4 text-amber-500 flex-shrink-0" />
                            <span className="text-amber-800">
                                <span className="text-xs text-amber-500 block leading-none">{t("visitDate")}</span>
                                <strong>{formatDate(pass.visitDate, locale)}</strong>
                            </span>
                        </div>
                    )}
                    {pass.validityType === "date-range" && (pass.validFrom || pass.validUntil) && (
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-sm">
                            <Clock className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            <span className="text-blue-800">
                                <span className="text-xs text-blue-500 block leading-none">{t("validFrom")} → {t("validUntil")}</span>
                                <strong>{formatDate(pass.validFrom, locale)} — {formatDate(pass.validUntil, locale)}</strong>
                            </span>
                        </div>
                    )}
                    {pass.validityType === "open-dated" && pass.validUntil && (
                        // Open-dated with N days from purchase — has a real expiry
                        <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-sm">
                            <Clock className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <span className="text-orange-800">
                                <span className="text-xs text-orange-500 block leading-none">{t("validUntil")}</span>
                                <strong>{formatDate(pass.validUntil, locale)}</strong>
                            </span>
                        </div>
                    )}
                    {pass.validityType === "open-dated" && !pass.validUntil && (
                        // Truly unlimited — no expiry at all
                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-emerald-800 font-medium">{t("openDated")}</span>
                        </div>
                    )}
                </div>

                {/* ── Combo Items ─────────────────────────────────────── */}
                {pass.comboItems && pass.comboItems.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            🎁 {t("comboIncludes")}
                        </p>
                        <ul className="space-y-1.5">
                            {pass.comboItems.map((item, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm text-amber-900">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#F5C842] flex-shrink-0" />
                                    <span className="flex-1">{item.productName}</span>
                                    <span className="font-bold">×{item.quantity}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* ── QR Code ─────────────────────────────────────────── */}
                <div className="flex flex-col items-center gap-3">
                    <div className={`p-4 rounded-2xl border-4 shadow-inner ${isActive
                            ? "border-[#F5C842] bg-white shadow-[#F5C842]/10"
                            : "border-gray-200 bg-gray-50"
                        }`}>
                        <QRCodeCanvas
                            value={qrValue}
                            size={192}
                            level="H"
                            includeMargin={false}
                            fgColor={isActive ? "#1A1A2E" : "#D1D5DB"}
                        />
                    </div>
                    <div className="text-center space-y-0.5">
                        <p className="text-[11px] text-gray-400 font-mono tracking-widest uppercase">
                            {pass.id.slice(-12).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500">{t("qrHint")}</p>
                    </div>
                </div>

                {/* ── Perforated divider ─────────────────────────────── */}
                <div className="relative flex items-center">
                    <div className="absolute -left-8 w-5 h-5 rounded-full bg-gray-100" />
                    <div className="flex-1 border-t-2 border-dashed border-gray-100" />
                    <div className="absolute -right-8 w-5 h-5 rounded-full bg-gray-100" />
                </div>

                {/* ── Customer Info ───────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                        <User className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t("ticketHolder")}</p>
                            <p className="font-semibold text-[#1A1A2E] text-xs">{pass.customerName}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <Hash className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t("orderRef")}</p>
                            <p className="font-semibold text-[#1A1A2E] text-xs font-mono">{pass.orderNumber}</p>
                        </div>
                    </div>
                </div>

                {/* ── Wallet Button ───────────────────────────────────── */}
                {pass.walletPassUrl && (
                    <a
                        href={pass.walletPassUrl}
                        className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
                    >
                        <Download className="h-4 w-4" />
                        {t("addToWallet")}
                    </a>
                )}
            </div>
        </article>
    );
}
