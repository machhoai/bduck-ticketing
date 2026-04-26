/**
 * Bilingual reservation confirmation email sent to the customer
 * when a bank transfer order is created.
 *
 * Content: "Your reservation is confirmed, we're verifying the
 * transaction. Tickets and invoice will be sent via email once
 * the order is confirmed."
 */

import transporter, { FROM_ADDRESS } from "./transporter";

interface TransferReservationParams {
    to: string;
    customerName: string;
    orderNumber: string;
    items: {
        productName: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
    }[];
    finalAmount: number;
    discountAmount: number;
    qrDescription: string;
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function buildReservationHTML(params: TransferReservationParams): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.citfuns.joyworld.vn";
    const hotline = process.env.NEXT_PUBLIC_HOTLINE ?? "096 927 17 37";
    const supportEmail = "ask@bduckcityfuns.com.vn"

    const itemRows = params.items
        .map(
            (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">
          ${item.productName}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:center;">
          ${item.quantity}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">
          ${formatVND(item.subtotal)}
        </td>
      </tr>`
        )
        .join("");

    return `
    <div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#FF6B00,#FF8C38);padding:24px;text-align:center;">
        <img src="${appUrl}/images/avt_bduck-cityfuns.png" alt="B.Duck Cityfuns" height="40" style="margin-bottom:8px;" />
        <h1 style="margin:0;color:#fff;font-size:20px;">✅ Xác nhận đặt chỗ</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Reservation Confirmed</p>
      </div>

      <div style="padding:24px;">

        <!-- Vietnamese Section -->
        <div style="margin-bottom:28px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#333;border-left:4px solid #FF6B00;padding-left:12px;">
            🇻🇳 TIẾNG VIỆT
          </h2>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Kính gửi <strong>${params.customerName}</strong>,
          </p>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Đơn hàng <strong>${params.orderNumber}</strong> của bạn đã được <strong>giữ chỗ thành công</strong>!
          </p>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Chúng tôi đang kiểm tra giao dịch chuyển khoản của bạn. 
            <strong>Vé và hóa đơn sẽ được gửi qua email</strong> ngay khi đơn hàng được xác nhận thành công.
          </p>

          <div style="background:#FFF8F0;border:1px solid #FFE0B2;border-radius:8px;padding:12px;margin:12px 0;">
            <p style="margin:0;font-size:13px;color:#666;">
              Nội dung chuyển khoản: <strong style="color:#E65100;">${params.qrDescription}</strong>
            </p>
          </div>
        </div>

        <!-- English Section -->
        <div style="margin-bottom:28px;">
          <h2 style="margin:0 0 12px;font-size:16px;color:#333;border-left:4px solid #0066CC;padding-left:12px;">
            🇬🇧 ENGLISH
          </h2>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Dear <strong>${params.customerName}</strong>,
          </p>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            Your order <strong>${params.orderNumber}</strong> has been <strong>reserved successfully</strong>!
          </p>
          <p style="font-size:14px;color:#333;line-height:1.6;margin:0 0 12px;">
            We are verifying your bank transfer transaction. 
            <strong>Tickets and invoice will be sent to your email</strong> once the order is confirmed.
          </p>

          <div style="background:#F0F7FF;border:1px solid #BBDEFB;border-radius:8px;padding:12px;margin:12px 0;">
            <p style="margin:0;font-size:13px;color:#666;">
              Transfer description: <strong style="color:#1565C0;">${params.qrDescription}</strong>
            </p>
          </div>
        </div>

        <!-- Order Details (language-neutral) -->
        <h3 style="margin:0 0 8px;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">
          Chi tiết đơn hàng / Order Details
        </h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
          <thead>
            <tr style="border-bottom:2px solid #eee;">
              <th style="padding:8px 0;text-align:left;font-size:12px;color:#999;">Sản phẩm / Product</th>
              <th style="padding:8px 0;text-align:center;font-size:12px;color:#999;">SL / Qty</th>
              <th style="padding:8px 0;text-align:right;font-size:12px;color:#999;">Thành tiền / Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        ${params.discountAmount > 0
            ? `<p style="font-size:14px;color:#666;margin:4px 0;">Giảm giá / Discount: -${formatVND(params.discountAmount)}</p>`
            : ""
        }
        <p style="font-size:16px;font-weight:700;color:#E65100;margin:8px 0 20px;">
          Tổng thanh toán / Total: ${formatVND(params.finalAmount)}
        </p>

        <!-- Contact Info -->
        <div style="background:#f9f9f9;border-radius:8px;padding:16px;text-align:center;">
          <p style="margin:0 0 4px;font-size:13px;color:#666;">
            Liên hệ hỗ trợ / Contact support:
          </p>
          <p style="margin:0;font-size:14px;color:#333;">
            📞 <a href="tel:${hotline}" style="color:#FF6B00;text-decoration:none;">${hotline}</a>
            &nbsp;|&nbsp;
            📧 <a href="mailto:${supportEmail}" style="color:#FF6B00;text-decoration:none;">${supportEmail}</a>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background:#f9f9f9;padding:16px;text-align:center;border-top:1px solid #eee;">
        <p style="margin:0;font-size:12px;color:#999;">
          © B.Duck Cityfuns | <a href="${appUrl}" style="color:#FF6B00;text-decoration:none;">bduck.vn</a>
        </p>
      </div>
    </div>
  `;
}

export async function sendTransferReservationEmail(
    params: TransferReservationParams
): Promise<void> {
    const html = buildReservationHTML(params);

    await transporter.sendMail({
        from: FROM_ADDRESS,
        to: params.to,
        subject: `✅ Xác nhận đặt chỗ — ${params.orderNumber} / Reservation Confirmed`,
        html,
    });
}
