"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SlidersHorizontal,
    X,
    Calendar,
    CreditCard,
    DollarSign,
    Package,
    RotateCcw,
    ChevronDown,
} from "lucide-react";

const PROVIDER_OPTIONS = [
    { value: "", label: "Tất cả" },
    { value: "bank_transfer", label: "🏦 Chuyển khoản" },
    { value: "counter", label: "🏪 Tại quầy" },
    { value: "vnpay", label: "💳 VNPay" },
    { value: "mock", label: "🧪 Mock" },
] as const;

interface Props {
    /** Current searchParams values for controlled inputs */
    currentFilters: {
        status?: string;
        q?: string;
        dateFrom?: string;
        dateTo?: string;
        provider?: string;
        amountMin?: string;
        amountMax?: string;
        productName?: string;
    };
}

export function OrdersAdvancedFilter({ currentFilters }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const hasActiveFilters = !!(
        currentFilters.dateFrom ||
        currentFilters.dateTo ||
        currentFilters.provider ||
        currentFilters.amountMin ||
        currentFilters.amountMax ||
        currentFilters.productName
    );

    const [open, setOpen] = useState(hasActiveFilters);

    // ── Build URL with new params ──
    const applyFilters = useCallback(
        (updates: Record<string, string>) => {
            const params = new URLSearchParams(searchParams.toString());

            // Remove cursor when filters change (reset pagination)
            params.delete("cursor");

            for (const [key, value] of Object.entries(updates)) {
                if (value) {
                    params.set(key, value);
                } else {
                    params.delete(key);
                }
            }

            router.push(`?${params.toString()}`);
        },
        [router, searchParams]
    );

    const resetFilters = useCallback(() => {
        const params = new URLSearchParams();
        // Keep only status and q
        if (currentFilters.status) params.set("status", currentFilters.status);
        if (currentFilters.q) params.set("q", currentFilters.q);
        router.push(`?${params.toString()}`);
    }, [router, currentFilters.status, currentFilters.q]);

    const activeFilterCount = [
        currentFilters.dateFrom || currentFilters.dateTo,
        currentFilters.provider,
        currentFilters.amountMin || currentFilters.amountMax,
        currentFilters.productName,
    ].filter(Boolean).length;

    return (
        <div className="relative">
            {/* Filter Panel */}
            <div className="mt-3 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 overflow-hidden animate-in slide-in-from-top-2 duration-200">

                {/* Filter Grid */}
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date Range */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <Calendar className="h-3 w-3" />
                            Từ ngày
                        </label>
                        <input
                            type="date"
                            value={currentFilters.dateFrom ?? ""}
                            onChange={(e) => applyFilters({ dateFrom: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#F5C842]/50 focus:border-[#F5C842] transition-all"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <Calendar className="h-3 w-3" />
                            Đến ngày
                        </label>
                        <input
                            type="date"
                            value={currentFilters.dateTo ?? ""}
                            onChange={(e) => applyFilters({ dateTo: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#F5C842]/50 focus:border-[#F5C842] transition-all"
                        />
                    </div>

                    {/* Payment Provider */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <CreditCard className="h-3 w-3" />
                            Phương thức TT
                        </label>
                        <select
                            value={currentFilters.provider ?? ""}
                            onChange={(e) => applyFilters({ provider: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] focus:outline-none focus:ring-2 focus:ring-[#F5C842]/50 focus:border-[#F5C842] transition-all appearance-none cursor-pointer"
                        >
                            {PROVIDER_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Product Name */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <Package className="h-3 w-3" />
                            Tên sản phẩm
                        </label>
                        <input
                            type="text"
                            value={currentFilters.productName ?? ""}
                            placeholder="VD: Vé vào cổng..."
                            onChange={(e) => applyFilters({ productName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F5C842]/50 focus:border-[#F5C842] transition-all"
                        />
                    </div>

                    {/* Amount Min */}
                    {/* <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <DollarSign className="h-3 w-3" />
                            Số tiền từ (VND)
                        </label>
                        <input
                            type="number"
                            min={0}
                            step={1000}
                            value={currentFilters.amountMin ?? ""}
                            placeholder="0"
                            onChange={(e) => applyFilters({ amountMin: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F5C842]/50 focus:border-[#F5C842] transition-all"
                        />
                    </div> */}

                    {/* Amount Max */}
                    {/* <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <DollarSign className="h-3 w-3" />
                            Số tiền đến (VND)
                        </label>
                        <input
                            type="number"
                            min={0}
                            step={1000}
                            value={currentFilters.amountMax ?? ""}
                            placeholder="∞"
                            onChange={(e) => applyFilters({ amountMax: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-[#1A1A2E] placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#F5C842]/50 focus:border-[#F5C842] transition-all"
                        />
                    </div> */}
                </div>

                {/* Active Filters Summary */}
                {hasActiveFilters && (
                    <div className="px-5 py-3 border-t border-gray-50 bg-[#FAFAFA] flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-gray-400 font-medium">Đang lọc:</span>
                        {currentFilters.dateFrom && (
                            <FilterTag
                                label={`Từ ${currentFilters.dateFrom}`}
                                onRemove={() => applyFilters({ dateFrom: "" })}
                            />
                        )}
                        {currentFilters.dateTo && (
                            <FilterTag
                                label={`Đến ${currentFilters.dateTo}`}
                                onRemove={() => applyFilters({ dateTo: "" })}
                            />
                        )}
                        {currentFilters.provider && (
                            <FilterTag
                                label={PROVIDER_OPTIONS.find((p) => p.value === currentFilters.provider)?.label ?? currentFilters.provider}
                                onRemove={() => applyFilters({ provider: "" })}
                            />
                        )}
                        {currentFilters.amountMin && (
                            <FilterTag
                                label={`≥ ${Number(currentFilters.amountMin).toLocaleString("vi-VN")}₫`}
                                onRemove={() => applyFilters({ amountMin: "" })}
                            />
                        )}
                        {currentFilters.amountMax && (
                            <FilterTag
                                label={`≤ ${Number(currentFilters.amountMax).toLocaleString("vi-VN")}₫`}
                                onRemove={() => applyFilters({ amountMax: "" })}
                            />
                        )}
                        {currentFilters.productName && (
                            <FilterTag
                                label={`SP: ${currentFilters.productName}`}
                                onRemove={() => applyFilters({ productName: "" })}
                            />
                        )}
                        {hasActiveFilters && (
                            <button
                                onClick={resetFilters}
                                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors"
                            >
                                <RotateCcw className="h-3 w-3" />
                                Xoá bộ lọc
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-[#1A1A2E] shadow-sm">
            {label}
            <button
                onClick={onRemove}
                className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors"
            >
                <X className="h-2.5 w-2.5" />
            </button>
        </span>
    );
}
