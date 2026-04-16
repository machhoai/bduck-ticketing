/**
 * Welcome email — sent once when a new user registers.
 * Uses inline CSS for maximum email-client compatibility.
 */
import transporter, { FROM_ADDRESS } from "./transporter";

interface WelcomeEmailParams {
  to: string;
  displayName: string;
}

function buildWelcomeHTML(name: string): string {
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
          <td style="background:linear-gradient(135deg,#F5C842 0%,#E5B832 100%);padding:40px 32px;text-align:center;">
            <h1 style="margin:0;font-size:28px;color:#1A1A2E;font-weight:800;">🎉 Chào mừng đến B.Duck Cityfuns!</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#1A1A2E;opacity:0.8;">Welcome to B.Duck Cityfuns!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#333;line-height:1.6;">
              Xin chào <strong>${name}</strong>,
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.6;">
              Cảm ơn bạn đã đăng ký tài khoản tại <strong>B.Duck Cityfuns</strong>! 🦆
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              Bạn đã sẵn sàng khám phá thế giới vui nhộn của B.Duck. 
              Mua vé, theo dõi đơn hàng và nhận các ưu đãi đặc biệt chỉ dành cho thành viên.
            </p>

            <!-- CTA Button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:16px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck.vn"}"
                     style="display:inline-block;background:#1A1A2E;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                    Khám phá ngay →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 32px;background:#FAFAFA;border-top:1px solid #F0F0F0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#999;line-height:1.5;">
              © ${new Date().getFullYear()} B.Duck Cityfuns Vietnam. All rights reserved.<br />
              Email này được gửi tự động, vui lòng không trả lời.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail({
  to,
  displayName,
}: WelcomeEmailParams): Promise<void> {
  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject: "🎉 Chào mừng đến B.Duck Cityfuns!",
      html: buildWelcomeHTML(displayName),
    });
    console.log(`[email] Welcome email sent to ${to}`);
  } catch (err) {
    // Non-blocking — never fail the registration because of email
    console.error("[email] Failed to send welcome email:", err);
  }
}
