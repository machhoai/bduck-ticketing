/**
 * Counter Order Confirmation Email
 * Sent immediately after a customer places an order with "Pay at Counter" method.
 *
 * QR Code strategy — CID (Content-ID) inline attachment:
 *  - QR PNG is generated server-side via `qrcode` npm package → Buffer.
 *  - Attached as a MIME inline attachment with cid="counter_qr".
 *  - Referenced in HTML as <img src="cid:counter_qr">.
 *  - Works with Brevo, SendGrid, Mailgun, and all major email clients
 *    because it travels as part of the MIME message (no external request,
 *    no base64-stripping by SMTP relays).
 *
 * Why NOT base64 data URI:
 *  - Brevo and many other SMTP relays strip data: URIs for security reasons.
 * Why NOT Google Charts API:
 *  - Images are blocked by default in Gmail / Outlook.
 */
import QRCode from "qrcode";
import transporter, { FROM_ADDRESS } from "./transporter";

interface CounterOrderItem {
    productName: string;
    productType: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

export interface CounterOrderEmailParams {
    to: string;
    customerName: string;
    orderId: string;
    orderNumber: string;
    orderCode: string; // e.g. "BDK-A3F9X2"
    items: CounterOrderItem[];
    finalAmount: number;
    discountAmount: number;
    expiresAt: Date; // 24h from createdAt
    locale?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVND(amount: number): string {
    return new Intl.NumberFormat("vi-VN").format(amount) + " &#x20AB;";
}

function formatExpiry(date: Date, locale: string): string {
    return date.toLocaleString(locale === "vi" ? "vi-VN" : "en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
}

// ─── QR Buffer ────────────────────────────────────────────────────────────────

/**
 * Generates a QR code PNG buffer.
 * Attached as a CID inline attachment — not embedded as a data URI.
 */
async function buildQrBuffer(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, {
        errorCorrectionLevel: "H",
        width: 260,
        margin: 2,
        color: {
            dark: "#1A1A2E",
            light: "#FFFFFF",
        },
    });
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildCounterOrderHTML(params: CounterOrderEmailParams): string {
    const {
        customerName,
        orderNumber,
        orderCode,
        items,
        finalAmount,
        discountAmount,
        orderId,
        expiresAt,
        locale = "vi",
    } = params;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck.vn";
    const resultLink = `${appUrl}/${locale}/checkout/result?orderId=${orderId}`;
    const ordersLink = `${appUrl}/${locale}/orders`;
    const expiryFormatted = formatExpiry(expiresAt, locale);

    const itemRows = items
        .map(
            (item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;font-size:14px;color:#333;">
          ${item.productName}
          <br /><span style="font-size:12px;color:#999;">${item.productType === "combo" ? "Combo" : "Ve"} x ${item.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #F0F0F0;font-size:14px;color:#333;text-align:right;font-weight:600;">
          ${formatVND(item.subtotal)}
        </td>
      </tr>`
        )
        .join("");

    const stepsHtml = [
        {
            n: "1",
            text: `Mang ma QR (hoac ma so <strong>${orderCode}</strong>) den quay thu ngan B.Duck Cityfuns`,
        },
        {
            n: "2",
            text: "Nhan vien se quet ma va hien thi thong tin don hang",
        },
        {
            n: "3",
            text: "Thanh toan truc tiep &mdash; ve dien tu se duoc gui qua email ngay sau do",
        },
    ]
        .map(
            (s) => `
      <table cellpadding="0" cellspacing="0" style="margin-bottom:10px;width:100%;">
        <tr>
          <td style="width:28px;vertical-align:top;">
            <span style="display:inline-block;width:22px;height:22px;background:#F5C842;border-radius:50%;text-align:center;line-height:22px;font-size:12px;font-weight:800;color:#1A1A2E;">${s.n}</span>
          </td>
          <td style="font-size:13px;color:#555;line-height:1.5;padding-left:8px;">${s.text}</td>
        </tr>
      </table>`
        )
        .join("");

    return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:#1A1A2E;padding:36px 32px;text-align:center;">
            <h1 style="margin:0;font-size:22px;color:#F5C842;font-weight:800;">Dat hang thanh cong!</h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.75);">
              Vui long mang ma QR den quay thu ngan de thanh toan &amp; nhan ve
            </p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Ma don hang</p>
            <p style="margin:0 0 16px;font-size:16px;color:#1A1A2E;font-weight:700;font-family:monospace;">${orderNumber}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
              Xin chao <strong>${customerName}</strong>,<br />
              Don hang cua ban da duoc ghi nhan. Ve se duoc phat hanh ngay sau khi nhan vien xac nhan thanh toan tai quay.
            </p>
          </td>
        </tr>

        <!-- QR Code block (CID inline image) -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#1A1A2E;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:28px 24px;text-align:center;">
                  <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">
                    Ma thanh toan tai quay
                  </p>

                  <!-- CID reference — nodemailer resolves this to the attached PNG -->
                  <div style="display:inline-block;background:#FFFFFF;border-radius:12px;padding:12px;margin-bottom:16px;">
                    <img src="cid:counter_qr"
                         alt="QR Code ${orderCode}"
                         width="260"
                         height="260"
                         style="display:block;" />
                  </div>

                  <p style="margin:0;font-size:24px;color:#F5C842;font-weight:900;letter-spacing:0.2em;font-family:'Courier New',Courier,monospace;">
                    ${orderCode}
                  </p>
                  <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.5);">
                    Quet ma QR hoac doc ma so tai quay thu ngan
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Amount due -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#FFFBEB;border:2px solid #F5C842;border-radius:12px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#B45309;text-transform:uppercase;letter-spacing:0.5px;">
                    So tien can thanh toan tai quay
                  </p>
                  <p style="margin:0;font-size:28px;font-weight:900;color:#1A1A2E;">
                    ${formatVND(finalAmount)}
                  </p>
                  ${discountAmount > 0 ? `<p style="margin:4px 0 0;font-size:13px;color:#059669;">Da giam ${formatVND(discountAmount)}</p>` : ""}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Order items -->
        <tr>
          <td style="padding:0 32px 24px;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">
              Chi tiet don hang
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:2px solid #1A1A2E;font-size:12px;color:#999;text-transform:uppercase;">San pham</td>
                <td style="padding:10px 0;border-bottom:2px solid #1A1A2E;font-size:12px;color:#999;text-transform:uppercase;text-align:right;">Thanh tien</td>
              </tr>
              ${itemRows}
              ${discountAmount > 0 ? `
              <tr>
                <td style="padding:10px 0;font-size:14px;color:#059669;">Giam gia</td>
                <td style="padding:10px 0;font-size:14px;color:#059669;text-align:right;">-${formatVND(discountAmount)}</td>
              </tr>` : ""}
              <tr>
                <td style="padding:14px 0;font-size:15px;color:#1A1A2E;font-weight:800;">Tong can thanh toan</td>
                <td style="padding:14px 0;font-size:17px;color:#1A1A2E;font-weight:900;text-align:right;">${formatVND(finalAmount)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Steps -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#F8F6F0;border-radius:12px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#1A1A2E;text-transform:uppercase;letter-spacing:0.5px;">
                    Huong dan 3 buoc
                  </p>
                  ${stepsHtml}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Expiry warning -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;">
              <tr>
                <td style="padding:14px 18px;font-size:13px;color:#92400E;line-height:1.5;">
                  <strong>Luu y:</strong> Don hang co hieu luc den <strong>${expiryFormatted}</strong>.
                  Neu ban khong den thanh toan trong thoi han nay, don hang se bi tu dong huy.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="${resultLink}"
               style="display:inline-block;background:#F5C842;color:#1A1A2E;font-size:14px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;margin-bottom:12px;">
              Mo trang QR day du &rarr;
            </a>
            <br />
            <a href="${ordersLink}"
               style="font-size:13px;color:#888;text-decoration:underline;">
              Xem lich su don hang
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#FAFAFA;border-top:1px solid #F0F0F0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
              &copy; ${new Date().getFullYear()} B.Duck Cityfuns Vietnam. All rights reserved.<br />
              Neu ban can ho tro, vui long lien he hotline: <strong>1900-xxxx</strong>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Send Function ────────────────────────────────────────────────────────────

export async function sendCounterOrderEmail(
    params: CounterOrderEmailParams
): Promise<boolean> {
    try {
        // Generate QR as PNG buffer — attached as CID inline, not data URI
        const qrBuffer = await buildQrBuffer(params.orderCode);

        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: params.to,
            subject: `B.Duck Cityfuns - Dat cho thanh cong, vui long thanh toan tai quay (${params.orderCode})`,
            html: buildCounterOrderHTML(params),
            attachments: [
                {
                    filename: "qr-code.png",
                    content: qrBuffer,
                    cid: "counter_qr",          // <-- matches src="cid:counter_qr" in HTML
                    contentType: "image/png",
                    contentDisposition: "inline",
                },
            ],
        });

        console.log(
            `[email] Counter order email sent to ${params.to} — orderCode: ${params.orderCode}`
        );
        return true;
    } catch (err) {
        console.error("[email] Failed to send counter order email:", err);
        return false;
    }
}
