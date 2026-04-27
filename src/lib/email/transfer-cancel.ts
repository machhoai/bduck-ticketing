/**
 * Bilingual cancellation email sent to the customer when admin
 * cancels a bank transfer order (expired, payment not received).
 *
 * Instructs customer to contact hotline with transfer receipt
 * if they have already transferred.
 */

import transporter, { FROM_ADDRESS } from "./transporter";

interface TransferCancelParams {
    to: string;
    customerName: string;
    orderNumber: string;
    finalAmount: number;
    cancelReason?: string;
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function buildCancelHTML(params: TransferCancelParams): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.citfuns.joyworld.vn";
    const hotline = process.env.NEXT_PUBLIC_HOTLINE ?? "096 927 17 37";
    const supportEmail =
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "ask@bduckcityfuns.com.vn";

    return `
    <div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#D32F2F,#EF5350);padding:24px;text-align:center;">
        <img src="${appUrl}/images/avt_bduck-cityfuns.png" alt="B.Duck Cityfuns" height="40" style="margin-bottom:8px;" />
        <h1 style="margin:0;color:#fff;font-size:20px;">❌ Đơn hàng đã bị hủy</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Order Cancelled</p>
      </div>

      <div style="padding:24px;">

        <!-- Vietnamese Section -->
        <div style="margin-bottom:28px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#333;border-left:4px solid #D32F2F;padding-left:12px;">
            🇻🇳 TIẾNG VIỆT
          </h2>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Kính gửi <strong>${params.customerName}</strong>,
          </p>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Đơn hàng <strong>${params.orderNumber}</strong> (${formatVND(params.finalAmount)}) 
            đã bị hủy do chúng tôi <strong>không nhận được thanh toán</strong> 
            trong thời gian quy định.
          </p>

          <div style="background:#FFF3F0;border:1px solid #FFCDD2;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#D32F2F;">
              ⚠️ Nếu bạn đã chuyển khoản
            </p>
            <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">
              Vui lòng liên hệ ngay với chúng tôi <strong>kèm theo hóa đơn chuyển khoản</strong> 
              (ảnh chụp màn hình hoặc biên lai) để được hỗ trợ:
            </p>
            <p style="margin:8px 0 0;font-size:14px;">
              📞 Hotline: <a href="tel:${hotline}" style="color:#D32F2F;font-weight:600;text-decoration:none;">${hotline}</a><br/>
              📧 Email: <a href="mailto:${supportEmail}" style="color:#D32F2F;font-weight:600;text-decoration:none;">${supportEmail}</a>
            </p>
          </div>
        </div>

        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />

        <!-- English Section -->
        <div style="margin-bottom:16px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#333;border-left:4px solid #0066CC;padding-left:12px;">
            🇬🇧 ENGLISH
          </h2>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Dear <strong>${params.customerName}</strong>,
          </p>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Order <strong>${params.orderNumber}</strong> (${formatVND(params.finalAmount)}) 
            has been cancelled as <strong>payment was not received</strong> 
            within the allowed time.
          </p>

          <div style="background:#F0F7FF;border:1px solid #BBDEFB;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1565C0;">
              ⚠️ If you have already transferred
            </p>
            <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">
              Please contact us immediately with your <strong>transfer receipt</strong> 
              (screenshot or bank statement) for assistance:
            </p>
            <p style="margin:8px 0 0;font-size:14px;">
              📞 Hotline: <a href="tel:${hotline}" style="color:#1565C0;font-weight:600;text-decoration:none;">${hotline}</a><br/>
              📧 Email: <a href="mailto:${supportEmail}" style="color:#1565C0;font-weight:600;text-decoration:none;">${supportEmail}</a>
            </p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f9f9f9;padding:16px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;font-size:12px;color:#999;">
          © B.Duck Cityfuns | <a href="${appUrl}" style="color:#FF6B00;text-decoration:none;">cityfuns.joyworld.vn/</a>
        </p>
      </div>
    </div>
  `;
}

export async function sendTransferCancelEmail(
    params: TransferCancelParams
): Promise<void> {
    const html = buildCancelHTML(params);

    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: params.to,
        subject: `❌ Đơn hàng ${params.orderNumber} đã bị hủy / Order Cancelled`,
        html,
    });
}
