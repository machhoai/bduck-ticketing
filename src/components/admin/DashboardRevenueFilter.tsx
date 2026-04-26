"use client";

import { useState, useTransition, useCallback, useMemo, useEffect } from "react";
import { getDashboardStatsByRange, type RangeStats } from "@/actions/admin/dashboard";
import { DollarSign, ShoppingBag, Ticket, TrendingUp, Calendar, ChevronDown, ArrowRight } from "lucide-react";
import Link from "next/link";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatVND(v: number) {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B ₫`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M ₫`;
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}

function formatVNDFull(v: number) {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}

function toISO(date: Date): string {
    return date.toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
}

function formatDateVN(isoString: string) {
    return new Date(isoString).toLocaleDateString("vi-VN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        timeZone: "Asia/Ho_Chi_Minh",
    });
}

const STATUS_STYLE: Record<string, { label: string; style: string }> = {
    paid: { label: "Đã TT", style: "bg-emerald-50 text-emerald-600" },
    pending: { label: "Chờ TT", style: "bg-amber-50 text-amber-600" },
    cancelled: { label: "Đã hủy", style: "bg-red-50 text-red-500" },
};

type Preset = "today" | "week" | "month" | "quarter" | "custom";

interface PresetConfig { label: string; from: () => Date; to: () => Date }

const PRESETS: Record<Preset, PresetConfig> = {
    today: { label: "Hôm nay", from: () => new Date(), to: () => new Date() },
    week: { label: "7 ngày", from: () => { const d = new Date(); d.setDate(d.getDate() - 6); return d; }, to: () => new Date() },
    month: { label: "30 ngày", from: () => { const d = new Date(); d.setDate(d.getDate() - 29); return d; }, to: () => new Date() },
    quarter: { label: "3 tháng", from: () => { const d = new Date(); d.setDate(d.getDate() - 89); return d; }, to: () => new Date() },
    custom: { label: "Tùy chỉnh", from: () => new Date(), to: () => new Date() },
};


// ─── Mini sparkline bar chart ─────────────────────────────────────────────────
function RevenueChart({ data }: { data: Array<{ date: string; revenue: number; orders: number }> }) {
    const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
    const shown = data.length > 60 ? data.slice(-60) : data;

    return (
        <div className="flex items-end gap-0.5 h-20 w-full">
            {shown.map((d) => {
                const h = Math.max((d.revenue / maxRevenue) * 100, d.revenue > 0 ? 8 : 2);
                return (
                    <div
                        key={d.date}
                        className="group relative flex-1 flex items-end"
                        title={`${d.date}: ${formatVND(d.revenue)} / ${d.orders} đơn`}
                    >
                        <div
                            className={`w-full rounded-t transition-all duration-200 group-hover:brightness-110 ${d.revenue > 0 ? "bg-gradient-to-t from-[#F5C842] to-[#FF9500]" : "bg-gray-100"
                                }`}
                            style={{ height: `${h}%` }}
                        />
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                            {d.date.slice(5)}<br />
                            {formatVND(d.revenue)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Stat Mini Card ───────────────────────────────────────────────────────────
function RangeStat({
    label, value, icon: Icon, color, sub
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: "yellow" | "blue" | "emerald" | "purple";
    sub?: string;
}) {
    const colors = {
        yellow: "bg-[#FFF9E6] text-[#E68B00]",
        blue: "bg-blue-50 text-blue-600",
        emerald: "bg-emerald-50 text-emerald-600",
        purple: "bg-purple-50 text-purple-600",
    };
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                <div className={`p-2 rounded-xl ${colors[color]}`}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="text-2xl font-extrabold text-[#1A1A2E] tracking-tight">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

// ─── Main Client Component ────────────────────────────────────────────────────
interface DashboardRevenueFilterProps {
    pendingAffiliates: number;
    totalPassesIssued: number;
}

export function DashboardRevenueFilter({ pendingAffiliates, totalPassesIssued }: DashboardRevenueFilterProps) {
    const [preset, setPreset] = useState<Preset>("today");
    const [customFrom, setCustomFrom] = useState(toISO(new Date(Date.now() - 29 * 864e5)));
    const [customTo, setCustomTo] = useState(toISO(new Date()));
    const [showCustom, setShowCustom] = useState(false);
    const [stats, setStats] = useState<RangeStats | null>(null);
    const [isPending, startTransition] = useTransition();

    // Compute effective from/to for the current preset
    const [effectiveFrom, effectiveTo] = useMemo<[string, string]>(() => {
        if (preset === "custom") return [customFrom, customTo];
        const cfg = PRESETS[preset];
        return [toISO(cfg.from()), toISO(cfg.to())];
    }, [preset, customFrom, customTo]);

    const fetchStats = useCallback((from: string, to: string) => {
        startTransition(async () => {
            const data = await getDashboardStatsByRange(from, to);
            setStats(data);
        });
    }, [startTransition]);

    // ✅ Initial load — runs after mount, not during render
    useEffect(() => {
        fetchStats(effectiveFrom, effectiveTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally run once on mount only

    function handlePreset(p: Preset) {
        setPreset(p);
        setShowCustom(p === "custom");
        if (p !== "custom") {
            const cfg = PRESETS[p];
            fetchStats(toISO(cfg.from()), toISO(cfg.to()));
        }
    }

    function handleCustomApply() {
        fetchStats(customFrom, customTo);
    }


    return (
        <div className="space-y-5">
            {/* ── Date Range Picker ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>Doanh thu theo:</span>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                        {(["today", "week", "month", "quarter", "custom"] as Preset[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => handlePreset(p)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${preset === p
                                    ? "bg-[#1A1A2E] text-[#F5C842] shadow-sm"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                    }`}
                            >
                                {PRESETS[p].label}
                                {p === "custom" && <ChevronDown className="inline h-3 w-3 ml-0.5" />}
                            </button>
                        ))}
                    </div>

                    {preset !== "custom" && (
                        <span className="text-xs text-gray-400 font-mono ml-auto">
                            {effectiveFrom} → {effectiveTo}
                        </span>
                    )}
                </div>

                {/* Custom date range inputs */}
                {showCustom && (
                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-500">Từ:</label>
                            <input
                                type="date"
                                value={customFrom}
                                max={customTo}
                                onChange={(e) => setCustomFrom(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-gray-500">Đến:</label>
                            <input
                                type="date"
                                value={customTo}
                                min={customFrom}
                                max={toISO(new Date())}
                                onChange={(e) => setCustomTo(e.target.value)}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent"
                            />
                        </div>
                        <button
                            onClick={handleCustomApply}
                            disabled={isPending}
                            className="px-4 py-1.5 bg-[#F5C842] text-[#1A1A2E] font-bold text-sm rounded-xl hover:bg-[#F5C842]/90 disabled:opacity-50 transition-colors"
                        >
                            Áp dụng
                        </button>
                    </div>
                )}
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <RangeStat
                    label="Doanh thu"
                    value={isPending ? "..." : stats ? formatVND(stats.revenue) : "—"}
                    icon={DollarSign}
                    color="yellow"
                    sub={preset === "custom" ? `${customFrom} → ${customTo}` : PRESETS[preset].label}
                />
                <RangeStat
                    label="Đơn hàng"
                    value={isPending ? "..." : stats?.orders ?? "—"}
                    icon={ShoppingBag}
                    color="blue"
                    sub={stats && stats.orders > 0 ? `TB ${formatVND(stats.avgOrderValue)}/đơn` : undefined}
                />
                <RangeStat
                    label="Vé phát hành"
                    value={totalPassesIssued}
                    icon={Ticket}
                    color="emerald"
                    sub="Toàn thời gian"
                />
                <RangeStat
                    label="Affiliate chờ"
                    value={pendingAffiliates}
                    icon={TrendingUp}
                    color="purple"
                    sub="Chờ phê duyệt"
                />
            </div>

            {/* ── Revenue Chart ── */}
            {preset === "month" && stats && stats.dailyRevenue.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-bold text-[#1A1A2E] text-sm">Biểu đồ doanh thu</h3>
                            <p className="text-xs text-gray-400 mt-0.5">{stats.dailyRevenue.length} ngày</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400">Tổng</p>
                            <p className="font-extrabold text-[#1A1A2E]">{formatVND(stats.revenue)}</p>
                        </div>
                    </div>
                    {isPending ? (
                        <div className="h-20 bg-gray-50 rounded-xl animate-pulse" />
                    ) : (
                        <RevenueChart data={stats.dailyRevenue} />
                    )}
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
                        <span>{stats.dailyRevenue[0]?.date.slice(5)}</span>
                        <span>{stats.dailyRevenue[stats.dailyRevenue.length - 1]?.date.slice(5)}</span>
                    </div>
                </div>
            )}

            {/* ── Recent Orders (date-filtered) ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-[#1A1A2E]">
                        Đơn hàng gần nhất
                        {stats && <span className="text-xs text-gray-400 font-normal ml-2">({stats.recentOrders.length})</span>}
                    </h2>
                    <Link
                        href="admin/orders"
                        className="text-xs font-semibold text-gray-400 hover:text-[#1A1A2E] flex items-center gap-1 transition-colors"
                    >
                        Xem tất cả <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    {isPending ? (
                        <div className="space-y-2 p-6">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                                    <tr>
                                        {["Mã đơn", "Khách hàng", "Tổng tiền", "Trạng thái", "Ngày"].map((h) => (
                                            <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {stats?.recentOrders.map((order) => {
                                        const st = STATUS_STYLE[order.status] ?? STATUS_STYLE.pending;
                                        return (
                                            <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">
                                                    <Link href={`admin/orders/${order.id}`} className="hover:text-[#1A1A2E] transition-colors">
                                                        {order.orderNumber}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-[#1A1A2E]">{order.customerName}</td>
                                                <td className="px-4 py-3 font-semibold">{formatVNDFull(order.finalAmount)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.style}`}>
                                                        {st.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-400">{formatDateVN(order.createdAt)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {(!stats || stats.recentOrders.length === 0) && (
                                <div className="text-center py-12 text-gray-400">Chưa có đơn hàng nào trong khoảng thời gian này</div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
