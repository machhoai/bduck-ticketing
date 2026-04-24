import { QRScanner } from "@/components/admin/QRScanner";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Scan vé / Membership" };

export default function AdminScanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">📷 Quét mã</h1>
        <p className="text-sm text-gray-400 mt-1">
          Quét QR code trên vé điện tử, thẻ thành viên, hoặc voucher để xác nhận. Hỗ trợ nhập thủ công khi camera gặp vấn đề.
        </p>
      </div>

      <div className="max-w-md">
        <QRScanner />
      </div>

      <div className="max-w-md bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">💡 Hướng dẫn</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Nhấn &ldquo;Bắt đầu quét&rdquo; và cho phép truy cập camera.</li>
          <li>Hướng camera vào QR code trên vé hoặc thẻ thành viên.</li>
          <li>Vé hợp lệ sẽ được tự động đánh dấu &ldquo;Đã dùng&rdquo;.</li>
          <li>Thẻ thành viên: hiển thị điểm gốc + điểm thưởng + tổng điểm để nạp vào thẻ nhựa.</li>
          <li>Dùng tab &ldquo;Nhập thủ công&rdquo; khi camera không hoạt động.</li>
        </ul>
      </div>
    </div>
  );
}
