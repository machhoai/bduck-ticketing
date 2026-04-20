"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import { useNavbar } from "@/stores/navbar";
import { CheckoutProgressBar } from "@/components/customer/CheckoutProgressBar";
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Mail,
    RefreshCw,
    Home,
    ShoppingBag,
    AlertCircle,
    Ticket,
    Smartphone,
    Hash,
    User,
    Calendar,
    CreditCard,
    Sparkles,
    Store,
    Clock,
    Banknote,
    ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItemData {
    productName: string;
    productType: string;
    thumbnailUrl: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

interface PassValidity {
    passId: string;
    validityType: string;
    visitDate?: string;
    validFrom?: string;
    validUntil?: string;
}

interface CheckoutResultClientProps {
    orderId: string;
    locale: string;
    initialStatus: string | null;
    initialPassIds: string[];
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    items: OrderItemData[];
    finalAmount: number;
    discountAmount: number;
    passes: PassValidity[];
    /** Counter payment — short QR code string e.g. "BDK-A3F9X2" */
    orderCode?: string;
    /** "counter" | "mock" | etc. */
    paymentProvider?: string;
    /** ISO string — 24h counter order expiry */
    expiresAt?: string;
}

function formatVND(amount: number) {
    return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function formatDate(iso: string | undefined, locale: string): string {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(
        locale === "vi" ? "vi-VN" : "en-US",
        { day: "2-digit", month: "short", year: "numeric" }
    );
}

function getValidityLabel(
    pass: PassValidity | undefined,
    locale: string,
    t: (key: string) => string
): string {
    if (!pass) return t("statusValid");
    switch (pass.validityType) {
        case "date-specific":
            return pass.visitDate
                ? formatDate(pass.visitDate, locale)
                : t("statusValid");
        case "date-range": {
            const from = formatDate(pass.validFrom, locale);
            const until = formatDate(pass.validUntil, locale);
            if (from && until) return `${from} → ${until}`;
            if (until) return `${locale === "vi" ? "HSD" : "Exp"}: ${until}`;
            return t("statusValid");
        }
        case "open-dated": {
            // Has a real expiry (e.g. validDaysFromPurchase = 30)
            if (pass.validUntil) {
                const until = formatDate(pass.validUntil, locale);
                return `${locale === "vi" ? "HSD" : "Exp"}: ${until}`;
            }
            // Truly unlimited
            return locale === "vi" ? "Không thời hạn" : "No expiry";
        }
        default:
            return t("statusValid");
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function CheckoutResultClient({
    orderId,
    locale,
    initialStatus,
    initialPassIds,
    orderNumber,
    customerEmail,
    customerName,
    items,
    finalAmount,
    discountAmount,
    passes,
    orderCode,
    paymentProvider,
    expiresAt,
}: CheckoutResultClientProps) {
    const t = useTranslations("checkout");

    useNavbar({ darkText: true, shadow: false, solidBg: true });

    const [status, setStatus] = useState<string | null>(initialStatus);
    const [passIds, setPassIds] = useState<string[]>(initialPassIds);
    const [timedOut, setTimedOut] = useState(false);
    const [resendStatus, setResendStatus] = useState<
        "idle" | "sending" | "success"
    >("idle");
    const [resendCounterStatus, setResendCounterStatus] = useState<
        "idle" | "sending" | "success"
    >("idle");

    // ─── Live countdown for counter orders ───────────────────────────────────────
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        if (!expiresAt || paymentProvider !== "counter") return;
        const target = new Date(expiresAt).getTime();

        const tick = () => {
            const diff = target - Date.now();
            if (diff <= 0) {
                setExpired(true);
                setTimeLeft("00:00:00");
                return;
            }
            const h = Math.floor(diff / 3_600_000);
            const m = Math.floor((diff % 3_600_000) / 60_000);
            const s = Math.floor((diff % 60_000) / 1_000);
            setTimeLeft(
                `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
            );
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [expiresAt, paymentProvider]);

    const startTime = useRef(Date.now());
    const MAX_POLL_MS = 30_000;

    // ── Polling for pending orders — only for online payment, NOT counter ──────
    useEffect(() => {
        // Counter orders wait for admin confirmation — no point polling here
        if (paymentProvider === "counter") return;
        if (!orderId || status !== "pending") return;

        const interval = setInterval(async () => {
            if (Date.now() - startTime.current > MAX_POLL_MS) {
                clearInterval(interval);
                setTimedOut(true);
                return;
            }

            try {
                const res = await fetch(
                    `/api/order-status?orderId=${encodeURIComponent(orderId)}`,
                    { cache: "no-store" }
                );
                if (!res.ok) return;

                const data = await res.json();

                if (data.status === "paid") {
                    clearInterval(interval);
                    setStatus("paid");
                    setPassIds(data.passIds ?? []);
                } else if (data.status === "cancelled") {
                    clearInterval(interval);
                    setStatus("failed");
                }
            } catch {
                // Network error — continue polling
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [orderId, status]);

    // ── Resend email handler ────────────────────────────────────────────────────
    const handleResendEmail = useCallback(async () => {
        if (resendStatus === "sending" || !orderId) return;
        setResendStatus("sending");
        try {
            const res = await fetch("/api/resend-ticket-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId }),
            });
            if (res.ok) {
                setResendStatus("success");
            } else {
                setResendStatus("idle");
            }
        } catch {
            setResendStatus("idle");
        }
        setTimeout(() => setResendStatus("idle"), 4000);
    }, [resendStatus, orderId]);

    // ── Resend counter order email ──────────────────────────────────────────────
    const handleResendCounterEmail = useCallback(async () => {
        if (resendCounterStatus === "sending" || !orderId) return;
        setResendCounterStatus("sending");
        try {
            const res = await fetch("/api/resend-counter-email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId }),
            });
            setResendCounterStatus(res.ok ? "success" : "idle");
        } catch {
            setResendCounterStatus("idle");
        }
        setTimeout(() => setResendCounterStatus("idle"), 4_000);
    }, [resendCounterStatus, orderId]);

    // QR base URL
    const qrBaseUrl =
        typeof window !== "undefined"
            ? `${window.location.origin}/${locale}/tickets-wallet/`
            : `/${locale}/tickets-wallet/`;

    // ── No orderId ──────────────────────────────────────────────────────────────
    if (!orderId) {
        return (
            <ResultShell locale={locale}>
                <StatusCard
                    icon={<XCircle className="h-10 w-10 text-red-400" />}
                    bg="bg-red-50"
                    title={t("orderNotFound")}
                >
                    <Link href={`/${locale}`}>
                        <Button variant="secondary" size="md">
                            <Home className="h-4 w-4" />
                            {t("backToHome")}
                        </Button>
                    </Link>
                </StatusCard>
            </ResultShell>
        );
    }

    // ── Counter Payment Pending ─────────────────────────────────────────────────
    // Show QR code + amount + countdown instead of a spinner
    if (paymentProvider === "counter" && status === "pending") {
        return (
            <ResultShell locale={locale}>
                <div className="space-y-6 animate-[fadeSlideUp_0.5s_ease-out]">
                    {/* Header */}
                    <div className="relative overflow-hidden bg-gradient-to-br from-[#1A1A2E] via-[#16213E] to-[#0F3460] rounded-3xl p-8 text-white text-center">
                        {/* Subtle animated dots */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {[...Array(8)].map((_, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full animate-[float_4s_ease-in-out_infinite]"
                                    style={{
                                        width: `${4 + (i % 3) * 4}px`,
                                        height: `${4 + (i % 3) * 4}px`,
                                        background: `hsla(45, 90%, 70%, 0.15)`,
                                        top: `${10 + i * 11}%`,
                                        left: `${8 + i * 11}%`,
                                        animationDelay: `${i * 0.5}s`,
                                    }}
                                />
                            ))}
                        </div>
                        <div className="relative z-10 space-y-3">
                            <div className="w-16 h-16 mx-auto rounded-full bg-[#F5C842]/20 backdrop-blur-sm flex items-center justify-center ring-2 ring-[#F5C842]/30">
                                <Store className="h-8 w-8 text-[#F5C842]" />
                            </div>
                            <h1 className="text-2xl font-extrabold">
                                {t("counterPendingTitle")}
                            </h1>
                            <p className="text-sm text-white/70">
                                {t("counterPendingSubtitle")}
                            </p>
                        </div>
                    </div>

                    {/* QR Code card */}
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_32px_-8px_rgba(0,0,0,0.10)] overflow-hidden">
                        {/* Top: Amount to pay */}
                        <div className="px-6 py-5 bg-gradient-to-r from-[#F5C842]/10 to-amber-50 border-b border-amber-100/60 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#F5C842]/20 flex items-center justify-center">
                                    <Banknote className="h-5 w-5 text-[#C49B00]" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">{t("counterAmountLabel")}</p>
                                    <p className="text-2xl font-black text-[#1A1A2E]">
                                        {new Intl.NumberFormat("vi-VN").format(finalAmount)} ₫
                                    </p>
                                </div>
                            </div>
                            {/* Countdown */}
                            {timeLeft && (
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold font-mono ${
                                    expired
                                        ? "bg-red-100 text-red-600"
                                        : "bg-amber-100 text-amber-800"
                                }`}>
                                    <Clock className="h-3.5 w-3.5" />
                                    {timeLeft}
                                </div>
                            )}
                        </div>

                        {/* Center: QR */}
                        <div className="px-6 py-8 flex flex-col items-center gap-5">
                            <div className="relative">
                                <div className="p-4 bg-white rounded-2xl shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_16px_-4px_rgba(0,0,0,0.12)]">
                                    <QRCodeSVG
                                        value={orderCode ?? orderId}
                                        size={200}
                                        level="H"
                                        bgColor="#FFFFFF"
                                        fgColor="#1A1A2E"
                                        includeMargin={false}
                                    />
                                </div>
                                {/* Scanner corner indicators */}
                                {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
                                    <div
                                        key={i}
                                        className={`absolute ${pos} w-6 h-6 border-[#F5C842] ${
                                            i === 0 ? "border-t-[3px] border-l-[3px] rounded-tl-lg" :
                                            i === 1 ? "border-t-[3px] border-r-[3px] rounded-tr-lg" :
                                            i === 2 ? "border-b-[3px] border-l-[3px] rounded-bl-lg" :
                                                      "border-b-[3px] border-r-[3px] rounded-br-lg"
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Order code badge */}
                            {orderCode && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
                                    <Hash className="h-4 w-4 text-gray-400" />
                                    <span className="font-mono font-bold text-xl tracking-[0.2em] text-[#1A1A2E]">
                                        {orderCode}
                                    </span>
                                </div>
                            )}

                            <p className="text-xs text-gray-400 text-center max-w-[240px]">
                                {t("counterQrHint")}
                            </p>
                        </div>

                        {/* Bottom: Items summary */}
                        <div className="px-6 pb-6 space-y-2">
                            <div className="w-full border-t border-dashed border-gray-200 mb-4" />
                            <div className="flex items-center gap-2 mb-3">
                                <ClipboardList className="h-4 w-4 text-gray-400" />
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("counterItemsLabel")}</p>
                            </div>
                            {items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-700">{item.productName} × {item.quantity}</span>
                                    <span className="font-semibold text-[#1A1A2E]">{new Intl.NumberFormat("vi-VN").format(item.subtotal)} ₫</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] p-5 space-y-4">
                        <h3 className="text-sm font-bold text-[#1A1A2E]">{t("counterStepsTitle")}</h3>
                        {(["counterStep1", "counterStep2", "counterStep3"] as const).map((key, i) => (
                            <div key={key} className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-[#F5C842]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-bold text-[#C49B00]">{i + 1}</span>
                                </div>
                                <p className="text-sm text-gray-600">{t(key)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Expiry warning */}
                    {expired && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-700 font-medium">{t("counterExpired")}</p>
                        </div>
                    )}

                    {/* Resend email */}
                    {!expired && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] p-5 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                                    <Mail className="h-5 w-5 text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-[#1A1A2E]">{t("counterEmailSent")}</p>
                                    <p className="text-xs text-gray-400 truncate">{customerEmail}</p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleResendCounterEmail}
                                disabled={resendCounterStatus === "sending"}
                                className="w-full"
                            >
                                {resendCounterStatus === "sending" ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        {t("resending")}
                                    </>
                                ) : resendCounterStatus === "success" ? (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        {t("resendSuccess")}
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        {t("resendEmail")}
                                    </>
                                )}
                            </Button>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex gap-3 justify-center">
                        <Link href={`/${locale}/orders`}>
                            <Button variant="secondary" size="md">
                                <ShoppingBag className="h-4 w-4" />
                                {t("viewOrders")}
                            </Button>
                        </Link>
                        <Link href={`/${locale}`}>
                            <Button variant="ghost" size="md">
                                <Home className="h-4 w-4" />
                                {t("backToHome")}
                            </Button>
                        </Link>
                    </div>
                </div>
            </ResultShell>
        );
    }

    // ── Online Pending (spinner) ─────────────────────────────────────────────────
    if (status === "pending" && !timedOut) {
        return (
            <ResultShell locale={locale}>
                <div className="flex flex-col items-center gap-6 py-16 animate-[fadeSlideUp_0.5s_ease-out]">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#F5C842] to-[#E5B832] flex items-center justify-center shadow-xl shadow-[#F5C842]/30 animate-pulse">
                            <Loader2 className="h-8 w-8 text-[#1A1A2E] animate-spin" />
                        </div>
                        <div className="absolute -inset-3 rounded-full border-2 border-[#F5C842]/30 animate-ping" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-xl font-bold text-[#1A1A2E]">{t("resultPending")}</h1>
                        <p className="text-sm text-gray-500 mt-2">{t("resultPendingDesc")}</p>
                    </div>
                    {/* Skeleton ticket preview */}
                    <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
                        <div className="h-4 bg-gray-100 rounded-full w-3/4 animate-pulse" />
                        <div className="h-32 bg-gray-50 rounded-xl animate-pulse" />
                        <div className="h-3 bg-gray-100 rounded-full w-1/2 mx-auto animate-pulse" />
                    </div>
                </div>
            </ResultShell>
        );
    }

    // ── Timeout fallback ────────────────────────────────────────────────────────
    if (timedOut) {
        return (
            <ResultShell locale={locale}>
                <StatusCard
                    icon={<AlertCircle className="h-10 w-10 text-amber-500" />}
                    bg="bg-amber-50"
                    title={t("resultTimeout")}
                    description={t("resultTimeoutDesc")}
                >
                    <div className="flex gap-3">
                        <Link href={`/${locale}/orders`}>
                            <Button variant="secondary" size="md">
                                <ShoppingBag className="h-4 w-4" />
                                {t("checkOrders")}
                            </Button>
                        </Link>
                        <Link href={`/${locale}`}>
                            <Button variant="ghost" size="md">
                                <Home className="h-4 w-4" />
                                {t("backToHome")}
                            </Button>
                        </Link>
                    </div>
                </StatusCard>
            </ResultShell>
        );
    }

    // ── Failed ──────────────────────────────────────────────────────────────────
    if (status === "failed") {
        return (
            <ResultShell locale={locale}>
                <StatusCard
                    icon={<XCircle className="h-10 w-10 text-red-400" />}
                    bg="bg-red-50"
                    title={t("resultFailed")}
                    description={t("resultFailedDesc")}
                >
                    <Link href={`/${locale}/checkout`}>
                        <Button variant="primary" size="lg">
                            {t("tryAgain")}
                        </Button>
                    </Link>
                </StatusCard>
            </ResultShell>
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SUCCESS — Premium ticket display
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <ResultShell locale={locale}>
            <div className="space-y-8 animate-[fadeSlideUp_0.5s_ease-out]">
                {/* ── Celebration header ────────────────────────────────────────── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-400 rounded-3xl p-8 text-white text-center">
                    {/* Confetti dots */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(12)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute rounded-full animate-[float_3s_ease-in-out_infinite]"
                                style={{
                                    width: `${6 + Math.random() * 8}px`,
                                    height: `${6 + Math.random() * 8}px`,
                                    background: `hsla(${60 + i * 30}, 80%, 80%, 0.3)`,
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${i * 0.3}s`,
                                }}
                            />
                        ))}
                    </div>

                    <div className="relative z-10 space-y-3">
                        <div className="w-16 h-16 mx-auto rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                            <CheckCircle2 className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-extrabold">
                            🎉 {t("resultSuccess")}
                        </h1>
                        <p className="text-emerald-100 text-sm">{t("resultSuccessDesc")}</p>
                    </div>
                </div>

                {/* ── Order details card ────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.06)] overflow-hidden">
                    {/* Order header */}
                    <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#F5C842]/15 flex items-center justify-center">
                                    <Hash className="h-4 w-4 text-[#E5B832]" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                                        {t("orderCode")}
                                    </p>
                                    <p className="text-sm font-bold text-[#1A1A2E] font-mono">
                                        {orderNumber || orderId.slice(0, 12).toUpperCase()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {t("resultSuccess").replace("!", "")}
                            </div>
                        </div>
                    </div>

                    {/* Customer & payment info */}
                    <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm border-b border-gray-50">
                        <div className="flex items-start gap-2.5">
                            <User className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400">{t("customerLabel")}</p>
                                <p className="font-medium text-[#1A1A2E]">{customerName || "—"}</p>
                                <p className="text-xs text-gray-500">{customerEmail || "—"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <CreditCard className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-400">{t("paymentLabel")}</p>
                                <p className="font-bold text-[#1A1A2E]">{formatVND(finalAmount)}</p>
                                {discountAmount > 0 && (
                                    <p className="text-xs text-emerald-600">-{formatVND(discountAmount)}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Items */}
                    <div className="px-6 py-4 space-y-3">
                        {items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                                {item.thumbnailUrl ? (
                                    <img
                                        src={item.thumbnailUrl}
                                        alt={item.productName}
                                        className="w-11 h-11 rounded-xl object-cover flex-shrink-0 ring-1 ring-gray-100"
                                    />
                                ) : (
                                    <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        <Ticket className="h-5 w-5 text-gray-300" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#1A1A2E] line-clamp-1">
                                        {item.productName}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {item.productType === "combo" ? t("comboLabel") : t("ticketLabel")} × {item.quantity}
                                    </p>
                                </div>
                                <span className="text-sm font-semibold text-[#1A1A2E] flex-shrink-0">
                                    {formatVND(item.subtotal)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── QR Tickets ───────────────────────────────────────────────── */}
                {passIds.length > 0 && (
                    <div className="space-y-5">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-[#1A1A2E] uppercase tracking-wider">
                            <Sparkles className="h-4 w-4 text-[#F5C842]" />
                            {t("yourTickets")} — {passIds.length} {passIds.length > 1 ? "vé" : "vé"}
                        </h2>

                        <div className="space-y-4">
                            {passIds.map((passId, index) => {
                                // Match passId to an item (distribute across items by quantity)
                                let matchedItem = items[0];
                                let accumulated = 0;
                                for (const item of items) {
                                    accumulated += item.quantity;
                                    if (index < accumulated) {
                                        matchedItem = item;
                                        break;
                                    }
                                }

                                return (
                                    <div
                                        key={passId}
                                        className="relative bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_-6px_rgba(0,0,0,0.08)] overflow-hidden animate-[fadeSlideUp_0.4s_ease-out] hover:shadow-xl transition-shadow duration-300"
                                        style={{ animationDelay: `${index * 120}ms`, animationFillMode: "both" }}
                                    >
                                        {/* Ticket perforated edge effect */}
                                        <div className="absolute left-0 top-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#F0F2F5]" />
                                        <div className="absolute right-0 top-1/2 translate-x-1/2 w-6 h-6 rounded-full bg-[#F0F2F5]" />

                                        <div className="flex flex-col sm:flex-row">
                                            {/* Left: Product info */}
                                            <div className="flex-1 p-5 sm:pr-3 space-y-3">
                                                <div className="flex items-center gap-3">
                                                    {matchedItem?.thumbnailUrl ? (
                                                        <img
                                                            src={matchedItem.thumbnailUrl}
                                                            alt={matchedItem.productName}
                                                            className="w-12 h-12 rounded-xl object-cover ring-1 ring-gray-100"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#F5C842]/20 to-[#F5C842]/5 flex items-center justify-center">
                                                            <Ticket className="h-6 w-6 text-[#E5B832]" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-[#1A1A2E] text-sm line-clamp-1">
                                                            {matchedItem?.productName || t("ticketLabel")}
                                                        </p>
                                                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                                                            #{passId.slice(-8).toUpperCase()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Meta pills */}
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[11px] font-semibold">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {t("statusActive")}
                                                    </span>
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-[11px] font-semibold">
                                                        <Calendar className="h-3 w-3" />
                                                        {getValidityLabel(passes.find((p) => p.passId === passId), locale, t)}
                                                    </span>
                                                    {matchedItem?.productType === "combo" && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-[11px] font-semibold">
                                                            🎁 {t("comboLabel")}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="text-xs text-gray-400">
                                                    {t("scanQR")}
                                                </p>

                                                <Link href={`/${locale}/tickets-wallet/${passId}`} className="block">
                                                    <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                                                        <Ticket className="h-3.5 w-3.5" />
                                                        {t("viewTicket")}
                                                    </Button>
                                                </Link>
                                            </div>

                                            {/* Right: QR Code */}
                                            <div className="flex items-center justify-center p-5 sm:pl-3 sm:border-l sm:border-dashed sm:border-gray-200">
                                                <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-inner">
                                                    <QRCodeSVG
                                                        value={`${qrBaseUrl}${passId}`}
                                                        size={128}
                                                        level="H"
                                                        bgColor="#FFFFFF"
                                                        fgColor="#1A1A2E"
                                                        includeMargin={false}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Screenshot tip */}
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100/80">
                            <Smartphone className="h-5 w-5 text-amber-600 flex-shrink-0" />
                            <p className="text-xs text-amber-800 font-medium">{t("screenshotTip")}</p>
                        </div>
                    </div>
                )}

                {/* ── Email confirmation ────────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_16px_-4px_rgba(0,0,0,0.06)] p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                            <Mail className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-[#1A1A2E]">{t("emailSent")}</p>
                            <p className="text-xs text-gray-500">
                                {t("emailSentTo", { email: customerEmail || "your-email@example.com" })}
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleResendEmail}
                        disabled={resendStatus === "sending"}
                        className="w-full"
                    >
                        {resendStatus === "sending" ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                {t("resending")}
                            </>
                        ) : resendStatus === "success" ? (
                            <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                {t("resendSuccess")}
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-3.5 w-3.5" />
                                {t("resendEmail")}
                            </>
                        )}
                    </Button>
                </div>

                {/* ── Navigation ───────────────────────────────────────────────── */}
                <div className="flex gap-3 justify-center pt-2">
                    <Link href={`/${locale}/orders`}>
                        <Button variant="secondary" size="md">
                            <ShoppingBag className="h-4 w-4" />
                            {t("viewOrders")}
                        </Button>
                    </Link>
                    <Link href={`/${locale}`}>
                        <Button variant="ghost" size="md">
                            <Home className="h-4 w-4" />
                            {t("backToHome")}
                        </Button>
                    </Link>
                </div>
            </div>

            <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-10px) scale(1.1); opacity: 0.5; }
        }
      `}</style>
        </ResultShell>
    );
}

// ─── Reusable status card for error/timeout states ────────────────────────────
function StatusCard({
    icon,
    bg,
    title,
    description,
    children,
}: {
    icon: React.ReactNode;
    bg: string;
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center gap-6 py-12 animate-[fadeSlideUp_0.5s_ease-out]">
            <div className={`w-20 h-20 rounded-full ${bg} flex items-center justify-center`}>
                {icon}
            </div>
            <div className="text-center max-w-sm">
                <h1 className="text-xl font-bold text-[#1A1A2E]">{title}</h1>
                {description && <p className="text-sm text-gray-500 mt-2">{description}</p>}
            </div>
            {children}
        </div>
    );
}

// ─── Shell wrapper with progress bar + decorative bg ──────────────────────────
function ResultShell({
    locale,
    children,
}: {
    locale: string;
    children: React.ReactNode;
}) {
    const t = useTranslations("checkout");

    return (
        <>
            {/* Decorative Background */}
            <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-yellow-100/40 via-orange-50/30 to-transparent blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-50/40 via-purple-50/20 to-transparent blur-3xl" />
            </div>

            <main className="min-h-screen pt-[100px] pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl mx-auto">
                    {/* Progress bar */}
                    <div className="mb-10">
                        <CheckoutProgressBar
                            currentStep={3}
                            labels={[t("step1"), t("step2"), t("step3")]}
                        />
                    </div>

                    {children}
                </div>
            </main>
        </>
    );
}
