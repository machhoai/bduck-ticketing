/**
 * Ticket confirmation email — sent when payment is successful.
 * Contains order summary, inline QR code images (CID attachments), and CTAs.
 *
 * QR Code strategy — CID (Content-ID) inline attachment:
 *  - QR PNG is generated server-side via `qrcode` npm package → Buffer.
 *  - Each pass gets its own CID attachment: cid:ticket_qr_0, cid:ticket_qr_1, etc.
 *  - Referenced in HTML as <img src="cid:ticket_qr_0">.
 *  - Works with Gmail, Outlook, Apple Mail, Brevo, SendGrid, and all major clients.
 *
 * Why NOT SVG:
 *  - Gmail, Outlook, and most email clients strip <svg> tags for security.
 * Why NOT base64 data URI:
 *  - Brevo and many SMTP relays strip data: URIs for security reasons.
 */
import QRCode from "qrcode";
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

/**
 * Generate a QR code PNG buffer for a pass.
 * Attached as a CID inline attachment — not embedded as SVG or data URI.
 */
async function buildQrBuffer(passId: string): Promise<Buffer> {
    const qrValue = `${passId}`;
    return QRCode.toBuffer(qrValue, {
        errorCorrectionLevel: "H",
        width: 200,
        margin: 2,
        color: {
            dark: "#1A1A2E",
            light: "#FFFFFF",
        },
    });
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.citfuns.joyworld.vn";
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
        <td style="padding:10px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFB;border:1px solid #E8ECF0;border-radius:12px;overflow:hidden;">
            <!-- Ticket header -->
            <tr>
              <td colspan="2" style="padding:14px 16px 8px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <p style="margin:0 0 2px;font-size:14px;font-weight:700;color:#1A1A2E;">
                        🎟️ Vé ${index + 1} / ${passIds.length}
                      </p>
                      <p style="margin:0;font-size:11px;color:#888;font-family:monospace;letter-spacing:0.5px;">
                        MÃ VÉ: ${passId.slice(-12).toUpperCase()}
                      </p>
                    </td>
                    <td style="margin-left: 20px; text-align:right;vertical-align:middle;">
                      <span style="display:inline-block;background:#10B981;color:#FFFFFF;font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;">
                        ✓ Hợp lệ
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- QR Code (CID inline image) -->
            <tr>
              <td colspan="2" style="padding:16px;text-align:center;border-top:1px dashed #E0E0E0;">
                <div style="display:inline-block;padding:10px;background:#FFFFFF;border:2px solid #F5C842;border-radius:12px;">
                  <img src="cid:ticket_qr_${index}"
                       alt="QR Code ${passId.slice(-12).toUpperCase()}"
                       width="200"
                       height="200"
                       style="display:block;" />
                </div>
                <p style="margin:10px 0 0;font-size:11px;color:#999;">
                  Xuất trình mã QR này tại quầy soát vé để vào cổng
                </p>
              </td>
            </tr>
            <!-- View online link -->
            <tr>
              <td colspan="2" style="padding:0 16px 14px;text-align:center;">
                <a href="${appUrl}/${locale}/tickets-wallet/${passId}"
                   style="display:inline-block;background:#1A1A2E;color:#FFFFFF;font-size:12px;font-weight:600;text-decoration:none;padding:8px 24px;border-radius:8px;">
                  Xem chi tiết vé →
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
            <h1 style="margin:0;font-size:20px;color:#FFFFFF;font-weight:800;">Thanh toán thành công!</h1>
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
                <td style="padding:10px 0;font-size:16px;color:#1A1A2E;font-weight:800;">Tổng thanh toán</td>
                <td style="padding:4px 0;font-size:18px;color:#1A1A2E;font-weight:800;text-align:right;">${formatVND(finalAmount)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tickets section with QR codes -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1A1A2E;text-transform:uppercase;letter-spacing:0.5px;">
              🎟️ Vé của bạn (${passIds.length} vé)
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
              Nếu bạn cần hỗ trợ, vui lòng liên hệ hotline: <strong>096 9271 737</strong>
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
        // Generate QR PNG buffers for all passes in parallel
        const qrBuffers = await Promise.all(
            params.passIds.map((id) => buildQrBuffer(id))
        );

        // Build CID attachments — one per pass
        const attachments = qrBuffers.map((buffer, index) => ({
            filename: `ticket-qr-${index + 1}.png`,
            content: buffer,
            cid: `ticket_qr_${index}`,           // matches src="cid:ticket_qr_0" in HTML
            contentType: "image/png" as const,
            contentDisposition: "inline" as const,
        }));

        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: params.to,
            subject: `✅ Vé B.Duck Cityfuns — Đơn hàng ${params.orderNumber}`,
            html: buildTicketHTML(params),
            attachments,
        });

        console.log(
            `[email] Ticket email sent to ${params.to} for order ${params.orderNumber} (${params.passIds.length} QR codes attached)`
        );
        return true;
    } catch (err) {
        console.error("[email] Failed to send ticket email:", err);
        return false;
    }
}
