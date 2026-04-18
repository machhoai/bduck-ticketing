/**
 * Affiliate notification emails:
 * - sendAffiliateApprovalEmail: sent when admin approves, includes auto-created credentials
 * - sendAffiliateRejectionEmail: sent when admin rejects, includes reason
 */
import transporter, { FROM_ADDRESS } from "./transporter";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck-ticketing.vercel.app";

// ─── Approval Email ───────────────────────────────────────────────────────────
export interface AffiliateApprovalEmailParams {
  to: string;
  displayName: string;
  email: string;
  tempPassword: string;
  referralCode: string;
  trackingLink: string;
  commissionRate: number; // 0–1
}

function buildApprovalHTML(p: AffiliateApprovalEmailParams): string {
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
          <td style="background:linear-gradient(135deg,#F5C842 0%,#E5830A 100%);padding:40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:48px;">🎉</p>
            <h1 style="margin:0;font-size:26px;color:#1A1A2E;font-weight:800;">Chúc mừng! Bạn đã được duyệt làm Affiliate</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#1A1A2E;opacity:0.75;">B.Duck Cityfuns Affiliate Program</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#333;line-height:1.6;">
              Xin chào <strong>${p.displayName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
              Đơn đăng ký Affiliate của bạn đã được <strong>phê duyệt</strong>! 
              Chúng tôi đã tạo tài khoản cho bạn với thông tin đăng nhập bên dưới.
            </p>

            <!-- Credentials Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F7F4;border:1px solid #E8E5E0;border-radius:12px;margin:0 0 24px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#999;letter-spacing:1px;text-transform:uppercase;">Thông tin đăng nhập</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #EDEDE9;">
                        <span style="font-size:13px;color:#888;">Email</span>
                      </td>
                      <td style="padding:8px 0;border-bottom:1px solid #EDEDE9;text-align:right;">
                        <strong style="font-size:14px;color:#1A1A2E;">${p.email}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <span style="font-size:13px;color:#888;">Mật khẩu tạm thời</span>
                      </td>
                      <td style="padding:8px 0;text-align:right;">
                        <strong style="font-size:16px;color:#E5830A;font-family:monospace;letter-spacing:2px;">${p.tempPassword}</strong>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:12px 0 0;font-size:12px;color:#F05A28;">
                    ⚠️ Vui lòng đổi mật khẩu ngay sau khi đăng nhập lần đầu.
                  </p>
                </td>
              </tr>
            </table>

            <!-- Affiliate Info Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9E6;border:1px solid #F5C842;border-radius:12px;margin:0 0 28px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#B8860B;letter-spacing:1px;text-transform:uppercase;">Thông tin Affiliate của bạn</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #F5E08A;">
                        <span style="font-size:13px;color:#888;">Referral Code</span>
                      </td>
                      <td style="padding:8px 0;border-bottom:1px solid #F5E08A;text-align:right;">
                        <strong style="font-size:15px;color:#1A1A2E;font-family:monospace;">${p.referralCode}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;border-bottom:1px solid #F5E08A;">
                        <span style="font-size:13px;color:#888;">Hoa hồng</span>
                      </td>
                      <td style="padding:8px 0;border-bottom:1px solid #F5E08A;text-align:right;">
                        <strong style="font-size:15px;color:#1A1A2E;">${(p.commissionRate * 100).toFixed(0)}% / đơn hàng</strong>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:8px 0;">
                        <span style="font-size:13px;color:#888;">Tracking link</span>
                      </td>
                      <td style="padding:8px 0;text-align:right;">
                        <a href="${p.trackingLink}" style="font-size:12px;color:#E5830A;word-break:break-all;">${p.trackingLink}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:8px 0;">
                  <a href="${APP_URL}/affiliate"
                     style="display:inline-block;background:#1A1A2E;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:12px;">
                    Truy cập Affiliate Portal →
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

export async function sendAffiliateApprovalEmail(
  params: AffiliateApprovalEmailParams
): Promise<void> {
  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: params.to,
      subject: "🎉 Đơn Affiliate của bạn đã được duyệt — B.Duck Cityfuns",
      html: buildApprovalHTML(params),
    });
    console.log(`[email] Affiliate approval email sent to ${params.to}`);
  } catch (err) {
    console.error("[email] Failed to send affiliate approval email:", err);
    throw err; // Re-throw so admin sees failure
  }
}

// ─── Rejection Email ──────────────────────────────────────────────────────────
export interface AffiliateRejectionEmailParams {
  to: string;
  displayName: string;
  reason: string;
}

function buildRejectionHTML(p: AffiliateRejectionEmailParams): string {
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
          <td style="background:#F8F7F4;border-bottom:3px solid #E8E5E0;padding:40px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:40px;">📋</p>
            <h1 style="margin:0;font-size:22px;color:#1A1A2E;font-weight:800;">Kết quả xét duyệt đơn Affiliate</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#888;">B.Duck Cityfuns Affiliate Program</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#333;line-height:1.6;">
              Xin chào <strong>${p.displayName}</strong>,
            </p>
            <p style="margin:0 0 20px;font-size:15px;color:#555;line-height:1.6;">
              Cảm ơn bạn đã quan tâm đến Chương trình Affiliate của B.Duck Cityfuns.
              Sau khi xem xét kỹ lưỡng, chúng tôi rất tiếc phải thông báo rằng đơn đăng ký của bạn
              <strong>chưa được chấp thuận</strong> lần này.
            </p>

            <!-- Reason Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF5F5;border:1px solid #FFCCCC;border-radius:12px;margin:0 0 24px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#CC4444;letter-spacing:1px;text-transform:uppercase;">Lý do từ chối</p>
                  <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">${p.reason}</p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 28px;font-size:14px;color:#777;line-height:1.7;">
              Bạn có thể nộp đơn lại sau khi đã cải thiện các yếu tố trên. 
              Nếu có thắc mắc, hãy liên hệ với chúng tôi qua email hỗ trợ.
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${APP_URL}/affiliate/apply"
                     style="display:inline-block;background:#1A1A2E;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:12px;">
                    Nộp đơn lại →
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

export async function sendAffiliateRejectionEmail(
  params: AffiliateRejectionEmailParams
): Promise<void> {
  try {
    await transporter.sendMail({
      from: FROM_ADDRESS,
      to: params.to,
      subject: "Kết quả xét duyệt đơn Affiliate — B.Duck Cityfuns",
      html: buildRejectionHTML(params),
    });
    console.log(`[email] Affiliate rejection email sent to ${params.to}`);
  } catch (err) {
    console.error("[email] Failed to send affiliate rejection email:", err);
    throw err;
  }
}
