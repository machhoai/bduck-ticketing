"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useTranslations } from "next-intl";

export interface VoucherDisplayProps {
    id: string;
    code: string;
    templateName: string;
    status: string;
    voucherType: string;
}

export function VoucherQRCard({ voucher }: { voucher: VoucherDisplayProps }) {
    const t = useTranslations("checkout");
    const isActive = voucher.status === "active";
    const isPending = voucher.status === "pending";
    const isRedeemed = voucher.status === "redeemed";
    const hasRealCode = voucher.code && !voucher.code.startsWith("PENDING");

    const statusLabel = isActive
        ? `✓ ${t("voucherStatusActive")}`
        : isRedeemed
        ? t("voucherStatusRedeemed")
        : t("voucherStatusPending");

    return (
        <div className="bg-gradient-to-br from-[#FFF7E6] to-[#FFF3D6] rounded-2xl border border-[#F5C842] p-4 shadow-sm">
            <p className="text-xs font-semibold text-[#B8860B] mb-3">
                {voucher.templateName}
            </p>

            {/* QR Code for valid vouchers */}
            {isActive && hasRealCode && (
                <div className="flex justify-center mb-3">
                    <div className="bg-white rounded-xl p-3 shadow-inner">
                        <QRCodeCanvas
                            value={voucher.code}
                            size={140}
                            level="H"
                            bgColor="#FFFFFF"
                            fgColor="#1A1A2E"
                            marginSize={1}
                        />
                    </div>
                </div>
            )}

            {/* Voucher code */}
            <div className="bg-white rounded-lg border-2 border-dashed border-[#F5C842] p-3 text-center">
                <p className="text-lg font-extrabold text-[#1A1A2E] font-mono tracking-widest break-all">
                    {voucher.code}
                </p>
            </div>

            {/* Status badge */}
            <div className="mt-2 flex items-center justify-between">
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : isRedeemed
                        ? "bg-gray-100 text-gray-500"
                        : "bg-amber-100 text-amber-700"
                }`}>
                    {statusLabel}
                </span>
            </div>
        </div>
    );
}
