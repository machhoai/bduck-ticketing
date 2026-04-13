import { QRScanner } from "@/components/admin/QRScanner";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Scan vé" };

export default function AdminScanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">📷 Scan vé cổng vào</h1>
        <p className="text-sm text-gray-400 mt-1">
          Quét QR code trên vé điện tử của khách để kiểm tra và xác nhận vào cổng.
        </p>
      </div>

      <div className="max-w-md">
        <QRScanner />
      </div>

      <div className="max-w-md bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">💡 Hướng dẫn</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Nhấn "Bắt đầu quét" và cho phép truy cập camera.</li>
          <li>Hướng camera vào QR code trên vé khách.</li>
          <li>Vé hợp lệ sẽ được tự động đánh dấu "Đã dùng".</li>
          <li>Vé đã dùng sẽ không quét được lần thứ hai.</li>
        </ul>
      </div>
    </div>
  );
}
