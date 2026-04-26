"use client";

import { useState, useCallback, useEffect } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Loader2,
    Mail,
    Phone,
    User,
    Hash,
    Banknote,
    StickyNote,
    RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
    approveBankTransferOrder,
    cancelBankTransferOrder,
    updateTransferOrderNote,
} from "@/actions/admin/orders";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SerializedOrder {
    id: string;
    orderNumber: string;
    status: "pending" | "paid" | "cancelled";
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    items: {
        productName: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
    }[];
    finalAmount: number;
    discountAmount: number;
    paymentDetails?: {
        provider: string;
        providerData?: {
            qrDescription?: string;
            approvedBy?: string;
            note?: string;
        };
    };
    adminNotes?: string;
    expiresAt?: string;
    createdAt: string;
    paidAt?: string;
    cancelledAt?: string;
    cancelReason?: string;
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function formatTime(iso: string | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function isExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    return Date.now() > new Date(expiresAt).getTime();
}

function getTimeRemaining(expiresAt?: string): string {
    if (!expiresAt) return "";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Quá hạn";
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Live Countdown Hook ──────────────────────────────────────────────────────

function useCountdown(expiresAt?: string) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!expiresAt) return;
        // Don't tick if already expired
        const expMs = new Date(expiresAt).getTime();
        if (Date.now() > expMs) return;

        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [expiresAt]);

    const expired = expiresAt ? now > new Date(expiresAt).getTime() : false;
    const remaining = getTimeRemaining(expiresAt);

    return { expired, remaining };
}

// ─── Order Card ───────────────────────────────────────────────────────────────

function TransferOrderCard({
    order,
    onRefresh,
}: {
    order: SerializedOrder;
    onRefresh: () => void;
}) {
    const [loading, setLoading] = useState<"approve" | "cancel" | null>(null);
    const [error, setError] = useState("");
    const [note, setNote] = useState(order.adminNotes ?? "");
    const [noteSaving, setNoteSaving] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [showCancelDialog, setShowCancelDialog] = useState(false);

    const { expired, remaining } = useCountdown(order.expiresAt);
    const qrDesc = order.paymentDetails?.providerData?.qrDescription ?? "";

    const handleApprove = useCallback(async () => {
        setLoading("approve");
        setError("");
        const result = await approveBankTransferOrder(order.id, note || undefined);
        if (!result.success) {
            setError(result.error);
        }
        setLoading(null);
        onRefresh();
    }, [order.id, note, onRefresh]);

    const handleCancel = useCallback(async () => {
        setLoading("cancel");
        setError("");
        const result = await cancelBankTransferOrder(
            order.id,
            cancelReason || "Không nhận được thanh toán",
            note || undefined
        );
        if (!result.success) {
            setError(result.error);
        }
        setLoading(null);
        setShowCancelDialog(false);
        onRefresh();
    }, [order.id, cancelReason, note, onRefresh]);

    const handleSaveNote = useCallback(async () => {
        setNoteSaving(true);
        await updateTransferOrderNote(order.id, note);
        setNoteSaving(false);
    }, [order.id, note]);

    return (
        <div
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${order.status === "pending" && expired
                ? "border-red-200 shadow-red-50"
                : order.status === "pending"
                    ? "border-blue-200 shadow-blue-50"
                    : order.status === "paid"
                        ? "border-green-100"
                        : "border-gray-100"
                }`}
        >
            {/* Header */}
            <div className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-50">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${order.status === "paid"
                            ? "bg-green-50"
                            : order.status === "cancelled"
                                ? "bg-red-50"
                                : expired
                                    ? "bg-red-50"
                                    : "bg-blue-50"
                            }`}
                    >
                        {order.status === "paid" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : order.status === "cancelled" ? (
                            <XCircle className="h-5 w-5 text-red-400" />
                        ) : expired ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                            <Clock className="h-5 w-5 text-blue-500" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-800">
                                {order.orderNumber}
                            </p>
                            {order.status === "pending" && expired && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 uppercase">
                                    Quá hạn
                                </span>
                            )}
                            {order.status === "pending" && !expired && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 uppercase">
                                    Chờ duyệt
                                </span>
                            )}
                            {order.status === "paid" && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-600 uppercase">
                                    Đã duyệt
                                </span>
                            )}
                            {order.status === "cancelled" && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
                                    Đã hủy
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-400">{formatTime(order.createdAt)}</p>
                    </div>
                </div>

                <p className="text-base sm:text-lg font-bold text-[#0D47A1] sm:ml-auto">
                    {formatVND(order.finalAmount)}
                </p>
            </div>

            {/* Body */}
            <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-3 sm:space-y-4">
                {/* Customer Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-700">{order.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <a href={`mailto:${order.customerEmail}`} className="text-blue-600 hover:underline">
                            {order.customerEmail}
                        </a>
                    </div>
                    {order.customerPhone && (
                        <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-gray-400" />
                            <a href={`tel:${order.customerPhone}`} className="text-blue-600 hover:underline">
                                {order.customerPhone}
                            </a>
                        </div>
                    )}
                </div>

                {/* Transfer Description */}
                <div className="flex flex-wrap items-center gap-2 bg-blue-50 rounded-xl px-3 sm:px-4 py-2.5">
                    <Hash className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-500">Nội dung CK:</span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-[#0D47A1] break-all">{qrDesc}</span>
                </div>

                {/* Items */}
                <div className="text-sm space-y-1">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-gray-600">
                            <span>
                                {item.productName} × {item.quantity}
                            </span>
                            <span>{formatVND(item.subtotal)}</span>
                        </div>
                    ))}
                </div>

                {/* Timer for pending */}
                {order.status === "pending" && order.expiresAt && (
                    <div
                        className={`flex items-center gap-2 text-xs font-medium ${expired ? "text-red-500" : "text-blue-500"
                            }`}
                    >
                        <Clock className="h-3.5 w-3.5" />
                        {expired
                            ? `Quá hạn lúc ${formatTime(order.expiresAt)}`
                            : (
                                <>
                                    Còn <span className="font-mono tabular-nums">{remaining}</span> — Thời hạn thanh toán: {formatTime(order.expiresAt)}
                                </>
                            )}
                    </div>
                )}

                {/* Admin Notes */}
                {order.status === "pending" && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <StickyNote className="h-3.5 w-3.5" />
                            Ghi chú admin
                        </div>
                        <div className="flex gap-2">
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Ghi chú nội bộ..."
                                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                                rows={2}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveNote}
                                loading={noteSaving}
                                disabled={noteSaving}
                            >
                                Lưu
                            </Button>
                        </div>
                    </div>
                )}

                {/* Existing admin notes (readonly for non-pending) */}
                {order.status !== "pending" && order.adminNotes && (
                    <div className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2">
                        <StickyNote className="h-3 w-3 inline mr-1" />
                        {order.adminNotes}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        {error}
                    </p>
                )}

                {/* Actions */}
                {order.status === "pending" && (
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            className="flex-1 w-full sm:w-auto"
                            onClick={handleApprove}
                            loading={loading === "approve"}
                            disabled={!!loading}
                        >
                            <CheckCircle2 className="h-4 w-4" />
                            Duyệt đơn
                        </Button>

                        {expired && (
                            <>
                                {!showCancelDialog ? (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="md"
                                        onClick={() => setShowCancelDialog(true)}
                                        disabled={!!loading}
                                    >
                                        <XCircle className="h-4 w-4" />
                                        Hủy đơn
                                    </Button>
                                ) : (
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="text"
                                            value={cancelReason}
                                            onChange={(e) => setCancelReason(e.target.value)}
                                            placeholder="Lý do hủy (không bắt buộc)"
                                            className="w-full text-sm border border-red-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="flex-1 bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                                onClick={handleCancel}
                                                loading={loading === "cancel"}
                                                disabled={!!loading}
                                            >
                                                Xác nhận hủy
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowCancelDialog(false)}
                                            >
                                                Bỏ
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TransferOrdersClient({
    orders: initialOrders,
}: {
    orders: SerializedOrder[];
}) {
    const router = useRouter();
    const [filter, setFilter] = useState<"all" | "pending" | "paid" | "cancelled">("all");

    const filtered =
        filter === "all"
            ? initialOrders
            : initialOrders.filter((o) => o.status === filter);

    const pendingCount = initialOrders.filter((o) => o.status === "pending").length;
    const expiredCount = initialOrders.filter(
        (o) => o.status === "pending" && isExpired(o.expiresAt)
    ).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <Banknote className="h-6 w-6 sm:h-7 sm:w-7 text-blue-500" />
                        Duyệt đơn chuyển khoản
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {pendingCount} đơn chờ duyệt
                        {expiredCount > 0 && (
                            <span className="text-red-500 ml-1">
                                ({expiredCount} quá hạn)
                            </span>
                        )}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => router.refresh()}
                    className="self-start sm:self-auto"
                >
                    <RefreshCw className="h-4 w-4" />
                    Làm mới
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
                {(["all", "pending", "paid", "cancelled"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${filter === f
                            ? "bg-[#0D47A1] text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        {f === "all"
                            ? `Tất cả (${initialOrders.length})`
                            : f === "pending"
                                ? `Chờ duyệt (${pendingCount})`
                                : f === "paid"
                                    ? `Đã duyệt (${initialOrders.filter((o) => o.status === "paid").length})`
                                    : `Đã hủy (${initialOrders.filter((o) => o.status === "cancelled").length})`}
                    </button>
                ))}
            </div>

            {/* Order List */}
            <div className="space-y-4">
                {filtered.length === 0 && (
                    <div className="text-center py-16 text-gray-400">
                        <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="text-lg font-medium">Không có đơn hàng</p>
                        <p className="text-sm mt-1">Đơn chuyển khoản sẽ hiển thị tại đây</p>
                    </div>
                )}

                {filtered.map((order) => (
                    <TransferOrderCard
                        key={order.id}
                        order={order}
                        onRefresh={() => router.refresh()}
                    />
                ))}
            </div>
        </div>
    );
}
