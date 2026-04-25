"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { validatePass, markPassUsed } from "@/actions/admin/scan";
import { confirmCounterPayment } from "@/actions/admin/orders";
import type { ScanResult } from "@/actions/admin/scan";
import type { OrderDocument } from "@/types/firestore";
import {
  CheckCircle2, XCircle, Camera, CameraOff, Loader2,
  Keyboard, CreditCard, ShoppingBag, Package, DollarSign, Clock, Ticket,
} from "lucide-react";

type ScanState = "idle" | "scanning" | "loading" | "success" | "error";
type ScanMode = "camera" | "manual";

const formatVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

/* eslint-disable @typescript-eslint/no-explicit-any */
const formatTs = (ts: any) => {
  if (!ts?._seconds) return null;
  return new Date(ts._seconds * 1000).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};
const tsExpired = (ts: any) => ts?._seconds ? ts._seconds * 1000 < Date.now() : false;
const tsNotYet = (ts: any) => ts?._seconds ? ts._seconds * 1000 > Date.now() : false;
/* eslint-enable */

export function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [cameraError, setCameraError] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [mode, setMode] = useState<ScanMode>("camera");
  const [manualInput, setManualInput] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const isProcessingRef = useRef(false);

  // Order confirmation state
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Pass use state
  const [passUsed, setPassUsed] = useState(false);
  const [passUseLoading, setPassUseLoading] = useState(false);
  const [passUseError, setPassUseError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (codeReaderRef.current) {
      BrowserMultiFormatReader.releaseAllStreams();
    }
    setScanState("idle");
  }, []);

  const resetScanner = useCallback(() => {
    isProcessingRef.current = false;
    setResult(null);
    setScanState("idle");
    setManualInput("");
    setOrderConfirmed(false);
    setConfirmError(null);
    setConfirmLoading(false);
    setPassUsed(false);
    setPassUseError(null);
    setPassUseLoading(false);
  }, []);

  const processPayload = useCallback(async (payload: string) => {
    try {
      const scanResult = await validatePass(payload.trim());
      setResult(scanResult);
      setScanState(scanResult.valid ? "success" : "error");
    } catch {
      setResult({ valid: false, errorCode: "not_found", errorMessage: "Lỗi kết nối" });
      setScanState("error");
    }
  }, []);

  const startScanning = useCallback(async () => {
    setScanState("scanning");
    setCameraError(false);
    try {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;
      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      const deviceId = devices[devices.length - 1]?.deviceId;
      await codeReader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        async (result, _err, controls) => {
          if (!result || isProcessingRef.current) return;
          isProcessingRef.current = true;
          controls.stop();
          setScanState("loading");
          await processPayload(result.getText());
        }
      );
    } catch {
      setCameraError(true);
      setScanState("idle");
    }
  }, [processPayload]);

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setManualLoading(true);
    setScanState("loading");
    await processPayload(manualInput);
    setManualLoading(false);
  }

  async function handleConfirmPayment(orderId: string) {
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      const res = await confirmCounterPayment(orderId);
      if (res.success) {
        setOrderConfirmed(true);
      } else {
        setConfirmError(res.error);
      }
    } catch {
      setConfirmError("Lỗi kết nối, vui lòng thử lại");
    }
    setConfirmLoading(false);
  }

  async function handleUsePass(passId: string) {
    setPassUseLoading(true);
    setPassUseError(null);
    try {
      const res = await markPassUsed(passId);
      if (res.success) {
        setPassUsed(true);
      } else {
        setPassUseError(res.error || "Lỗi không xác định");
      }
    } catch {
      setPassUseError("Lỗi kết nối, vui lòng thử lại");
    }
    setPassUseLoading(false);
  }

  useEffect(() => {
    return () => { BrowserMultiFormatReader.releaseAllStreams(); };
  }, []);

  const pass = result?.pass;
  const order = result?.order;
  const isPassResult = result?.type === "pass";
  const isOrderResult = result?.type === "order";

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Mode selector */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          type="button"
          onClick={() => { setMode("camera"); resetScanner(); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === "camera" ? "bg-white shadow text-[#1A1A2E]" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Camera className="h-4 w-4" /> Quét camera
        </button>
        <button
          type="button"
          onClick={() => { setMode("manual"); stopCamera(); setResult(null); setScanState("idle"); setPassUsed(false); setPassUseError(null); setOrderConfirmed(false); setConfirmError(null); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === "manual" ? "bg-white shadow text-[#1A1A2E]" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Keyboard className="h-4 w-4" /> Nhập thủ công
        </button>
      </div>

      {/* ════════════ Camera mode ════════════ */}
      {mode === "camera" && (
        <>
          <div className="relative aspect-square bg-[#1A1A2E] rounded-3xl overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity duration-300 ${scanState === "scanning" ? "opacity-100" : "opacity-0"}`}
            />

            {scanState === "scanning" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-56">
                  {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-8 h-8 border-[#F5C842] ${
                      i === 0 ? "border-t-4 border-l-4 rounded-tl-lg"
                      : i === 1 ? "border-t-4 border-r-4 rounded-tr-lg"
                      : i === 2 ? "border-b-4 border-l-4 rounded-bl-lg"
                      : "border-b-4 border-r-4 rounded-br-lg"
                    }`} />
                  ))}
                  <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#F5C842]/60 animate-pulse" />
                </div>
              </div>
            )}

            {scanState === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-3">
                {cameraError
                  ? <><CameraOff className="h-12 w-12" /><p className="text-sm">Không thể truy cập camera</p></>
                  : <><Camera className="h-12 w-12" /><p className="text-sm">Nhấn &quot;Bắt đầu quét&quot; để mở camera</p></>
                }
              </div>
            )}

            {scanState === "loading" && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-[#F5C842] animate-spin" />
              </div>
            )}

            {/* Pass overlay */}
            {scanState === "success" && isPassResult && pass && (
              <PassOverlay
                pass={pass}
                used={passUsed}
                loading={passUseLoading}
                error={passUseError}
                onUse={() => handleUsePass(pass.id)}
              />
            )}

            {/* Order overlay */}
            {scanState === "success" && isOrderResult && order && (
              <OrderOverlay
                order={order}
                confirmed={orderConfirmed}
                loading={confirmLoading}
                error={confirmError}
                onConfirm={() => handleConfirmPayment(order.id)}
              />
            )}

            {/* Error overlay */}
            {scanState === "error" && result && (
              <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <XCircle className="h-16 w-16 text-red-400" />
                <div>
                  <p className="text-white font-bold text-lg">❌ Không tìm thấy</p>
                  <p className="text-red-300 text-sm mt-1">{result.errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {scanState === "idle" ? (
              <button onClick={startScanning} className="flex-1 py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-[#F5C842]/90 transition-colors">
                <Camera className="h-4 w-4" /> Bắt đầu quét
              </button>
            ) : scanState === "scanning" ? (
              <button onClick={stopCamera} className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-300 transition-colors">
                Dừng camera
              </button>
            ) : (
              <button onClick={resetScanner} className="flex-1 py-3 bg-[#1A1A2E] text-white font-bold rounded-2xl hover:bg-[#1A1A2E]/90 transition-colors flex items-center justify-center gap-2">
                <Camera className="h-4 w-4" /> Quét mã tiếp theo
              </button>
            )}
          </div>
        </>
      )}

      {/* ════════════ Manual input mode ════════════ */}
      {mode === "manual" && (
        <div className="space-y-4">
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nhập mã bất kỳ</label>
              <input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Dán mã vé, mã đơn hàng, mã quét tại quầy…"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 font-mono text-sm focus:outline-none focus:border-[#F5C842] bg-white"
                autoFocus
              />
              <p className="text-xs text-gray-400">
                Chấp nhận mọi định dạng: mã vé, mã đơn hàng, mã thanh toán tại quầy, v.v.
              </p>
            </div>

            {scanState === "loading" ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-[#F5C842]" />
              </div>
            ) : (
              <button
                type="submit"
                disabled={!manualInput.trim() || manualLoading}
                className="w-full py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-2xl hover:bg-[#F5C842]/90 transition-colors disabled:opacity-50"
              >
                Tìm kiếm
              </button>
            )}
          </form>

          {/* Pass result */}
          {scanState === "success" && isPassResult && pass && (
            <PassResultCard
              pass={pass}
              used={passUsed}
              loading={passUseLoading}
              error={passUseError}
              onUse={() => handleUsePass(pass.id)}
              onReset={resetScanner}
            />
          )}

          {/* Order result */}
          {scanState === "success" && isOrderResult && order && (
            <OrderResultCard
              order={order}
              confirmed={orderConfirmed}
              loading={confirmLoading}
              error={confirmError}
              onConfirm={() => handleConfirmPayment(order.id)}
              onReset={resetScanner}
            />
          )}

          {/* Error */}
          {scanState === "error" && result && (
            <div className="flex flex-col items-center gap-3 p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <div>
                <p className="font-bold text-red-700">Không tìm thấy</p>
                <p className="text-sm text-red-500 mt-1">{result.errorMessage}</p>
              </div>
              <button onClick={resetScanner} className="text-sm text-gray-500 hover:text-gray-700">Thử lại</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PASS OVERLAY (camera mode)
// ═══════════════════════════════════════════════════════════════════════════════

interface PassProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pass: any; // PassDocument after JSON serialization (Timestamps → plain objects)
  used: boolean;
  loading: boolean;
  error: string | null;
  onUse: () => void;
}

function PassOverlay({ pass, used, loading, error, onUse }: PassProps) {
  const isMembership = pass.productType === "membership";

  // After admin clicked "Sử dụng vé" successfully
  if (used) {
    return (
      <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center gap-3 p-5 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-400 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-white font-bold text-lg">✅ Đã sử dụng!</p>
          <p className="text-emerald-300 text-sm">{pass.customerName}</p>
          <p className="text-white/60 text-xs">{pass.productName}</p>
        </div>
      </div>
    );
  }

  const isUsed = pass.status === "used";
  const isVoided = pass.status === "voided";
  const isExpired = pass.status === "active" && tsExpired(pass.validUntil);
  const isNotYet = pass.status === "active" && tsNotYet(pass.validFrom);
  const isActive = pass.status === "active" && !isExpired && !isNotYet;

  const bgClass =
    isUsed ? "bg-gray-900/95"
    : isVoided ? "bg-red-950/90"
    : isExpired || isNotYet ? "bg-amber-950/90"
    : "bg-[#1A1A2E]/95"; // active

  return (
    <div className={`absolute inset-0 ${bgClass} flex flex-col items-center justify-center gap-2.5 p-5 text-center overflow-y-auto`}>
      {/* Status header */}
      {isActive && <Ticket className="h-10 w-10 text-[#F5C842] flex-shrink-0" />}
      {isUsed && <CheckCircle2 className="h-10 w-10 text-gray-400 flex-shrink-0" />}
      {isVoided && <XCircle className="h-10 w-10 text-red-400 flex-shrink-0" />}
      {(isExpired || isNotYet) && <Clock className="h-10 w-10 text-amber-400 flex-shrink-0" />}

      <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${
        isActive ? "bg-[#F5C842]/20 text-[#F5C842]"
        : isUsed ? "bg-gray-500/20 text-gray-300"
        : isVoided ? "bg-red-500/20 text-red-300"
        : "bg-amber-500/20 text-amber-300"
      }`}>
        {isActive ? "🎟️ Vé hợp lệ"
         : isUsed ? `✓ Đã sử dụng${pass.usedAt ? ` • ${formatTs(pass.usedAt)}` : ""}`
         : isVoided ? "Đã vô hiệu hóa"
         : isExpired ? "Đã hết hạn"
         : "Chưa đến ngày sử dụng"}
      </span>

      {/* Pass info */}
      <div className="space-y-0.5">
        <p className="text-white font-bold text-base">{pass.customerName}</p>
        <p className="text-white/60 text-xs">{pass.productName}</p>
        <p className="text-white/40 text-[10px] font-mono">#{pass.id.slice(-12).toUpperCase()}</p>
      </div>

      {/* Validity dates */}
      {(pass.validFrom || pass.validUntil || pass.visitDate) && (
        <div className="w-full bg-white/10 rounded-xl p-2.5 text-xs space-y-1">
          {pass.visitDate && (
            <div className="flex justify-between text-white/70">
              <span>Ngày tham quan</span><span className="font-medium">{formatTs(pass.visitDate)}</span>
            </div>
          )}
          {pass.validFrom && (
            <div className="flex justify-between text-white/70">
              <span>Có hiệu lực từ</span><span className="font-medium">{formatTs(pass.validFrom)}</span>
            </div>
          )}
          {pass.validUntil && (
            <div className="flex justify-between text-white/70">
              <span>Hết hạn</span><span className="font-medium">{formatTs(pass.validUntil)}</span>
            </div>
          )}
        </div>
      )}

      {/* Membership info */}
      {isMembership && (
        <div className="w-full bg-amber-900/50 rounded-xl p-2.5 space-y-1.5">
          <p className="text-xs text-amber-300 font-semibold uppercase tracking-wider flex items-center gap-1.5 justify-center">
            <CreditCard className="h-3 w-3" /> Thẻ thành viên
          </p>
          <div className="flex justify-around">
            <div><p className="text-[10px] text-amber-300/60">Điểm gốc</p><p className="text-amber-200 font-bold text-sm">{pass.membershipPoints ?? 0}</p></div>
            <div><p className="text-[10px] text-amber-300/60">Điểm thưởng</p><p className="text-amber-200 font-bold text-sm">{pass.bonusPoints ?? 0}</p></div>
            <div><p className="text-[10px] text-amber-300/60">Tổng điểm</p><p className="text-yellow-300 font-bold text-sm">{pass.totalPoints ?? 0}</p></div>
          </div>
          {pass.merch && <p className="text-xs text-emerald-300">🎁 Quà: {pass.merch}</p>}
        </div>
      )}

      {/* Combo items */}
      {!isMembership && pass.comboItems?.length > 0 && (
        <div className="w-full bg-white/10 rounded-xl p-2.5 text-left text-xs space-y-1">
          {pass.comboItems.map((item: { productName: string; quantity: number }, i: number) => (
            <p key={i} className="text-white/80">• {item.productName} × {item.quantity}</p>
          ))}
        </div>
      )}

      {error && <p className="text-red-300 text-xs">{error}</p>}

      {/* Use button — active: clickable, used: disabled with time */}
      {isActive && (
        <button
          onClick={onUse}
          disabled={loading}
          className="w-full py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {loading ? "Đang xử lý…" : "Sử dụng vé"}
        </button>
      )}
      {isUsed && (
        <button
          disabled
          className="w-full py-2.5 bg-gray-600/50 text-gray-300 font-bold rounded-xl text-sm cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Đã sử dụng{pass.usedAt ? ` • ${formatTs(pass.usedAt)}` : ""}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PASS RESULT CARD (manual mode)
// ═══════════════════════════════════════════════════════════════════════════════

function PassResultCard({ pass, used, loading, error, onUse, onReset }: PassProps & { onReset: () => void }) {
  const isMembership = pass.productType === "membership";

  // After use
  if (used) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-700">✅ Đã sử dụng!</p>
            <p className="text-emerald-600 text-sm">{pass.customerName} — {pass.productName}</p>
          </div>
        </div>
        <button onClick={onReset} className="w-full py-2.5 bg-[#1A1A2E] text-white font-bold rounded-xl text-sm hover:bg-[#1A1A2E]/90 transition-colors flex items-center justify-center gap-2">
          <Camera className="h-4 w-4" /> Quét mã tiếp theo
        </button>
      </div>
    );
  }

  const isUsed = pass.status === "used";
  const isVoided = pass.status === "voided";
  const isExpired = pass.status === "active" && tsExpired(pass.validUntil);
  const isNotYet = pass.status === "active" && tsNotYet(pass.validFrom);
  const isActive = pass.status === "active" && !isExpired && !isNotYet;

  const cardClass =
    isActive ? "bg-[#FFFBEB] border-[#F5C842]/30"
    : isUsed ? "bg-gray-50 border-gray-200"
    : isVoided ? "bg-red-50 border-red-200"
    : "bg-amber-50 border-amber-200";

  const statusBadge =
    isActive ? { label: "Hợp lệ", className: "bg-[#F5C842]/20 text-[#B8860B]" }
    : isUsed ? { label: `Đã sử dụng${pass.usedAt ? ` • ${formatTs(pass.usedAt)}` : ""}`, className: "bg-gray-100 text-gray-600" }
    : isVoided ? { label: "Đã vô hiệu hóa", className: "bg-red-100 text-red-700" }
    : isExpired ? { label: "Đã hết hạn", className: "bg-amber-100 text-amber-700" }
    : { label: "Chưa đến ngày sử dụng", className: "bg-amber-100 text-amber-700" };

  const headerIcon =
    isActive ? <Ticket className="h-8 w-8 text-[#F5C842] flex-shrink-0" />
    : isUsed ? <CheckCircle2 className="h-8 w-8 text-gray-400 flex-shrink-0" />
    : isVoided ? <XCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
    : <Clock className="h-8 w-8 text-amber-500 flex-shrink-0" />;

  return (
    <div className={`${cardClass} border rounded-2xl p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {headerIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-800">{pass.customerName}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.className}`}>
              {statusBadge.label}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">{pass.productName}</p>
          <p className="text-gray-400 text-[10px] font-mono">#{pass.id.slice(-12).toUpperCase()}</p>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
        {pass.visitDate && (
          <div className="flex justify-between">
            <span className="text-gray-400">Ngày tham quan</span>
            <span className="font-medium text-gray-800">{formatTs(pass.visitDate)}</span>
          </div>
        )}
        {pass.validFrom && (
          <div className="flex justify-between">
            <span className="text-gray-400">Có hiệu lực từ</span>
            <span className="font-medium text-gray-800">{formatTs(pass.validFrom)}</span>
          </div>
        )}
        {pass.validUntil && (
          <div className="flex justify-between">
            <span className="text-gray-400">Hết hạn</span>
            <span className={`font-medium ${isExpired ? "text-red-600" : "text-gray-800"}`}>{formatTs(pass.validUntil)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">Đơn hàng</span>
          <span className="font-medium text-gray-800 text-xs">{pass.orderNumber}</span>
        </div>

        {/* Membership info */}
        {isMembership && (
          <div className="border-t border-gray-100 pt-2 mt-2">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <CreditCard className="h-3 w-3" /> Thẻ thành viên
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-amber-50 rounded-lg p-2">
                <p className="text-[10px] text-amber-500">Điểm gốc</p>
                <p className="font-bold text-amber-700">{pass.membershipPoints ?? 0}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <p className="text-[10px] text-amber-500">Điểm thưởng</p>
                <p className="font-bold text-amber-700">{pass.bonusPoints ?? 0}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2">
                <p className="text-[10px] text-yellow-600 font-semibold">Tổng</p>
                <p className="font-bold text-yellow-700">{pass.totalPoints ?? 0}</p>
              </div>
            </div>
            {pass.merch && <p className="text-xs text-emerald-600 mt-2">🎁 Quà đi kèm: {pass.merch}</p>}
          </div>
        )}

        {/* Combo items */}
        {!isMembership && pass.comboItems?.length > 0 && (
          <div className="border-t border-gray-100 pt-2 space-y-1">
            {pass.comboItems.map((item: { productName: string; quantity: number }, i: number) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{item.productName}</span>
                <span className="font-medium">×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      {/* Use button — active: clickable, used: disabled with time */}
      {isActive && (
        <button
          onClick={onUse}
          disabled={loading}
          className="w-full py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-2xl hover:bg-[#F5C842]/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
          {loading ? "Đang xử lý…" : "Sử dụng vé"}
        </button>
      )}
      {isUsed && (
        <button
          disabled
          className="w-full py-3 bg-gray-200 text-gray-500 font-bold rounded-2xl cursor-not-allowed flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Đã sử dụng{pass.usedAt ? ` • ${formatTs(pass.usedAt)}` : ""}
        </button>
      )}

      <button onClick={onReset} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">
        Quét mã khác
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDER OVERLAY (camera mode) — handles ALL statuses
// ═══════════════════════════════════════════════════════════════════════════════

function OrderOverlay({ order, confirmed, loading, error, onConfirm }: {
  order: OrderDocument;
  confirmed: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  if (confirmed) {
    return (
      <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center gap-3 p-5 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-400 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-white font-bold text-lg">Đã xác nhận!</p>
          <p className="text-emerald-300 text-sm">Đơn {order.orderNumber} đã thu tiền thành công</p>
          <p className="text-white/60 text-xs">{order.customerName} • {formatVND(order.finalAmount)}</p>
        </div>
      </div>
    );
  }

  const isCounter = order.paymentDetails?.provider === "counter";
  const canConfirm = order.status === "pending" && isCounter;

  const bgClass =
    order.status === "paid" ? "bg-emerald-950/90"
    : order.status === "cancelled" ? "bg-red-950/90"
    : "bg-blue-950/95";

  return (
    <div className={`absolute inset-0 ${bgClass} flex flex-col items-center justify-center gap-3 p-5 text-center overflow-y-auto`}>
      {order.status === "paid" && (
        <><CheckCircle2 className="h-10 w-10 text-emerald-400 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">✅ Đã thanh toán</span></>
      )}
      {order.status === "cancelled" && (
        <><XCircle className="h-10 w-10 text-red-400 flex-shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-red-500/20 text-red-300">
          {order.cancelReason === "counter_expired" ? "⏰ Đã hết hạn" : "❌ Đã huỷ"}
        </span></>
      )}
      {order.status === "pending" && (
        <>{isCounter ? <ShoppingBag className="h-10 w-10 text-blue-400 flex-shrink-0" /> : <Clock className="h-10 w-10 text-amber-400 flex-shrink-0" />}
        <span className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${isCounter ? "bg-blue-500/20 text-blue-300" : "bg-amber-500/20 text-amber-300"}`}>
          {isCounter ? "📦 Chờ thu tiền tại quầy" : "⏳ Chờ thanh toán online"}
        </span></>
      )}

      <div className="space-y-0.5">
        <p className="text-white font-bold text-base">{order.orderNumber}</p>
        {order.orderCode && <p className="text-white/50 text-xs font-mono">{order.orderCode}</p>}
        <p className="text-white/70 text-xs">{order.customerName}</p>
      </div>

      <div className="w-full bg-white/10 rounded-xl p-3 space-y-1.5 text-left text-xs">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-white/80">
            <span>{item.productName} × {item.quantity}</span>
            <span className="font-medium">{formatVND(item.subtotal)}</span>
          </div>
        ))}
        {order.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-300 border-t border-white/10 pt-1.5">
            <span>Giảm giá</span><span>-{formatVND(order.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-yellow-300 font-bold border-t border-white/10 pt-1.5">
          <span>{order.status === "paid" ? "Đã thu" : "Tổng tiền"}</span>
          <span>{formatVND(order.finalAmount)}</span>
        </div>
      </div>

      {error && <p className="text-red-300 text-xs">{error}</p>}

      {canConfirm && (
        <button onClick={onConfirm} disabled={loading}
          className="w-full py-2.5 bg-emerald-500 text-white font-bold rounded-xl text-sm hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          {loading ? "Đang xử lý…" : "Xác nhận đã thu tiền"}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ORDER RESULT CARD (manual mode) — handles ALL statuses
// ═══════════════════════════════════════════════════════════════════════════════

function OrderResultCard({ order, confirmed, loading, error, onConfirm, onReset }: {
  order: OrderDocument;
  confirmed: boolean;
  loading: boolean;
  error: string | null;
  onConfirm: () => void;
  onReset: () => void;
}) {
  if (confirmed) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 flex-shrink-0" />
          <div>
            <p className="font-bold text-emerald-700">Đã xác nhận thanh toán!</p>
            <p className="text-emerald-600 text-sm">Đơn {order.orderNumber}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-400">Khách hàng</span><span className="font-medium">{order.customerName}</span></div>
          <div className="flex justify-between"><span className="text-gray-400">Số tiền</span><span className="font-bold text-emerald-600">{formatVND(order.finalAmount)}</span></div>
        </div>
        <button onClick={onReset} className="w-full py-2.5 bg-[#1A1A2E] text-white font-bold rounded-xl text-sm hover:bg-[#1A1A2E]/90 transition-colors flex items-center justify-center gap-2">
          <Camera className="h-4 w-4" /> Quét mã tiếp theo
        </button>
      </div>
    );
  }

  const isCounter = order.paymentDetails?.provider === "counter";
  const canConfirm = order.status === "pending" && isCounter;

  const cardClass =
    order.status === "paid" ? "bg-emerald-50 border-emerald-200"
    : order.status === "cancelled" ? "bg-red-50 border-red-200"
    : "bg-blue-50 border-blue-200";

  const statusBadge =
    order.status === "paid" ? { label: "Đã thanh toán", className: "bg-emerald-100 text-emerald-700" }
    : order.status === "cancelled" ? { label: order.cancelReason === "counter_expired" ? "Đã hết hạn" : "Đã huỷ", className: "bg-red-100 text-red-700" }
    : { label: isCounter ? "Chờ thu tiền" : "Chờ thanh toán", className: "bg-blue-100 text-blue-700" };

  const headerIcon =
    order.status === "paid" ? <CheckCircle2 className="h-8 w-8 text-emerald-500 flex-shrink-0" />
    : order.status === "cancelled" ? <XCircle className="h-8 w-8 text-red-500 flex-shrink-0" />
    : <ShoppingBag className="h-8 w-8 text-blue-500 flex-shrink-0" />;

  return (
    <div className={`${cardClass} border rounded-2xl p-5 space-y-4`}>
      <div className="flex items-start gap-3">
        {headerIcon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-800">{order.orderNumber}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge.className}`}>{statusBadge.label}</span>
          </div>
          {order.orderCode && <p className="text-gray-400 text-xs font-mono mt-0.5">{order.orderCode}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-400">Khách hàng</span><span className="font-medium text-gray-800">{order.customerName}</span></div>
        {order.customerPhone && <div className="flex justify-between"><span className="text-gray-400">SĐT</span><span className="font-medium text-gray-800">{order.customerPhone}</span></div>}
        <div className="flex justify-between"><span className="text-gray-400">Email</span><span className="font-medium text-gray-800 text-xs">{order.customerEmail}</span></div>

        <div className="border-t border-gray-100 pt-2 mt-2 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Package className="h-3 w-3" /> Sản phẩm</p>
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-600">{item.productName} × {item.quantity}</span>
              <span className="font-medium">{formatVND(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-2 space-y-1">
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-xs"><span className="text-gray-400">Giảm giá</span><span className="text-emerald-600">-{formatVND(order.discountAmount)}</span></div>
          )}
          <div className="flex justify-between font-bold">
            <span className="text-gray-700">{order.status === "paid" ? "Đã thu" : "Tổng tiền"}</span>
            <span className="text-base" style={{ color: order.status === "paid" ? "#059669" : "#1d4ed8" }}>{formatVND(order.finalAmount)}</span>
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}

      {canConfirm && (
        <button onClick={onConfirm} disabled={loading}
          className="w-full py-3 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
          {loading ? "Đang xử lý…" : "Xác nhận đã thu tiền"}
        </button>
      )}

      <button onClick={onReset} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700">Quét mã khác</button>
    </div>
  );
}
