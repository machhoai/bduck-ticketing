"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { validatePass } from "@/actions/admin/scan";
import type { ScanResult } from "@/actions/admin/scan";
import { CheckCircle2, XCircle, Camera, CameraOff, Loader2 } from "lucide-react";

type ScanState = "idle" | "scanning" | "loading" | "success" | "error";

export function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [cameraError, setCameraError] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
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

          try {
            const scanResult = await validatePass(result.getText());
            setResult(scanResult);
            setScanState(scanResult.valid ? "success" : "error");
          } catch {
            setResult({ valid: false, errorCode: "not_found", errorMessage: "Lỗi kết nối" });
            setScanState("error");
          }
        }
      );
    } catch {
      setCameraError(true);
      setScanState("idle");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, []);

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Camera viewport */}
      <div className="relative aspect-square bg-[#1A1A2E] rounded-3xl overflow-hidden shadow-2xl">
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            scanState === "scanning" ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Overlay frames */}
        {scanState === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-56 h-56">
              {/* Corner frames */}
              {["top-0 left-0", "top-0 right-0", "bottom-0 left-0", "bottom-0 right-0"].map(
                (pos, i) => (
                  <div
                    key={i}
                    className={`absolute ${pos} w-8 h-8 border-[#F5C842] ${
                      i === 0
                        ? "border-t-4 border-l-4 rounded-tl-lg"
                        : i === 1
                        ? "border-t-4 border-r-4 rounded-tr-lg"
                        : i === 2
                        ? "border-b-4 border-l-4 rounded-bl-lg"
                        : "border-b-4 border-r-4 rounded-br-lg"
                    }`}
                  />
                )
              )}
              {/* Scan line animation */}
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#F5C842]/60 animate-pulse" />
            </div>
          </div>
        )}

        {/* State overlays */}
        {scanState === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-3">
            {cameraError ? (
              <><CameraOff className="h-12 w-12" /><p className="text-sm">Không thể truy cập camera</p></>
            ) : (
              <><Camera className="h-12 w-12" /><p className="text-sm">Nhấn "Bắt đầu quét" để mở camera</p></>
            )}
          </div>
        )}

        {scanState === "loading" && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-[#F5C842] animate-spin" />
          </div>
        )}

        {scanState === "success" && result && (
          <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-400" />
            <div>
              <p className="text-white font-bold text-lg">✅ Hợp lệ!</p>
              <p className="text-emerald-300 text-sm mt-1">{result.pass?.customerName}</p>
              <p className="text-white/60 text-xs mt-1">{result.pass?.productName}</p>
              {result.pass?.comboItems && result.pass.comboItems.length > 0 && (
                <div className="mt-2 text-left bg-white/10 rounded-xl p-3 space-y-1">
                  {result.pass.comboItems.map((item, i) => (
                    <p key={i} className="text-white/80 text-xs">
                      • {item.productName} × {item.quantity}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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

      {/* Controls */}
      <div className="flex gap-3">
        {scanState === "idle" ? (
          <button
            onClick={startScanning}
            className="flex-1 py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-[#F5C842]/90 transition-colors"
          >
            <Camera className="h-4 w-4" />
            Bắt đầu quét
          </button>
        ) : scanState === "scanning" ? (
          <button
            onClick={() => { stopCamera(); }}
            className="flex-1 py-3 bg-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-300 transition-colors"
          >
            Dừng camera
          </button>
        ) : (
          <button
            onClick={resetScanner}
            className="flex-1 py-3 bg-[#1A1A2E] text-white font-bold rounded-2xl hover:bg-[#1A1A2E]/90 transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="h-4 w-4" />
            Quét vé tiếp theo
          </button>
        )}
      </div>
    </div>
  );
}
