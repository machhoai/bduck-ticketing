"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useTranslations } from "next-intl";
import {
    Package,
    ChevronRight,
    Ticket,
    ShoppingBag,
    CheckCircle2,
    Clock,
    XCircle,
    Mail,
    CalendarDays,
    Tag,
    Store,
    QrCode,
    WifiOff,
    Banknote,
    ExternalLink,
} from "lucide-react";

// ─── Serialized Order Type (plain JS, no Timestamps) ──────────────────────────

export interface SerializedOrder {
    id: string;
    status: string;
    orderNumber: string;
    items: {
        productName: string;
        productType: string;
        thumbnailUrl: string;
        quantity: number;
        subtotal: number;
    }[];
    finalAmount: number;
    discountAmount: number;
    promotionCode?: string;
    passIds: string[];
    createdAt: string; // ISO
    orderCode?: string;
    paymentProvider?: string;
    expiresAt?: string | null; // ISO
}

// ─── LocalStorage Schema ───────────────────────────────────────────────────────

interface CachedCounterOrder {
    id: string;
    orderCode: string;
    orderNumber: string;
    finalAmount: number;
    items: { productName: string; quantity: number; subtotal: number }[];
    expiresAt: string | null;
    cachedAt: string; // ISO
}

const STORAGE_KEY = "bduck:counter_orders:v1";
// Grace period: keep in cache up to 1h after expiry (user may still need to see it)
const CACHE_GRACE_MS = 3_600_000;

function saveToCache(orders: SerializedOrder[]) {
    try {
        const toCache: CachedCounterOrder[] = orders
            .filter(
                (o) =>
                    o.status === "pending" &&
                    o.paymentProvider === "counter" &&
                    o.orderCode
            )
            .map((o) => ({
                id: o.id,
                orderCode: o.orderCode!,
                orderNumber: o.orderNumber,
                finalAmount: o.finalAmount,
                items: o.items.map((i) => ({
                    productName: i.productName,
                    quantity: i.quantity,
                    subtotal: i.subtotal,
                })),
                expiresAt: o.expiresAt ?? null,
                cachedAt: new Date().toISOString(),
            }));
        if (toCache.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toCache));
        }
    } catch {
        // Storage might be unavailable (private mode, quota exceeded, etc.)
    }
}

function loadFromCache(): CachedCounterOrder[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as CachedCounterOrder[];
        // Filter out orders past grace period
        return parsed.filter((o) => {
            if (!o.expiresAt) return true;
            return (
                new Date(o.expiresAt).getTime() + CACHE_GRACE_MS > Date.now()
            );
        });
    } catch {
        return [];
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function formatDate(iso: string, locale: string): string {
    return new Date(iso).toLocaleDateString(
        locale === "vi" ? "vi-VN" : "en-US",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }
    );
}

// ─── Status Config ────────────────────────────────────────────────────────────

type StatusKey = "paid" | "pending" | "cancelled";

const STATUS_CFG: Record<
    StatusKey,
    {
        bgClass: string;
        textClass: string;
        borderClass: string;
        dotClass: string;
        icon: typeof CheckCircle2;
    }
> = {
    paid: {
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
        dotClass: "bg-emerald-500",
        icon: CheckCircle2,
    },
    pending: {
        bgClass: "bg-amber-50",
        textClass: "text-amber-700",
        borderClass: "border-amber-200",
        dotClass: "bg-amber-500",
        icon: Clock,
    },
    cancelled: {
        bgClass: "bg-red-50",
        textClass: "text-red-700",
        borderClass: "border-red-200",
        dotClass: "bg-red-500",
        icon: XCircle,
    },
};

// ─── Countdown Timer ──────────────────────────────────────────────────────────

function Countdown({ expiresAt }: { expiresAt: string | null | undefined }) {
    const [timeLeft, setTimeLeft] = useState("");
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!expiresAt) return;
        const target = new Date(expiresAt).getTime();

        const tick = () => {
            const diff = target - Date.now();
            if (diff <= 0) {
                setIsExpired(true);
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
        const id = setInterval(tick, 1_000);
        return () => clearInterval(id);
    }, [expiresAt]);

    if (!timeLeft) return null;

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-colors ${
                isExpired
                    ? "bg-red-100 text-red-600"
                    : "bg-amber-100 text-amber-800"
            }`}
        >
            <Clock className="h-3 w-3" />
            {timeLeft}
        </div>
    );
}

// ─── Counter Order Card (with inline QR) ─────────────────────────────────────

function CounterOrderCard({
    order,
    locale,
    t,
}: {
    order: SerializedOrder;
    locale: string;
    t: (key: string, values?: Record<string, string | number>) => string;
}) {
    const isExpired = order.expiresAt
        ? new Date(order.expiresAt).getTime() < Date.now()
        : false;

    return (
        <article
            className={`bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
                isExpired
                    ? "border-gray-100 opacity-70"
                    : "border-amber-200/70 shadow-[0_2px_20px_-4px_rgba(245,200,66,0.15)] hover:border-amber-300 hover:shadow-[0_4px_28px_-6px_rgba(245,200,66,0.25)]"
            }`}
        >
            {/* Accent bar */}
            {!isExpired && (
                <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
            )}

            <div className="p-5 sm:p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-5">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            <Store className="h-3 w-3" />
                            {t("orderCode")}
                        </div>
                        <p className="font-extrabold text-[#1A1A2E] text-sm font-mono tracking-tight truncate">
                            {order.orderNumber}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                            <CalendarDays className="h-3 w-3" />
                            <span>{formatDate(order.createdAt, locale)}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                isExpired
                                    ? "bg-red-50 text-red-600 border-red-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                            }`}
                        >
                            <span
                                className={`w-1.5 h-1.5 rounded-full ${isExpired ? "bg-red-500" : "bg-amber-400 animate-pulse"}`}
                            />
                            {isExpired
                                ? t("counterExpiredShort")
                                : t("statusCounterPending")}
                        </span>
                        {!isExpired && (
                            <Countdown expiresAt={order.expiresAt} />
                        )}
                    </div>
                </div>

                {/* Body: [items + total] | [QR] */}
                <div className="flex flex-col sm:flex-row gap-6">
                    {/* Left: items */}
                    <div className="flex-1 min-w-0 space-y-4">
                        <div className="space-y-2">
                            {order.items.slice(0, 4).map((item, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between gap-3 text-sm"
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-[#1A1A2E]/5 flex items-center justify-center">
                                            <Ticket className="h-3 w-3 text-[#1A1A2E]/40" />
                                        </span>
                                        <span className="text-gray-700 truncate">
                                            {item.productName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">
                                            {t("qty", { qty: item.quantity })}
                                        </span>
                                        <span className="text-xs font-semibold text-gray-800">
                                            {formatVND(item.subtotal)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {order.items.length > 4 && (
                                <p className="text-xs text-gray-400 pl-7">
                                    +{order.items.length - 4} more&hellip;
                                </p>
                            )}
                        </div>

                        {/* Total */}
                        <div className="pt-3 border-t border-dashed border-gray-100">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">
                                {t("total")}
                            </p>
                            <div className="flex items-center gap-2">
                                <Banknote className="h-4 w-4 text-amber-500" />
                                <p className="font-extrabold text-[#1A1A2E] text-lg">
                                    {formatVND(order.finalAmount)}
                                </p>
                            </div>
                        </div>

                        {/* Link to full-screen QR */}
                        {!isExpired && (
                            <Link
                                href={`/${locale}/checkout/result?orderId=${order.id}`}
                                className="inline-flex items-center gap-1.5 text-xs text-amber-700 hover:text-amber-900 font-semibold transition-colors group"
                            >
                                <ExternalLink className="h-3 w-3 group-hover:scale-110 transition-transform" />
                                {t("viewFullQr")}
                            </Link>
                        )}
                    </div>

                    {/* Divider (desktop) */}
                    <div className="hidden sm:block self-stretch w-px border-l border-dashed border-amber-100" />

                    {/* Right: QR Code */}
                    <div className="flex flex-col items-center gap-2.5">
                        {!isExpired && order.orderCode ? (
                            <>
                                {/* QR frame */}
                                <div className="relative">
                                    <div className="p-3 bg-white rounded-xl shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_3px_12px_-3px_rgba(0,0,0,0.12)]">
                                        <QRCodeSVG
                                            value={order.orderCode}
                                            size={140}
                                            level="H"
                                            bgColor="#FFFFFF"
                                            fgColor="#1A1A2E"
                                            includeMargin={false}
                                        />
                                    </div>
                                    {/* Corner brackets */}
                                    {(
                                        [
                                            "top-0 left-0 border-t-[2.5px] border-l-[2.5px] rounded-tl-lg",
                                            "top-0 right-0 border-t-[2.5px] border-r-[2.5px] rounded-tr-lg",
                                            "bottom-0 left-0 border-b-[2.5px] border-l-[2.5px] rounded-bl-lg",
                                            "bottom-0 right-0 border-b-[2.5px] border-r-[2.5px] rounded-br-lg",
                                        ] as const
                                    ).map((cls, i) => (
                                        <div
                                            key={i}
                                            className={`absolute ${cls} w-5 h-5 border-[#F5C842]`}
                                        />
                                    ))}
                                </div>

                                {/* Order code badge */}
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                                    <QrCode className="h-3 w-3 text-gray-400" />
                                    <span className="font-mono font-extrabold text-sm tracking-[0.15em] text-[#1A1A2E]">
                                        {order.orderCode}
                                    </span>
                                </div>

                                <p className="text-[10px] text-gray-400 text-center max-w-[150px] leading-relaxed">
                                    {t("qrScanHint")}
                                </p>
                            </>
                        ) : (
                            /* Expired placeholder */
                            <div className="w-[166px] h-[166px] rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
                                <XCircle className="h-8 w-8 text-gray-200" />
                                <p className="text-xs text-gray-400 text-center px-4 leading-relaxed">
                                    {t("qrExpiredHint")}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}

// ─── Regular Order Card ───────────────────────────────────────────────────────

function RegularOrderCard({
    order,
    locale,
    t,
}: {
    order: SerializedOrder;
    locale: string;
    t: (key: string, values?: Record<string, string | number>) => string;
}) {
    const statusKey =
        (order.status as StatusKey) in STATUS_CFG
            ? (order.status as StatusKey)
            : "pending";
    const cfg = STATUS_CFG[statusKey];
    const StatusIcon = cfg.icon;
    const hasTickets = order.passIds.length > 0;
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

    return (
        <article className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-[#F5C842]/40 transition-all duration-300 overflow-hidden">
            {order.status === "paid" && (
                <div className="h-1 w-full bg-gradient-to-r from-[#F5C842] to-amber-400" />
            )}

            <div className="p-5 sm:p-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                            <Tag className="h-3 w-3" />
                            {t("orderCode")}
                        </div>
                        <p className="font-extrabold text-[#1A1A2E] text-base font-mono tracking-tight mt-0.5 truncate">
                            {order.orderNumber}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                            <CalendarDays className="h-3 w-3 flex-shrink-0" />
                            <span>{formatDate(order.createdAt, locale)}</span>
                        </div>
                    </div>
                    <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border flex-shrink-0 ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}
                    >
                        <span
                            className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`}
                        />
                        <StatusIcon className="h-3 w-3" />
                        {
                            {
                                paid: t("statusPaid"),
                                pending: t("statusPending"),
                                cancelled: t("statusCancelled"),
                            }[order.status] ?? t("statusPending")
                        }
                    </span>
                </div>

                {/* Items */}
                <div className="space-y-2 mb-4">
                    {order.items.slice(0, 3).map((item, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between gap-3 text-sm"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-[#1A1A2E]/5 flex items-center justify-center">
                                    <Ticket className="h-3 w-3 text-[#1A1A2E]/50" />
                                </span>
                                <span className="text-gray-700 truncate">
                                    {item.productName}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-md">
                                    {t("qty", { qty: item.quantity })}
                                </span>
                                <span className="text-gray-900 font-semibold text-xs">
                                    {formatVND(item.subtotal)}
                                </span>
                            </div>
                        </div>
                    ))}
                    {order.items.length > 3 && (
                        <p className="text-xs text-gray-400 pl-7">
                            +{order.items.length - 3} more&hellip;
                        </p>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-dashed border-gray-100">
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                            {t("total")}
                        </p>
                        <p className="font-extrabold text-[#1A1A2E] text-lg">
                            {formatVND(order.finalAmount)}
                        </p>
                        {order.discountAmount > 0 && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                                -{formatVND(order.discountAmount)}{" "}
                                {order.promotionCode &&
                                    `(${order.promotionCode})`}
                            </p>
                        )}
                    </div>
                    {hasTickets && (
                        <Link
                            href={`/${locale}/tickets-wallet/${order.passIds[0]}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1A1A2E] text-white text-sm font-bold hover:bg-[#F5C842] hover:text-[#1A1A2E] transition-all duration-200 group-hover:scale-[1.02]"
                        >
                            <Ticket className="h-3.5 w-3.5" />
                            {itemCount > 1 ? t("viewTickets") : t("viewTicket")}
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </div>
            </div>
        </article>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
    locale,
    t,
    isOffline,
}: {
    locale: string;
    t: (key: string) => string;
    isOffline: boolean;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="relative mb-8">
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#F5C842]/20 to-amber-100 flex items-center justify-center shadow-inner">
                    {isOffline ? (
                        <WifiOff className="h-12 w-12 text-gray-300" />
                    ) : (
                        <ShoppingBag className="h-12 w-12 text-[#F5C842]" />
                    )}
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-md flex items-center justify-center">
                    <span className="text-xl">🎟️</span>
                </div>
            </div>

            <h2 className="text-xl font-extrabold text-[#1A1A2E] mb-2">
                {isOffline ? t("offlineEmptyTitle") : t("emptyTitle")}
            </h2>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed mb-8">
                {isOffline ? t("offlineEmptySubtitle") : t("emptySubtitle")}
            </p>

            {!isOffline && (
                <Link
                    href={`/${locale}/tickets`}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-2xl text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-200/50"
                >
                    <Ticket className="h-4 w-4" />
                    {t("buyNow")}
                </Link>
            )}

            <p className="text-xs text-gray-400 mt-6 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t("guestNote")}
            </p>
        </div>
    );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export function OrdersClient({
    initialOrders,
    locale,
}: {
    initialOrders: SerializedOrder[];
    locale: string;
}) {
    const t = useTranslations("orders");
    const [isOffline, setIsOffline] = useState(false);
    const [offlineOrders, setOfflineOrders] = useState<SerializedOrder[]>([]);

    useEffect(() => {
        // 1. Detect current state
        const offline = !navigator.onLine;
        setIsOffline(offline);

        // 2. Always save current server data to localStorage (if we have any)
        if (initialOrders.length > 0) {
            saveToCache(initialOrders);
        }

        // 3. Load cache for offline fallback
        if (offline) {
            const cached = loadFromCache();
            const asOrders: SerializedOrder[] = cached.map((c) => ({
                id: c.id,
                status: "pending",
                orderNumber: c.orderNumber,
                items: c.items.map((i) => ({
                    ...i,
                    productType: "ticket",
                    thumbnailUrl: "",
                })),
                finalAmount: c.finalAmount,
                discountAmount: 0,
                passIds: [],
                createdAt: c.cachedAt,
                orderCode: c.orderCode,
                paymentProvider: "counter",
                expiresAt: c.expiresAt,
            }));
            setOfflineOrders(asOrders);
        }

        // 4. Listen for connectivity changes
        const handleOnline = () => {
            setIsOffline(false);
            setOfflineOrders([]);
        };
        const handleOffline = () => {
            setIsOffline(true);
            const cached = loadFromCache();
            const asOrders: SerializedOrder[] = cached.map((c) => ({
                id: c.id,
                status: "pending",
                orderNumber: c.orderNumber,
                items: c.items.map((i) => ({
                    ...i,
                    productType: "ticket",
                    thumbnailUrl: "",
                })),
                finalAmount: c.finalAmount,
                discountAmount: 0,
                passIds: [],
                createdAt: c.cachedAt,
                orderCode: c.orderCode,
                paymentProvider: "counter",
                expiresAt: c.expiresAt,
            }));
            setOfflineOrders(asOrders);
        };
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [initialOrders]);

    // Which orders to render
    const ordersToShow = isOffline ? offlineOrders : initialOrders;

    // Split into counter (QR) vs regular
    const counterOrders = ordersToShow.filter(
        (o) => o.status === "pending" && o.paymentProvider === "counter"
    );
    const regularOrders = ordersToShow.filter(
        (o) => !(o.status === "pending" && o.paymentProvider === "counter")
    );

    return (
        <div className="space-y-5">
            {/* Offline banner */}
            {isOffline && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200 animate-[fadeSlideUp_0.3s_ease-out]">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <WifiOff className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-amber-800">
                            {t("offlineTitle")}
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">
                            {t("offlineSubtitle")}
                        </p>
                    </div>
                </div>
            )}

            {ordersToShow.length === 0 ? (
                <EmptyState locale={locale} t={t} isOffline={isOffline} />
            ) : (
                <div className="space-y-4">
                    {/* Counter QR orders always first */}
                    {counterOrders.map((order) => (
                        <CounterOrderCard
                            key={order.id}
                            order={order}
                            locale={locale}
                            t={t}
                        />
                    ))}

                    {/* Regular orders */}
                    {regularOrders.map((order) => (
                        <RegularOrderCard
                            key={order.id}
                            order={order}
                            locale={locale}
                            t={t}
                        />
                    ))}
                </div>
            )}

            <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
}
