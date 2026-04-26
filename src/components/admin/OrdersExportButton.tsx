"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface ExportOrder {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    items: { productName: string; quantity: number; unitPrice: number; subtotal: number }[];
    subtotal: number;
    discountAmount: number;
    finalAmount: number;
    status: string;
    paymentProvider?: string;
    createdAt: string; // ISO string
    paidAt?: string;   // ISO string
}

interface Props {
    orders: ExportOrder[];
    statusFilter: string;
}

const STATUS_LABELS: Record<string, string> = {
    paid: "Đã thanh toán",
    pending: "Chờ thanh toán",
    cancelled: "Đã hủy",
};

const PAYMENT_LABELS: Record<string, string> = {
    counter: "Tại quầy",
    bank_transfer: "Chuyển khoản",
    vnpay: "VNPay",
    mock: "Mock",
};

export function OrdersExportButton({ orders, statusFilter }: Props) {
    const [exporting, setExporting] = useState(false);

    async function handleExport() {
        if (exporting || orders.length === 0) return;
        setExporting(true);

        try {
            // Dynamic import — keeps xlsx out of initial bundle
            const XLSX = await import("xlsx").then((m) => m.default || m);

            // ── Build rows — 1 row per product item ──
            let stt = 0;
            const rows = orders.flatMap((o) =>
                o.items.map((item) => {
                    stt++;
                    return {
                        "STT": stt,
                        "Mã đơn hàng": o.orderNumber,
                        "Khách hàng": o.customerName,
                        "Email": o.customerEmail,
                        "SĐT": o.customerPhone || "",
                        "Sản phẩm": item.productName,
                        "Số lượng": item.quantity,
                        "Đơn giá": item.unitPrice,
                        "Thành tiền SP": item.subtotal,
                        "Tạm tính đơn": o.subtotal,
                        "Giảm giá đơn": o.discountAmount,
                        "Tổng đơn hàng": o.finalAmount,
                        "Trạng thái": STATUS_LABELS[o.status] || o.status,
                        "Phương thức": PAYMENT_LABELS[o.paymentProvider ?? ""] || o.paymentProvider || "",
                        "Ngày tạo": o.createdAt ? formatDateExcel(o.createdAt) : "",
                        "Ngày TT": o.paidAt ? formatDateExcel(o.paidAt) : "",
                    };
                })
            );

            const ws = XLSX.utils.json_to_sheet(rows);

            // ── Column widths ──
            ws["!cols"] = [
                { wch: 5 },   // STT
                { wch: 24 },  // Mã đơn
                { wch: 22 },  // Khách hàng
                { wch: 28 },  // Email
                { wch: 14 },  // SĐT
                { wch: 30 },  // Sản phẩm
                { wch: 10 },  // Số lượng
                { wch: 14 },  // Đơn giá
                { wch: 14 },  // Thành tiền SP
                { wch: 14 },  // Tạm tính đơn
                { wch: 12 },  // Giảm giá đơn
                { wch: 14 },  // Tổng đơn hàng
                { wch: 16 },  // Trạng thái
                { wch: 14 },  // Phương thức
                { wch: 18 },  // Ngày tạo
                { wch: 18 },  // Ngày TT
            ];

            const wb = XLSX.utils.book_new();
            const filterLabel = statusFilter
                ? (STATUS_LABELS[statusFilter] || statusFilter)
                : "Tất cả";
            XLSX.utils.book_append_sheet(wb, ws, filterLabel);

            // ── Generate filename with date ──
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const statusSuffix = statusFilter ? `_${statusFilter}` : "";
            const filename = `DonHang_BDuck_${today}${statusSuffix}.xlsx`;

            XLSX.writeFile(wb, filename);
        } catch (err) {
            console.error("[ExportExcel] Error:", err);
            alert("Không thể xuất Excel. Vui lòng thử lại.");
        } finally {
            setExporting(false);
        }
    }

    return (
        <button
            onClick={handleExport}
            disabled={exporting || orders.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
            {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Download className="h-3.5 w-3.5" />
            )}
            Xuất Excel ({orders.length})
        </button>
    );
}

function formatDateExcel(isoOrDate: string): string {
    try {
        const d = new Date(isoOrDate);
        if (isNaN(d.getTime())) return isoOrDate;
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, "0");
        const mi = String(d.getMinutes()).padStart(2, "0");
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    } catch {
        return isoOrDate;
    }
}
