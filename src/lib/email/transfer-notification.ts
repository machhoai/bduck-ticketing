/**
 * Email notification sent to ALL admin users when a new bank transfer
 * order is created. Contains order details and a hyperlink to the
 * admin transfer orders page for approval.
 */

import { adminAuth } from "@/lib/firebase/admin";
import transporter, { FROM_ADDRESS } from "./transporter";

interface TransferNotificationParams {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
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

/**
 * Query Firebase Auth for all active admin emails.
 * Each admin receives an independent email (fire-and-forget).
 */
async function getAdminEmails(): Promise<string[]> {
  const result = await adminAuth.listUsers(1000);
  return result.users
    .filter((u) => {
      const claims = u.customClaims as { role?: string } | undefined;
      return claims?.role === "admin" && u.email && !u.disabled;
    })
    .map((u) => u.email!);
}

export async function sendTransferNotificationEmail(
  params: TransferNotificationParams
): Promise<void> {
  const adminEmails = await getAdminEmails();

  if (!adminEmails.length) {
    console.warn("[transfer-notification] No admin emails found — skipping");
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck.vn";
  const transferOrdersUrl = `${appUrl}/vi/admin/transfer-orders`;

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

  const html = `
    <div style="max-width:600px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#fff;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#FF6B00,#FF8C38);padding:24px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:20px;">🔔 Đơn chuyển khoản mới</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${params.orderNumber}</p>
      </div>

      <div style="padding:24px;">
        <div style="background:#FFF8F0;border:1px solid #FFE0B2;border-radius:8px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#E65100;">
            ${formatVND(params.finalAmount)}
          </p>
          <p style="margin:0;font-size:13px;color:#666;">
            Nội dung CK: <strong style="color:#333;">${params.qrDescription}</strong>
          </p>
        </div>

        <h3 style="margin:0 0 8px;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">
          Thông tin khách hàng
        </h3>
        <table style="width:100%;margin-bottom:20px;font-size:14px;">
          <tr>
            <td style="padding:4px 0;color:#666;">Họ tên:</td>
            <td style="padding:4px 0;color:#333;font-weight:500;">${params.customerName}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#666;">Email:</td>
            <td style="padding:4px 0;color:#333;">${params.customerEmail}</td>
          </tr>
          ${
            params.customerPhone
              ? `<tr>
                   <td style="padding:4px 0;color:#666;">SĐT:</td>
                   <td style="padding:4px 0;color:#333;">${params.customerPhone}</td>
                 </tr>`
              : ""
          }
        </table>

        <h3 style="margin:0 0 8px;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">
          Chi tiết đơn hàng
        </h3>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="border-bottom:2px solid #eee;">
              <th style="padding:8px 0;text-align:left;font-size:12px;color:#999;text-transform:uppercase;">Sản phẩm</th>
              <th style="padding:8px 0;text-align:center;font-size:12px;color:#999;text-transform:uppercase;">SL</th>
              <th style="padding:8px 0;text-align:right;font-size:12px;color:#999;text-transform:uppercase;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="text-align:center;margin-top:24px;">
          <a href="${transferOrdersUrl}"
             style="display:inline-block;background:#FF6B00;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
            Duyệt đơn hàng →
          </a>
        </div>
      </div>
    </div>
  `;

  // Fire-and-forget for each admin — independent failures
  const promises = adminEmails.map((email) =>
    transporter
      .sendMail({
        from: FROM_ADDRESS,
        to: email,
        subject: `🔔 Đơn CK mới — ${params.orderNumber} — ${formatVND(params.finalAmount)}`,
        html,
      })
      .catch((err: unknown) =>
        console.error(
          `[transfer-notification] Failed to send to ${email}:`,
          err
        )
      )
  );

  await Promise.allSettled(promises);
}
