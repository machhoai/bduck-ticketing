/**
 * Ticket confirmation email — sent when payment is successful.
 * Contains order summary, QR ticket links, and a "view tickets" CTA.
 *
 * Also re-usable for the "resend ticket email" feature on the result page.
 */
import transporter, { FROM_ADDRESS } from "./transporter";

interface TicketItem {
    productName: string;
    productType: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

interface TicketEmailParams {
    to: string;
    customerName: string;
    orderId: string;
    orderNumber: string;
    items: TicketItem[];
    finalAmount: number;
    discountAmount: number;
    passIds: string[];
    locale?: string;
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " ₫";
}

function buildTicketHTML(params: TicketEmailParams): string {
    const {
        customerName,
        orderNumber,
        items,
        finalAmount,
        discountAmount,
        passIds,
        orderId,
        locale = "vi",
    } = params;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck.vn";
    const resultLink = `${appUrl}/${locale}/checkout/result?orderId=${orderId}&status=success`;

    const itemRows = items
        .map(
            (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;font-size:14px;color:#333;">
          ${item.productName}
          <br /><span style="font-size:12px;color:#999;">${item.productType === "combo" ? "Combo" : "Vé"} × ${item.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;font-size:14px;color:#333;text-align:right;font-weight:600;">
          ${formatVND(item.subtotal)}
        </td>
      </tr>`
        )
        .join("");

    const ticketCards = passIds
        .map(
            (passId, index) => `
      <tr>
        <td style="padding:8px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFB;border:1px solid #E8ECF0;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:14px 16px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1A1A2E;">
                  Vé ${index + 1} / ${passIds.length}
                </p>
                <p style="margin:0;font-size:12px;color:#888;font-family:monospace;">
                  ID: ${passId.slice(-12).toUpperCase()}
                </p>
              </td>
              <td style="padding:14px 16px;text-align:right;">
                <a href="${appUrl}/${locale}/tickets-wallet/${passId}"
                   style="display:inline-block;background:#1A1A2E;color:#FFFFFF;font-size:12px;font-weight:600;text-decoration:none;padding:8px 16px;border-radius:8px;">
                  Xem QR →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
        )
        .join("");

    return `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#10B981 0%,#059669 100%);padding:36px 32px;text-align:center;">
            <h1 style="margin:0;font-size:24px;color:#FFFFFF;font-weight:800;">Thanh toán thành công!</h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Vé của bạn đã sẵn sàng</p>
          </td>
        </tr>

        <!-- Order info -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Mã đơn hàng</p>
            <p style="margin:0 0 16px;font-size:16px;color:#1A1A2E;font-weight:700;font-family:monospace;">${orderNumber}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
              Xin chào <strong>${customerName}</strong>, cảm ơn bạn đã mua vé tại B.Duck Cityfuns!
            </p>
          </td>
        </tr>

        <!-- Items table -->
        <tr>
          <td style="padding:0 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:2px solid #1A1A2E;font-size:12px;color:#999;text-transform:uppercase;">Sản phẩm</td>
                <td style="padding:10px 0;border-bottom:2px solid #1A1A2E;font-size:12px;color:#999;text-transform:uppercase;text-align:right;">Thành tiền</td>
              </tr>
              ${itemRows}
              ${discountAmount > 0
            ? `<tr>
                <td style="padding:10px 0;font-size:14px;color:#10B981;">Giảm giá</td>
                <td style="padding:10px 0;font-size:14px;color:#10B981;text-align:right;">-${formatVND(discountAmount)}</td>
              </tr>`
            : ""
        }
              <tr>
                <td style="padding:14px 0;font-size:16px;color:#1A1A2E;font-weight:800;">Tổng thanh toán</td>
                <td style="padding:14px 0;font-size:18px;color:#1A1A2E;font-weight:800;text-align:right;">${formatVND(finalAmount)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tickets section -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1A1A2E;text-transform:uppercase;letter-spacing:0.5px;">
              Vé của bạn (${passIds.length} vé)
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${ticketCards}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:28px 32px;text-align:center;">
            <a href="${resultLink}"
               style="display:inline-block;background:linear-gradient(135deg,#F5C842 0%,#E5B832 100%);color:#1A1A2E;font-size:15px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:12px;">
              Xem tất cả vé →
            </a>
            <p style="margin:12px 0 0;font-size:12px;color:#999;">
              Vui lòng xuất trình mã QR tại quầy soát vé để vào cổng.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#FAFAFA;border-top:1px solid #F0F0F0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
              © ${new Date().getFullYear()} B.Duck Cityfuns Vietnam. All rights reserved.<br />
              Nếu bạn cần hỗ trợ, vui lòng liên hệ hotline: <strong>1900-xxxx</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendTicketEmail(
    params: TicketEmailParams
): Promise<boolean> {
    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: params.to,
            subject: `✅ Vé B.Duck Cityfuns — Đơn hàng ${params.orderNumber}`,
            html: buildTicketHTML(params),
        });
        console.log(
            `[email] Ticket email sent to ${params.to} for order ${params.orderNumber}`
        );
        return true;
    } catch (err) {
        console.error("[email] Failed to send ticket email:", err);
        return false;
    }
}
