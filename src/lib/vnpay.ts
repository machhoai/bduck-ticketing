import "server-only";
import crypto from "crypto";

// ─── VNPay Server-Side Utilities ──────────────────────────────────────────────
// Follows VNPay API v2.1.0 specification.
// Reference: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html

export interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  vnpUrl: string;
  returnUrl: string;
}

/**
 * Lazily load VNPay config from environment variables.
 * Throws if required vars are missing.
 */
export function getVNPayConfig(): VNPayConfig {
  const tmnCode = process.env.VNPAY_TMN_CODE;
  const hashSecret = process.env.VNPAY_HASH_SECRET;
  const vnpUrl = process.env.VNPAY_URL;
  const returnUrl = process.env.VNPAY_RETURN_URL;

  if (!tmnCode || !hashSecret || !vnpUrl || !returnUrl) {
    throw new Error(
      "[VNPay] Missing env vars: VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL, or VNPAY_RETURN_URL"
    );
  }

  return { tmnCode, hashSecret, vnpUrl, returnUrl };
}

// ─── Helper: Sort object keys alphabetically ─────────────────────────────────

function sortObject(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  const str: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (let i = 0; i < str.length; i++) {
    const key = str[i];
    // Find original key by decoding (or use obj direct if we encoded correctly, but standard is using original key)
    // Wait, the official sample uses obj[str[key]], but str[key] is the ENCODED key!
    // If the key has special chars, obj[str[i]] would be undefined.
    // Let's look at the official sample carefully:
    // str.push(encodeURIComponent(key)); ... sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    // The official sample is slightly buggy if the key contains chars that get encoded. But VNPay keys never contain special chars (they are vnp_Amount, vnp_Command, etc).
    // So obj[str[i]] works because str[i] === originalKey for VNPay fields.
    // For safety, we should find the original key.
    const originalKey = decodeURIComponent(key);
    if (obj[originalKey] !== undefined) {
      sorted[key] = encodeURIComponent(obj[originalKey]).replace(/%20/g, "+");
    }
  }
  return sorted;
}

// ─── Helper: Format date as yyyyMMddHHmmss (GMT+7) ──────────────────────────

function formatVNPayDate(date: Date): string {
  // Convert to GMT+7
  const vnTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(vnTime.getUTCDate()).padStart(2, "0");
  const hours = String(vnTime.getUTCHours()).padStart(2, "0");
  const minutes = String(vnTime.getUTCMinutes()).padStart(2, "0");
  const seconds = String(vnTime.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// ─── Create Payment URL ──────────────────────────────────────────────────────

export interface CreatePaymentUrlParams {
  /** Mã tham chiếu đơn hàng (unique trong ngày) */
  vnpTxnRef: string;
  /** Số tiền thanh toán (VND, chưa nhân 100) */
  amount: number;
  /** Mô tả nội dung thanh toán (tiếng Việt không dấu, không ký tự đặc biệt) */
  orderInfo: string;
  /** IP của khách hàng */
  ipAddr: string;
  /** Ngôn ngữ giao diện: "vn" | "en" */
  locale?: string;
  /** Mã ngân hàng — bỏ trống để VNPay hiển thị danh sách ngân hàng */
  bankCode?: string;
  /** Mã loại hàng hóa — mặc định "other" */
  orderType?: string;
}

/**
 * Build a VNPay payment URL following v2.1.0 specification.
 *
 * Key points:
 * - Params sorted alphabetically (ksort) before checksum
 * - Amount multiplied by 100 (strip decimals)
 * - HMAC-SHA512 checksum using vnp_HashSecret
 * - Date format: yyyyMMddHHmmss in GMT+7
 */
export function createPaymentUrl(params: CreatePaymentUrlParams): string {
  const config = getVNPayConfig();
  const now = new Date();

  const vnpParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: String(params.amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: params.vnpTxnRef,
    vnp_OrderInfo: params.orderInfo,
    vnp_OrderType: params.orderType ?? "other",
    vnp_Locale: params.locale ?? "vn",
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: params.ipAddr,
    vnp_CreateDate: formatVNPayDate(now),
    vnp_ExpireDate: formatVNPayDate(
      new Date(now.getTime() + 15 * 60 * 1000) // +15 minutes
    ),
  };

  if (params.bankCode) {
    vnpParams.vnp_BankCode = params.bankCode;
  }

  // Sort params alphabetically
  const sorted = sortObject(vnpParams);

  // Build query string — VNPay requires NO URL encoding (encode: false)
  // Both signData and URL use the same raw format per official VNPay Node.js sample
  const queryString = Object.entries(sorted)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // HMAC-SHA512 checksum
  const hmac = crypto.createHmac("sha512", config.hashSecret);
  const signed = hmac.update(Buffer.from(queryString, "utf-8")).digest("hex");

  return `${config.vnpUrl}?${queryString}&vnp_SecureHash=${signed}`;
}

// ─── Verify Checksum from VNPay Callback ─────────────────────────────────────

export interface VNPayReturnData {
  vnp_TmnCode: string;
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_PayDate?: string;
  vnp_OrderInfo: string;
  vnp_TransactionNo: string;
  vnp_ResponseCode: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  [key: string]: string | undefined;
}

/**
 * Verify the HMAC-SHA512 checksum from VNPay callback data.
 * Works for both IPN URL and Return URL callbacks.
 *
 * Steps:
 * 1. Extract vnp_SecureHash from params
 * 2. Remove vnp_SecureHash and vnp_SecureHashType from params
 * 3. Sort remaining params alphabetically
 * 4. Build sign data string
 * 5. Compare HMAC-SHA512 hash
 *
 * @returns true if checksum is valid
 */
export function verifyChecksum(
  params: Record<string, string | string[] | undefined>
): boolean {
  const config = getVNPayConfig();

  const secureHash = params.vnp_SecureHash as string;
  if (!secureHash) return false;

  // Clone and remove hash fields
  const vnpParams: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (
      key !== "vnp_SecureHash" &&
      key !== "vnp_SecureHashType" &&
      value !== undefined &&
      typeof value === "string"
    ) {
      vnpParams[key] = value;
    }
  }

  // Sort alphabetically
  const sorted = sortObject(vnpParams);

  // Build sign data
  const signData = Object.entries(sorted)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // Compute HMAC-SHA512
  const hmac = crypto.createHmac("sha512", config.hashSecret);
  const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(secureHash, "hex"),
      Buffer.from(signed, "hex")
    );
  } catch {
    // If buffers have different lengths, timingSafeEqual throws
    return secureHash === signed;
  }
}

/**
 * Parse query string params from a URLSearchParams into a flat Record.
 */
export function parseVNPayParams(
  searchParams: URLSearchParams
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    result[key] = value;
  }
  return result;
}
