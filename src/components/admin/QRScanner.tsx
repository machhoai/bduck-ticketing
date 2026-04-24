"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { validatePass } from "@/actions/admin/scan";
import type { ScanResult } from "@/actions/admin/scan";
import { CheckCircle2, XCircle, Camera, CameraOff, Loader2, Keyboard, CreditCard } from "lucide-react";

type ScanState = "idle" | "scanning" | "loading" | "success" | "error";
type ScanMode = "camera" | "manual";

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
      const deviceId = devices[devices.length - 1]?.deviceId; // prefer back camera

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

  useEffect(() => {
    return () => {
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, []);

  const pass = result?.pass;
  const isMembership = pass?.productType === "membership";

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
          onClick={() => { setMode("manual"); stopCamera(); setResult(null); setScanState("idle"); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-colors ${mode === "manual" ? "bg-white shadow text-[#1A1A2E]" : "text-gray-400 hover:text-gray-600"}`}
        >
          <Keyboard className="h-4 w-4" /> Nhập thủ công
        </button>
      </div>

      {/* Camera mode */}
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

            {scanState === "success" && pass && <ScanSuccessOverlay pass={pass} isMembership={isMembership} />}

            {scanState === "error" && result && (
              <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <XCircle className="h-16 w-16 text-red-400" />
                <div>
                  <p className="text-white font-bold text-lg">❌ Không hợp lệ</p>
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
                <Camera className="h-4 w-4" /> Quét vé tiếp theo
              </button>
            )}
          </div>
        </>
      )}

      {/* Manual input mode */}
      {mode === "manual" && (
        <div className="space-y-4">
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nhập mã vé / code voucher</label>
              <input
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value.toUpperCase())}
                placeholder="BDUCK-PASS-xxxxxxxxxxxx"
                className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 font-mono text-sm focus:outline-none focus:border-[#F5C842] bg-white"
                autoFocus
              />
              <p className="text-xs text-gray-400">
                Hỗ trợ: <code className="bg-gray-100 px-1 rounded text-xs">BDUCK-PASS-…</code> (vé/membership) hoặc <code className="bg-gray-100 px-1 rounded text-xs">BDUCK-VCH-…</code> (voucher)
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
                Xác nhận
              </button>
            )}
          </form>

          {scanState === "success" && pass && (
            <ScanResultCard pass={pass} isMembership={isMembership} onReset={resetScanner} />
          )}
          {scanState === "error" && result && (
            <div className="flex flex-col items-center gap-3 p-6 bg-red-50 border border-red-200 rounded-2xl text-center">
              <XCircle className="h-12 w-12 text-red-400" />
              <div>
                <p className="font-bold text-red-700">Không hợp lệ</p>
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

// ── Success overlay (camera mode) ──────────────────────────────────────────────

function ScanSuccessOverlay({ pass, isMembership }: {
  pass: NonNullable<ScanResult["pass"]>;
  isMembership: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center gap-3 p-5 text-center overflow-y-auto">
      <CheckCircle2 className="h-14 w-14 text-emerald-400 flex-shrink-0" />
      <div className="space-y-1">
        <p className="text-white font-bold text-lg">Hợp lệ!</p>
        <p className="text-emerald-300 text-sm">{pass.customerName}</p>
        <p className="text-white/60 text-xs">{pass.productName}</p>
      </div>

      {isMembership ? (
        <div className="w-full bg-amber-900/50 rounded-xl p-3 space-y-1.5 mt-1">
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
      ) : pass.comboItems && pass.comboItems.length > 0 ? (
        <div className="mt-1 text-left bg-white/10 rounded-xl p-3 space-y-1 w-full">
          {pass.comboItems.map((item, i) => (
            <p key={i} className="text-white/80 text-xs">• {item.productName} × {item.quantity}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Result card (manual mode) ─────────────────────────────────────────────────

function ScanResultCard({ pass, isMembership, onReset }: {
  pass: NonNullable<ScanResult["pass"]>;
  isMembership: boolean;
  onReset: () => void;
}) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-emerald-500 flex-shrink-0" />
        <div>
          <p className="font-bold text-emerald-700">Hợp lệ!</p>
          <p className="text-emerald-600 text-sm">{pass.customerName}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Sản phẩm</span>
          <span className="font-medium text-gray-800">{pass.productName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Trạng thái</span>
          <span className="font-bold text-emerald-600">Đã quét</span>
        </div>

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
            {pass.merch && (
              <p className="text-xs text-emerald-600 mt-2">🎁 Quà đi kèm: {pass.merch}</p>
            )}
          </div>
        )}

        {!isMembership && pass.comboItems && pass.comboItems.length > 0 && (
          <div className="border-t border-gray-100 pt-2 space-y-1">
            {pass.comboItems.map((item, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{item.productName}</span>
                <span className="font-medium">×{item.quantity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onReset} className="w-full py-2.5 bg-[#1A1A2E] text-white font-bold rounded-xl text-sm hover:bg-[#1A1A2E]/90 transition-colors flex items-center justify-center gap-2">
        <Camera className="h-4 w-4" /> Xác nhận vé tiếp theo
      </button>
    </div>
  );
}
