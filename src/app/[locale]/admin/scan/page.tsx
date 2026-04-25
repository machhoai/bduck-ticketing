import { QRScanner } from "@/components/admin/QRScanner";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Scan vé / Đơn hàng" };

export default function AdminScanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">📷 Quét mã</h1>
        <p className="text-sm text-gray-400 mt-1">
          Quét hoặc nhập bất kỳ mã nào — vé điện tử, thẻ thành viên, mã đơn hàng, mã thanh toán tại quầy. Hệ thống tự động nhận diện.
        </p>
      </div>

      <div className="max-w-md">
        <QRScanner />
      </div>

      <div className="max-w-md bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">💡 Hướng dẫn</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Nhấn &ldquo;Bắt đầu quét&rdquo; và cho phép truy cập camera.</li>
          <li>Hướng camera vào QR code hoặc dùng tab &ldquo;Nhập thủ công&rdquo; để dán/nhập mã.</li>
          <li><strong>Vé điện tử</strong>: quét xong sẽ tự động đánh dấu &ldquo;Đã dùng&rdquo;.</li>
          <li><strong>Thẻ thành viên</strong>: hiển thị điểm gốc + thưởng + tổng để nạp vào thẻ nhựa.</li>
          <li><strong>Đơn hàng tại quầy</strong>: hiển thị chi tiết đơn và nút xác nhận thu tiền.</li>
          <li><strong>Mã đơn hàng</strong>: nhập mã đơn (VD: BDUCK-…) để tra cứu trạng thái.</li>
        </ul>
      </div>
    </div>
  );
}
