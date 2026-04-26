/**
 * Voucher notification email — sent after deal vouchers are successfully issued.
 * Informs the customer about the gift voucher(s) they received with their purchase.
 *
 * For event_gacha vouchers: shows the gacha link/instructions.
 * For standard vouchers: shows the voucher code and expiry.
 */
import transporter, { FROM_ADDRESS } from "./transporter";

export interface IssuedVoucherInfo {
    templateName: string;
    voucherType: "standard" | "event_gacha";
    /** Standard vouchers: actual code. Gacha: internal reference. */
    code: string;
    /** Expiry date string (ISO) — only for standard vouchers */
    expiresAt?: string;
    /** Event gacha: spins remaining */
    gachaSpinsRemaining?: number;
    /** Event gacha: user message from API */
    gachaMessage?: string;
    /** Event gacha: URL to play */
    gachaPlayUrl?: string;
}

interface VoucherEmailParams {
    to: string;
    customerName: string;
    orderNumber: string;
    vouchers: IssuedVoucherInfo[];
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function buildVoucherCard(v: IssuedVoucherInfo, index: number): string {
    if (v.voucherType === "event_gacha") {
        return `
      <tr>
        <td style="padding:8px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#FFF7ED 0%,#FFFBEB 100%);border:1px solid #FDE68A;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#92400E;">
                        🎰 Voucher ${index + 1}: ${v.templateName}
                      </p>
                      <p style="margin:0;font-size:13px;color:#B45309;line-height:1.5;">
                        ${v.gachaMessage || "Bạn đã được đăng ký tham gia Event Gacha!"}
                      </p>
                      ${v.gachaSpinsRemaining !== undefined ? `
                        <p style="margin:8px 0 0;font-size:12px;color:#78350F;">
                          🎡 Số lượt quay còn lại: <strong>${v.gachaSpinsRemaining}</strong>
                        </p>
                      ` : ""}
                    </td>
                  </tr>
                  ${v.gachaPlayUrl ? `
                  <tr>
                    <td style="padding-top:12px;">
                      <a href="${v.gachaPlayUrl}"
                         style="display:inline-block;background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);color:#FFFFFF;font-size:13px;font-weight:700;text-decoration:none;padding:10px 28px;border-radius:8px;">
                        🎮 Chơi ngay →
                      </a>
                    </td>
                  </tr>
                  ` : ""}
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    }

    // Standard voucher
    return `
      <tr>
        <td style="padding:8px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#ECFDF5 0%,#F0FDF4 100%);border:1px solid #A7F3D0;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:16px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#065F46;">
                  🎁 Voucher ${index + 1}: ${v.templateName}
                </p>
                <table cellpadding="0" cellspacing="0" style="margin:8px 0;">
                  <tr>
                    <td style="background:#FFFFFF;border:2px dashed #10B981;border-radius:8px;padding:10px 24px;">
                      <p style="margin:0;font-size:20px;font-weight:800;color:#059669;font-family:monospace;letter-spacing:2px;">
                        ${v.code}
                      </p>
                    </td>
                  </tr>
                </table>
                ${v.expiresAt ? `
                  <p style="margin:0;font-size:12px;color:#6B7280;">
                    ⏰ Hiệu lực đến: <strong>${formatDate(v.expiresAt)}</strong>
                  </p>
                ` : ""}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
}

function buildVoucherHTML(params: VoucherEmailParams): string {
    const { customerName, orderNumber, vouchers } = params;

    const voucherCards = vouchers.map((v, i) => buildVoucherCard(v, i)).join("");

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
          <td style="background:linear-gradient(135deg,#F59E0B 0%,#D97706 100%);padding:36px 32px;text-align:center;">
            <h1 style="margin:0;font-size:20px;color:#FFFFFF;font-weight:800;">🎁 Bạn nhận được voucher!</h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Quà tặng từ đơn hàng ${orderNumber}</p>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 4px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Mã đơn hàng</p>
            <p style="margin:0 0 16px;font-size:16px;color:#1A1A2E;font-weight:700;font-family:monospace;">${orderNumber}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
              Xin chào <strong>${customerName}</strong>, bạn vừa nhận được <strong>${vouchers.length}</strong> voucher quà tặng kèm đơn hàng tại B.Duck Cityfuns!
            </p>
          </td>
        </tr>

        <!-- Voucher cards -->
        <tr>
          <td style="padding:0 32px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1A1A2E;text-transform:uppercase;letter-spacing:0.5px;">
              🎫 Voucher của bạn
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${voucherCards}
            </table>
          </td>
        </tr>

        <!-- Notice -->
        <tr>
          <td style="padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:12px;">
              <tr>
                <td style="padding:14px 16px;">
                  <p style="margin:0;font-size:13px;color:#0369A1;line-height:1.5;">
                    💡 <strong>Lưu ý:</strong> Vui lòng lưu lại mã voucher. Mỗi mã chỉ được sử dụng một lần.
                    Xuất trình mã voucher tại quầy dịch vụ B.Duck Cityfuns để sử dụng.
                  </p>
                </td>
              </tr>
            </table>
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

export async function sendVoucherNotificationEmail(
    params: VoucherEmailParams
): Promise<boolean> {
    if (!params.vouchers.length) return true; // nothing to send

    try {
        await transporter.sendMail({
            from: FROM_ADDRESS,
            to: params.to,
            subject: `🎁 Voucher quà tặng — Đơn hàng ${params.orderNumber}`,
            html: buildVoucherHTML(params),
        });

        console.log(
            `[email] Voucher notification sent to ${params.to} for order ${params.orderNumber} (${params.vouchers.length} vouchers)`
        );
        return true;
    } catch (err) {
        console.error("[email] Failed to send voucher notification:", err);
        return false;
    }
}
