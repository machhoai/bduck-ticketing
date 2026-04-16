// Orders page — RSC with D8 security: session cookie verification
// Guest users must use emailed link with HMAC token (not this page)
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getMyOrders } from "@/actions/orders";
import Link from "next/link";
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
} from "lucide-react";
import type { Metadata } from "next";
import type { OrderDocument } from "@/types/firestore";
import { NavbarConfigurator } from "@/components/layout/NavbarConfigurator";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "orders" });
    return {
        title: `${t("pageTitle")} — B.Duck Cityfuns`,
        robots: "noindex",
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
    }).format(amount);
}

function formatDate(ts: { toDate(): Date }, locale: string): string {
    return ts.toDate().toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// ─── Status Config ────────────────────────────────────────────────────────────

type StatusKey = "paid" | "pending" | "cancelled";

interface StatusCfg {
    bgClass: string;
    textClass: string;
    borderClass: string;
    dotClass: string;
    icon: typeof CheckCircle2;
}

const STATUS_CFG: Record<StatusKey, StatusCfg> = {
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

// ─── Order Card ───────────────────────────────────────────────────────────────

async function OrderCard({
    order,
    locale,
    t,
}: {
    order: OrderDocument;
    locale: string;
    t: (key: string, values?: Record<string, string | number>) => string;
}) {
    const statusKey = (order.status as StatusKey) in STATUS_CFG
        ? (order.status as StatusKey)
        : "pending";
    const cfg = STATUS_CFG[statusKey];
    const StatusIcon = cfg.icon;
    const hasTickets = order.passIds.length > 0;
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);

    return (
        <article className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-[#F5C842]/40 transition-all duration-300 overflow-hidden">
            {/* Top accent bar — only for paid */}
            {order.status === "paid" && (
                <div className="h-1 w-full bg-gradient-to-r from-[#F5C842] to-amber-400" />
            )}

            <div className="p-5 sm:p-6">
                {/* ── Header row ──────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                                <Tag className="h-3 w-3" />
                                {t("orderCode")}
                            </span>
                        </div>
                        <p className="font-extrabold text-[#1A1A2E] text-base font-mono tracking-tight mt-0.5 truncate">
                            {order.orderNumber}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                            <CalendarDays className="h-3 w-3 flex-shrink-0" />
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            <span>{formatDate(order.createdAt as any, locale)}</span>
                        </div>
                    </div>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border flex-shrink-0 ${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
                        <StatusIcon className="h-3 w-3" />
                        {{
                            paid: t("statusPaid"),
                            pending: t("statusPending"),
                            cancelled: t("statusCancelled"),
                        }[order.status] ?? t("statusPending")}
                    </span>
                </div>

                {/* ── Items list ───────────────────────────────────── */}
                <div className="space-y-2 mb-4">
                    {order.items.slice(0, 3).map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-[#1A1A2E]/5 flex items-center justify-center">
                                    <Ticket className="h-3 w-3 text-[#1A1A2E]/50" />
                                </span>
                                <span className="text-gray-700 truncate">{item.productName}</span>
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
                            +{order.items.length - 3} more…
                        </p>
                    )}
                </div>

                {/* ── Footer row ───────────────────────────────────── */}
                <div className="flex items-center justify-between pt-4 border-t border-dashed border-gray-100">
                    <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t("total")}</p>
                        <p className="font-extrabold text-[#1A1A2E] text-lg">
                            {formatVND(order.finalAmount)}
                        </p>
                        {order.discountAmount > 0 && (
                            <p className="text-xs text-emerald-600 mt-0.5">
                                -{formatVND(order.discountAmount)} {order.promotionCode && `(${order.promotionCode})`}
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
}: {
    locale: string;
    t: (key: string) => string;
}) {
    return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            {/* Illustration */}
            <div className="relative mb-8">
                <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-[#F5C842]/20 to-amber-100 flex items-center justify-center shadow-inner">
                    <ShoppingBag className="h-12 w-12 text-[#F5C842]" />
                </div>
                <div className="absolute -top-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-md flex items-center justify-center">
                    <span className="text-xl">🎟️</span>
                </div>
            </div>

            <h2 className="text-xl font-extrabold text-[#1A1A2E] mb-2">
                {t("emptyTitle")}
            </h2>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed mb-8">
                {t("emptySubtitle")}
            </p>

            <Link
                href={`/${locale}/tickets`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-2xl text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-200/50"
            >
                <Ticket className="h-4 w-4" />
                {t("buyNow")}
            </Link>

            <p className="text-xs text-gray-400 mt-6 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {t("guestNote")}
            </p>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrdersPage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: "orders" });

    // D8: getMyOrders() reads session cookie server-side — never trusts client UID
    const orders = await getMyOrders();

    return (
        <main className="min-h-screen bg-gradient-to-b from-[#F8F6F0] to-white pt-20">
            <NavbarConfigurator solidBg={false} darkText shadow={false} />
            {/* ── Page header ─────────────────────────────────────── */}
            <div className="bg-white border-b max-w-3xl mx-auto rounded-2xl border-gray-100 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#1A1A2E] flex items-center justify-center shadow-lg flex-shrink-0">
                            <Package className="h-5 w-5 text-[#F5C842]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-[#1A1A2E] tracking-tight">
                                {t("pageTitle")}
                            </h1>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {t("pageSubtitle")}
                            </p>
                        </div>

                        {orders.length > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[2rem] h-8 px-2.5 rounded-full bg-[#F5C842] text-[#1A1A2E] text-sm font-extrabold shadow-sm">
                                {orders.length}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Content ─────────────────────────────────────────── */}
            <div className="max-w-3xl mx-auto py-8">
                {orders.length === 0 ? (
                    <EmptyState locale={locale} t={t} />
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <OrderCard
                                key={order.id}
                                order={order}
                                locale={locale}
                                t={t}
                            />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
