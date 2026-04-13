"use client";

import { QRCodeCanvas } from "qrcode.react";
import Image from "next/image";
import { CheckCircle, Calendar, Clock, Download } from "lucide-react";
import type { PassDocument } from "@/types/firestore";

interface PassCardProps {
  pass: PassDocument;
}

function formatDate(timestamp?: { toDate(): Date } | null): string {
  if (!timestamp) return "—";
  return timestamp.toDate().toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PassCard({ pass }: PassCardProps) {
  const qrValue = `BDUCK-PASS-${pass.id}`;
  const isUsed = pass.status === "used";
  const isVoided = pass.status === "voided";
  const isExpired = pass.status === "expired";
  const isActive = pass.status === "active";

  return (
    <article
      className={`relative bg-white rounded-3xl shadow-lg border-2 overflow-hidden transition-all duration-300 ${
        isActive
          ? "border-[#F5C842]"
          : "border-gray-200 opacity-70"
      }`}
    >
      {/* Status ribbon */}
      {!isActive && (
        <div className="absolute top-4 right-4 z-10">
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
              isUsed
                ? "bg-green-100 text-green-700"
                : isVoided
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isUsed ? "Đã dùng" : isVoided ? "Đã hủy" : "Hết hạn"}
          </span>
        </div>
      )}

      {/* Product thumbnail banner */}
      <div className="relative h-28 bg-[#1A1A2E] overflow-hidden">
        <Image
          src={pass.thumbnailUrl}
          alt={pass.productName}
          fill
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 flex items-end px-5 pb-3">
          <h2 className="text-white font-extrabold text-lg leading-tight drop-shadow">
            {pass.productName}
          </h2>
        </div>
        {/* Black duck logo emoji */}
        <span className="absolute top-3 left-5 text-2xl">🦆</span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Validity info */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {pass.validityType === "date-specific" && pass.visitDate && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[#F5C842]" />
              <span>Ngày tham quan: <strong>{formatDate(pass.visitDate as any)}</strong></span>
            </div>
          )}
          {pass.validityType === "date-range" && pass.validFrom && pass.validUntil && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#F5C842]" />
              <span>
                Hiệu lực: <strong>{formatDate(pass.validFrom as any)}</strong> —{" "}
                <strong>{formatDate(pass.validUntil as any)}</strong>
              </span>
            </div>
          )}
          {pass.validityType === "open-dated" && (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Vé không giới hạn ngày</span>
            </div>
          )}
        </div>

        {/* Combo items */}
        {pass.comboItems && pass.comboItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-800 uppercase mb-2">
              Combo bao gồm
            </p>
            <ul className="space-y-1">
              {pass.comboItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-amber-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F5C842] flex-shrink-0" />
                  {item.productName} × {item.quantity}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* QR Code — rendered client-side from pass ID (D2: no Storage) */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div
            className={`p-4 rounded-2xl border-4 ${
              isActive ? "border-[#F5C842] bg-white" : "border-gray-200 bg-gray-50"
            }`}
          >
            <QRCodeCanvas
              value={qrValue}
              size={180}
              level="H"
              includeMargin={false}
              fgColor={isActive ? "#1A1A2E" : "#9CA3AF"}
            />
          </div>
          <p className="text-xs text-gray-400 font-mono tracking-widest">
            {pass.id}
          </p>
          <p className="text-xs text-gray-500 text-center">
            Xuất trình QR này tại cổng vào
          </p>
        </div>

        {/* Customer info */}
        <div className="border-t border-dashed border-gray-200 pt-4 text-xs text-gray-500 space-y-1">
          <p>
            <span className="font-semibold">Người giữ vé:</span>{" "}
            {pass.customerName}
          </p>
          <p>
            <span className="font-semibold">Đơn hàng:</span>{" "}
            {pass.orderNumber}
          </p>
        </div>

        {/* Wallet / download hint */}
        {pass.walletPassUrl && (
          <a
            href={pass.walletPassUrl}
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-[#1A1A2E] text-[#1A1A2E] text-sm font-semibold hover:bg-[#1A1A2E] hover:text-white transition-colors"
          >
            <Download className="h-4 w-4" />
            Thêm vào Apple Wallet
          </a>
        )}
      </div>
    </article>
  );
}
