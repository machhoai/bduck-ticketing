/**
 * Shared Firestore Timestamp interface.
 *
 * Both `firebase-admin/firestore` and `firebase/firestore` expose a Timestamp
 * class with these methods, but they are defined in separate packages and
 * TypeScript treats them as incompatible nominal types when cross-referencing.
 *
 * Using this structural interface instead of importing from either SDK keeps
 * Server Actions (firebase-admin) and Client Components (firebase) compatible
 * with the same shared type definitions.
 */
export interface Timestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  isEqual(other: Timestamp): boolean;
}

// ─────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────

export type ValidityType = "date-specific" | "date-range" | "open-dated" | "time-slot";

/** 0 = Chủ nhật, 1 = Thứ 2, ..., 6 = Thứ 7 (theo JavaScript Date.getDay()) */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ValidityConfig {
  type: ValidityType;
  /** date-specific: exact date allowed to enter */
  specificDate?: Timestamp;
  /** date-range: number of days from purchase, e.g. 30 */
  validDaysFromPurchase?: number;
  /** optional hard deadline for any validity type */
  overallExpiresAt?: Timestamp;
  /** time-slot: allowed time frames to activate, e.g. "09:00" */
  timeSlotStart?: string;
  timeSlotEnd?: string;
  /**
   * time-slot: restrict to specific days of the week.
   * Uses JS Date.getDay() convention: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
   * undefined/empty = all days allowed (backward compatible).
   * e.g. [1,2,3,4,5] = Monday–Friday only.
   */
  allowedDaysOfWeek?: DayOfWeek[];
}

export interface ComboItem {
  productId: string;
  productName: string; // denormalized
  thumbnailUrl: string; // Firebase Storage URL — denormalized
  quantity: number;
}

export interface BankInfo {
  bankName: string; // e.g. "Vietcombank"
  accountNumber: string;
  accountHolderName: string;
  branch?: string;
}

// ─────────────────────────────────────────────
// bduck_productGroups
// ─────────────────────────────────────────────

/** Document ID = auto-generated Firestore ID */
export interface ProductGroupDocument {
  id: string;
  name: string; // e.g. "Vé lẻ", "Combo gia đình" — default Vietnamese, used as fallback
  /** Localized display names. Fallback chain: nameLocales[locale] -> nameLocales.vi -> name */
  nameLocales?: Record<string, string>; // e.g. { vi: "Vé lẻ", en: "Single Ticket" }
  slug: string; // e.g. "ve-le", "combo-gia-dinh" — for URL-safe tab keys
  order: number; // ascending sort for tab display
  isActive: boolean;
  createdBy: string; // admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_users
// ─────────────────────────────────────────────

export type UserRole = "customer" | "admin" | "affiliate";

export interface CustomerProfile {
  totalOrders: number;
  totalSpent: number; // VND, for future loyalty tiers
}

/** Document ID = Firebase Auth UID */
export interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string; // Firebase Storage URL

  role: UserRole;

  customerProfile?: CustomerProfile;

  fcmTokens?: string[]; // for push notifications (multi-device)

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_products
// ─────────────────────────────────────────────

export type ProductType = "ticket" | "combo" | "membership";
export type ProductStatus = "active" | "hidden" | "sold-out";

export interface FlashSaleConfig {
  salePrice: number; // VND
  startAt: Timestamp;
  endAt: Timestamp;
}

/**
 * Membership card config — only present when type = 'membership'.
 * Represents a value-loadable physical card sold online and redeemed at the store.
 */
export interface MembershipConfig {
  packageName: string;       // e.g. "Gói Bạc", "Gói Vàng"
  basePoints: number;        // points loaded = price paid (e.g. 1210)
  bonusPoints: number;       // fixed bonus gift (e.g. 385)
  merch?: string;            // physical gift text, e.g. "1 gấu bông B.Duck"
}

/** Document ID = auto-generated Firestore ID */
export interface ProductDocument {
  id: string;
  name: string; // Default Vietnamese name — used as fallback & for admin search
  description: string; // Default Vietnamese description
  /**
   * Localized display names.
   * Fallback chain: nameLocales[locale] → nameLocales["vi"] → name
   * Optional — existing products without this field use `name` directly.
   */
  nameLocales?: Record<string, string>; // e.g. { vi: "Vé vào cổng", en: "Entrance Ticket" }
  /** Localized descriptions. Same fallback chain as nameLocales. */
  descriptionLocales?: Record<string, string>;
  type: ProductType;
  price: number; // VND — original price
  thumbnailUrl: string; // Firebase Storage URL
  gallery?: string[]; // Firebase Storage URLs

  /** Admin configures at creation time; stamped onto passes at order time */
  validityConfig: ValidityConfig;

  /** Only when type = 'combo'. Displayed at gate scan for ticket exchange */
  comboItems?: ComboItem[];

  /**
   * Only when type = 'membership'.
   * Config for physical card points and perks.
   */
  membershipConfig?: MembershipConfig;

  /** Managed via Firestore Transaction when order is paid */
  totalStock?: number; // undefined = unlimited
  /** When stockEnabled, reset period for stock. undefined = no reset */
  stockResetPeriod?: "none" | "daily" | "monthly";
  soldCount: number;

  /**
   * Optional affiliate commission override.
   * Takes priority over affiliateProfiles.defaultCommissionRate if set.
   */
  commissionRate?: number; // e.g. 0.08 = 8%

  /**
   * Flash sale config — separate from deal sections.
   * Flash sale = automatic price override on the product itself.
   */
  flashSale?: FlashSaleConfig;

  /** Reference to bduck_productGroups — admin assigns at product creation */
  groupId?: string;
  /** When product is created exclusively for a deal section (mutually exclusive with groupId) */
  dealSectionId?: string;

  status: ProductStatus;
  tags?: string[]; // e.g. ['weekend', 'family', 'vip']

  createdBy: string; // admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_promotions
// ─────────────────────────────────────────────

export type PromotionType = "percentage" | "fixed";
export type PromotionStatus = "active" | "inactive" | "expired";

/** Document ID = auto-generated Firestore ID */
export interface PromotionDocument {
  id: string;
  code: string; // UPPERCASE unique — indexed
  name: string; // internal name
  description?: string; // shown to customer

  type: PromotionType;
  discountValue: number;
  // percentage → e.g. 10 = 10% off
  // fixed      → e.g. 50000 = 50,000 VND off

  minOrderValue?: number;
  maxDiscountAmount?: number; // cap for percentage discounts

  /** null/undefined = applies to all products */
  applicableProductIds?: string[];

  /** Updated via Firestore Transaction when order is paid */
  maxUses: number;
  usedCount: number;
  /** Enforced by querying orders — no userId array to prevent document bloat */
  maxUsesPerUser?: number;

  startAt?: Timestamp;
  endAt?: Timestamp;

  status: PromotionStatus;

  createdBy: string; // admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_orders
// ─────────────────────────────────────────────

/** Full snapshot of a cart item at purchase time — immutable history */
export interface OrderItem {
  productId: string;
  productName: string; // denormalized snapshot
  productType: ProductType;
  thumbnailUrl: string; // Firebase Storage URL — denormalized snapshot
  quantity: number;
  unitPrice: number; // VND — price at time of purchase (historical accuracy)
  subtotal: number; // unitPrice × quantity
  validityConfig: ValidityConfig; // stamped from product
  comboItems?: ComboItem[]; // stamped from product if combo

  // Deal section context — set when item comes from a deal section
  isDealItem?: boolean;
  dealSectionId?: string;
  dealItemId?: string;

  // Membership snapshot — set when productType = 'membership'
  membershipPoints?: number;   // base points
  bonusPoints?: number;        // effective bonus (after multiplier if deal)
  totalPoints?: number;        // membershipPoints + bonusPoints
  pointsBreakdown?: string;    // human-readable e.g. "1.210 gốc + 770 thưởng (×2)"
  merch?: string;              // physical gift
}

export interface VNPayData {
  vnpTxnRef: string; // B.Duck transaction ref sent to VNPay
  vnpTransactionNo?: string; // VNPay transaction number
  vnpResponseCode?: string; // "00" = success
  vnpBankCode?: string; // e.g. "NCB", "VCB"
  vnpPayDate?: string; // "20240412153000"
}

export interface MockPayData {
  simulatedAt: string; // ISO timestamp of mock payment
  simulateResult: "success" | "fail";
}

/**
 * Audit trail cho thanh toán tại quầy (counter).
 * Chỉ chứa thông tin xác nhận — orderCode và expiresAt nằm ở root OrderDocument.
 * confirmedBy/At được populate khi admin bấm "Xác nhận đã thanh toán";
 * khi đơn mới tạo (status=pending) hai trường này là undefined.
 */
export interface CounterPayData {
  /** Firebase Auth UID của nhân viên admin đã bấm xác nhận thu tiền */
  confirmedBy?: string;
  /** Timestamp khi nhân viên xác nhận — chỉ có sau khi status → "paid" */
  confirmedAt?: Timestamp;
  /** Ghi chú nội bộ tuỳ chọn (e.g. "Khách trả bằng MOMO ngoài") */
  note?: string;
}

/**
 * Audit trail cho thanh toán chuyển khoản ngân hàng (bank transfer).
 * qrDescription được sinh khi tạo đơn; approvedBy/At populated khi admin duyệt.
 */
export interface BankTransferPayData {
  /** Nội dung chuyển khoản trên mã QR — DDMMYYHHmm + amount/1000 + random 4-char */
  qrDescription: string;
  /** Firebase Auth UID admin đã duyệt — set khi status → "paid" */
  approvedBy?: string;
  /** Timestamp admin duyệt — set khi status → "paid" */
  approvedAt?: Timestamp;
  /** Ghi chú admin khi duyệt */
  note?: string;
}

export interface PaymentDetails {
  /**
   * "vnpay"         — tích hợp cổng VNPay (planned)
   * "mock"          — giả lập thanh toán (dev/test)
   * "counter"       — thanh toán trực tiếp tại quầy (Online-to-Offline flow)
   * "bank_transfer" — chuyển khoản ngân hàng qua QR VietQR
   * "payos"         — cổng thanh toán PayOS
   */
  provider: "vnpay" | "mock" | "counter" | "bank_transfer" | "payos";
  providerData: VNPayData | MockPayData | CounterPayData | BankTransferPayData | any;
}

export type OrderStatus = "pending" | "paid" | "cancelled";

/** Cart item passed from client → createOrder Server Action.
 *  Only productId + quantity — server re-fetches prices (D5: never trust client pricing). */
export interface CartItemInput {
  productId: string;
  quantity: number;
  /** If this item was added from a deal section, include these for server-side validation */
  dealSectionId?: string;
  dealItemId?: string;
  /** Selected option within a multi-option deal item */
  dealOptionId?: string;
}

/** Document ID = auto-generated Firestore ID */
export interface OrderDocument {
  id: string;
  /** Human-readable: "BDUCK-20240412-00001" — for customer service & invoices */
  orderNumber: string;

  // ── Counter payment fields ──────────────────────────────────────────────────
  /**
   * Mã quét ngắn tại quầy — encode thành QR Code trên UI của khách hàng.
   * Format: "BDK-XXXXXX" (6 ký tự A-Z0-9, prefix "BDK-", e.g. "BDK-A3F9X2").
   * Sinh server-side khi tạo đơn counter. UNIQUE — enforced bằng Transaction+Retry.
   * Indexed trên Firestore để Admin Panel query: where("orderCode", "==", scannedCode).
   *
   * @see D6 trong Decision Log — Firestore không có UNIQUE constraint;
   *      Server Action phải dùng Retry loop (tối đa 3 lần) để đảm bảo uniqueness.
   *
   * undefined với đơn online (vnpay / mock).
   */
  orderCode?: string; // indexed — counter orders only

  /**
   * Mã đơn hàng PayOS — dùng để query trạng thái thanh toán từ webhook PayOS.
   */
  payosOrderCode?: number; // indexed — payos orders only

  /**
   * Thời điểm đơn counter tự động bị huỷ nếu chưa thanh toán.
   * = createdAt + 24 giờ. Chỉ set khi provider = "counter".
   *
   * Cơ chế kiểm tra (MVP): lazy check tại thời điểm Admin quét mã.
   * Cloud Function scheduled có thể batch-cancel các đơn hết hạn (nice-to-have).
   *
   * undefined với đơn online (vnpay / mock).
   */
  expiresAt?: Timestamp; // counter orders only
  // ───────────────────────────────────────────────────────────────────────────

  // Customer snapshot (denormalized)
  /** Firebase Auth UID when logged in. Empty string "" for guest orders. */
  customerId: string; // indexed
  /** True when purchased without Firebase Auth login */
  isGuestOrder: boolean;
  customerEmail: string; // indexed — used for guest order lookup
  customerName: string;
  customerPhone?: string;

  /** Full snapshot at purchase time — immutable even if admin edits product */
  items: OrderItem[];

  // Pricing
  subtotal: number;
  discountAmount: number; // 0 if no promo applied
  finalAmount: number; // subtotal - discountAmount — indexed

  // Promotion (if applied)
  promotionId?: string;
  promotionCode?: string; // denormalized for display

  // Deal section (if items came from a deal section)
  dealSectionId?: string;

  // Issued vouchers generated for this order (populated post-payment)
  issuedVoucherIds?: string[]; // refs to bduck_issuedVouchers

  // Affiliate tracking
  affiliateId?: string; // resolved from referral code — indexed
  affiliateCode?: string; // raw ?ref=CODE captured from URL
  /** Locked at order paid time — immutable to protect KOL from future rate changes */
  affiliateCommissionAmount?: number; // VND

  // Payment
  status: OrderStatus;
  paymentDetails?: PaymentDetails;
  paidAt?: Timestamp;
  cancelledAt?: Timestamp;
  cancelReason?: string;

  /** Admin internal notes — visible only in admin panel */
  adminNotes?: string;
  /** Flag to prevent duplicate cancel notification emails */
  cancelEmailSent?: boolean;

  /** 2-way reference with b_passes (populated after payment confirmed) */
  passIds: string[];

  createdAt: Timestamp; // indexed
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_passes
// ─────────────────────────────────────────────

export type PassStatus = "active" | "used" | "expired" | "voided";

/**
 * Document ID = auto-generated Firestore ID = QR code payload.
 * Gate scan: getDoc('b_passes', scannedId) — single read, no query needed.
 */
export interface PassDocument {
  id: string; // = QR code content

  // 2-way reference with b_orders
  orderId: string;
  orderNumber: string; // denormalized — shown immediately at gate scan

  // Customer snapshot
  customerId: string;
  customerName: string; // denormalized
  customerEmail: string; // denormalized — for e-ticket email

  // Product snapshot — frozen at creation time
  productId: string;
  productName: string;
  productType: ProductType;
  thumbnailUrl: string; // Firebase Storage URL

  /**
   * Combo manifest — displayed at gate scan for staff to exchange physical tickets.
   * Only present when productType = 'combo'.
   */
  comboItems?: ComboItem[];

  /**
   * Validity — resolved to concrete values at order time.
   * Gate app only compares `now` vs `validUntil`, no calculation needed.
   */
  validityType: ValidityType;
  visitDate?: Timestamp; // date-specific
  validFrom?: Timestamp; // date-range: start
  validUntil?: Timestamp; // date-range & date-specific: deadline
  timeSlotStart?: string; // time-slot: start time (HH:mm)
  timeSlotEnd?: string;   // time-slot: end time (HH:mm)
  /** time-slot: allowed days of week (0=Sun..6=Sat). undefined = all days. */
  allowedDaysOfWeek?: number[];

  /**
   * QR code is rendered client-side from Document ID (raw pass.id)
   * using qrcode.react — no Firebase Storage needed (D2).
   * Legacy QR codes with "BDUCK-PASS-" prefix are still accepted by the scanner.
   */
  // Apple Wallet PKPass download — Firebase Storage URL (populated in Phase 5)
  walletPassUrl?: string;

  /**
   * Membership card data — only present when productType = 'membership'.
   * Staff sees this when scanning the pass at the store counter.
   */
  membershipPoints?: number;  // base points (= price paid / 1000)
  bonusPoints?: number;       // effective bonus after any deal multiplier
  totalPoints?: number;       // membershipPoints + bonusPoints
  pointsBreakdown?: string;   // "1.210 gốc + 770 thưởng (×2)"
  merch?: string;             // physical gift: "1 gấu bông B.Duck"

  // Gate scan tracking
  status: PassStatus;
  usedAt?: Timestamp;
  usedBy?: string; // admin UID who scanned
  voidedAt?: Timestamp;
  voidedBy?: string; // admin UID
  voidReason?: string;

  // Inherited from order
  affiliateId?: string;

  createdAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_affiliateProfiles
// ─────────────────────────────────────────────

export type AffiliateApplicationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
}

/** Document ID = Firebase Auth UID (mirrors b_users) */
export interface AffiliateProfileDocument {
  id: string; // = Firebase Auth UID

  // Mirror from b_users (denormalized for Admin dashboard)
  userId: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string; // Firebase Storage URL

  // KOL identity
  socialLinks?: SocialLinks;
  followerCount?: number;
  niche?: string; // e.g. "family", "travel", "lifestyle"
  bio?: string;

  // Application lifecycle
  applicationStatus: AffiliateApplicationStatus;
  appliedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string; // admin UID
  rejectionReason?: string;

  /**
   * Default commission rate set by admin at approval.
   * Product-level commissionRate takes priority if set on the product.
   */
  defaultCommissionRate: number; // e.g. 0.07 = 7%

  referralCode: string; // unique, e.g. "KOLDUCK01" — indexed
  trackingLink: string; // e.g. "https://bduck.vn/?ref=KOLDUCK01"

  // Stats — updated async by Cloud Function after each order paid
  totalClicks: number;
  totalConversions: number;
  totalCommissionEarned: number; // VND cumulative

  // Wallet — updated via Firestore Transaction
  walletBalance: number; // VND available to withdraw
  totalPaidOut: number; // VND total paid out

  bankInfo?: BankInfo; // filled by KOL
  bankInfoVerified: boolean; // verified by admin

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_payoutRequests
// ─────────────────────────────────────────────

export type PayoutStatus =
  | "pending" // KOL submitted request
  | "approved" // Admin approved, preparing transfer
  | "processing" // Transfer in progress
  | "completed" // Transfer successful
  | "rejected"; // Admin rejected

/** Document ID = auto-generated Firestore ID */
export interface PayoutRequestDocument {
  id: string;

  affiliateId: string; // Firebase Auth UID — indexed
  affiliateDisplayName: string; // denormalized

  /** Snapshot at request time — immutable even if KOL changes bank info later */
  bankInfoSnapshot: BankInfo;

  amount: number; // VND requested
  /** Audit trail: balance before deduction (set by Transaction) */
  walletBalanceBefore: number;

  status: PayoutStatus;

  // Admin processing
  reviewedBy?: string; // admin UID
  reviewedAt?: Timestamp;
  rejectionReason?: string;

  // Transfer evidence
  transferNote?: string;
  transferProofUrl?: string; // Firebase Storage URL — screenshot of bank transfer
  completedAt?: Timestamp;

  createdAt: Timestamp; // indexed
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_settings (Global App Settings)
// ─────────────────────────────────────────────

/** Document ID = "attractions" inside bduck_settings */
export interface AttractionsSettingsDocument {
  /** Array of Firebase Storage image URLs */
  images: string[];
  updatedAt: Timestamp;
  updatedBy: string; // admin UID
}

/** Document ID = "paymentMethods" inside bduck_settings */
export interface PaymentMethodsSettingsDocument {
  methods: PaymentMethodToggle[];
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface PaymentMethodToggle {
  /** Payment method identifier — "counter" | "bank_transfer" | "vnpay_card" etc. */
  id: string;
  enabled: boolean;
  /** Display sort order (ascending) */
  order: number;
}

/** Document ID = "bankTransfer" inside bduck_settings */
export interface BankTransferSettingsDocument {
  /** VietQR Bank ID e.g. "970436" (Vietcombank) */
  bankId: string;
  /** Bank account number */
  accountNo: string;
  /** VietQR template e.g. "compact2" */
  template: string;
  /** Account holder name (uppercase, no diacritics) */
  accountName: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ─────────────────────────────────────────────
// bduck_dealSections
// ─────────────────────────────────────────────

export type DealType = "percentage" | "fixed" | "buy1get1";

/**
 * Configures how membership bonus points are multiplied in a deal.
 * applyTo: 'bonusOnly' → only bonus points × multiplier
 * applyTo: 'totalPoints' → (basePoints + bonusPoints) × multiplier
 */
export interface DealBonusOverride {
  applyTo: "bonusOnly" | "totalPoints";
  multiplier: number; // e.g. 2 = double
}

/** Reference to a voucher template — governs how gift vouchers are distributed */
export interface GiftVoucherConfig {
  templateId: string;     // ref → bduck_voucherTemplates
  templateName: string;   // denormalized for display
  distribution: "perProduct" | "perOrder";
  // perProduct: 1 voucher issued per qty purchased
  // perOrder:   1 voucher per order regardless of qty
}

/**
 * A pricing option within a deal item (e.g. "Gói Bạc", "Gói Vàng", "Gói Kim Cương").
 * All options share the parent deal item's dealType + discountValue.
 */
export interface DealItemOption {
  id: string;           // UUID
  label: string;        // Vietnamese label, e.g. "Gói Bạc"
  labelLocales?: Record<string, string>;  // { en: "Silver Package" }
  description?: string;       // Vietnamese description for this option
  descriptionLocales?: Record<string, string>;
  originalPrice: number;      // VND — before deal discount
  effectivePrice: number;     // pre-calculated with deal discount
}

/**
 * An item inside a DealSection — embedded array (max ~20 items).
 * Can either link to an existing bduck_products document or be a standalone deal.
 */
export interface DealItemDocument {
  id: string; // client-generated UUID (not Firestore doc ID — embedded)

  /** Link to an existing bduck_products — if set, data is denormalized from product */
  linkedProductId?: string;

  name: string;
  description?: string;
  thumbnailUrl: string;
  productType: ProductType;

  /** Localized display names. Fallback chain: nameLocales[locale] → name */
  nameLocales?: Record<string, string>;
  /** Localized descriptions. Fallback chain: descriptionLocales[locale] → description */
  descriptionLocales?: Record<string, string>;

  originalPrice: number;   // VND — before deal discount (or first option's price)
  dealType: DealType;
  discountValue: number;   // percentage (0-100) or VND amount
  effectivePrice: number;  // pre-calculated: stored for display, re-validated server-side

  /**
   * Multi-option pricing — e.g. "Gói Bạc / Gói Vàng / Gói Kim Cương".
   * Each option has its own price and description but shares dealType + discountValue.
   * When present, top-level originalPrice/effectivePrice match the first option.
   * undefined = single-price item (backward compatible).
   */
  options?: DealItemOption[];

  /** Membership config — copied (denormalized) from linked product if applicable */
  membershipConfig?: MembershipConfig;
  /**
   * Override the bonus multiplier for this deal.
   * e.g. "Nhân đôi lộc" = { applyTo: 'bonusOnly', multiplier: 2 }
   */
  membershipBonusOverride?: DealBonusOverride;

  /** Gift voucher attached to this deal item */
  giftVoucher?: GiftVoucherConfig;

  /** Physical merch gift (separate from membership merch) */
  giftMerch?: string; // "1 merch B.Duck"

  /**
   * Per-deal-item stock management.
   * Independent from the linked product's stock (both are checked).
   * lastStockResetDate: "YYYY-MM-DD" — lazy daily reset (no cron needed).
   */
  totalStock?: number;                // undefined = unlimited
  stockResetPeriod?: "daily" | "none";
  /** Time of day to reset stock (matches section's dailyOpenHour/Minute) */
  stockResetHour?: number;            // 0–23
  stockResetMinute?: number;          // 0–59
  soldCount: number;
  lastStockResetDate?: string;        // "YYYY-MM-DD" for lazy daily reset

  /** Customer can purchase at most this many units per order */
  maxQtyPerOrder: number; // default 1

  isActive: boolean;
  order: number; // ascending display order
}

/** Document ID = auto-generated Firestore ID */
export interface DealSectionDocument {
  id: string;
  title: string;
  description?: string;
  badgeLabel?: string; // "🔥 Flash Deal Hè 2025"

  /**
   * Daily time gate — section items are locked before this time every day.
   * Server-side validated in createOrder(). Client shows countdown.
   * Requires TZ=Asia/Ho_Chi_Minh set in Vercel env.
   */
  dailyOpenHour?: number;   // 10 = opens at 10:00
  dailyOpenMinute?: number; // 0

  /** Section overall validity window (optional) */
  startAt?: Timestamp;
  endAt?: Timestamp;

  /**
   * Order-level constraints for deal items in this section.
   * maxPromoItemsPerOrder: total qty of ALL deal items in one order
   * maxPromoVariantsPerOrder: max number of distinct deal item types
   */
  maxPromoItemsPerOrder?: number;
  maxPromoVariantsPerOrder?: number;

  isActive: boolean;
  order: number; // ascending display order on home page

  /** Embedded deal items — max ~20 for Firestore document size safety */
  items: DealItemDocument[];

  createdBy: string; // admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_voucherTemplates
// ─────────────────────────────────────────────

export type VoucherType = "online_discount" | "instore_points" | "instore_gift" | "event_gacha";

/** Config for online_discount vouchers — works like a PromotionDocument at checkout */
export interface OnlineDiscountConfig {
  type: "percentage" | "fixed";
  value: number;               // % or VND
  minOrderValue?: number;
  maxDiscountAmount?: number;  // cap for percentage type
  applicableProductIds?: string[]; // empty = applicable to all products
}

/**
 * Config for event_gacha vouchers — calls external JoyWorld ERP API
 * to register customer and grant gacha spins.
 */
export interface EventGachaConfig {
  eventId: string;          // e.g. "m8zgdK13Z1kllXgBv3vb"
  apiBaseUrl: string;       // e.g. "https://employee.joyworld.vn"
  source?: string;          // tracking source, default "bduck_ticketing"
}

/**
 * Template that defines how generated vouchers look and behave.
 * Admin creates templates; deal sections reference them via GiftVoucherConfig.
 * Document ID = auto-generated Firestore ID.
 */
export interface VoucherTemplateDocument {
  id: string;
  name: string;         // "Voucher chơi game miễn phí"
  description?: string; // shown to customer in email/cart
  imageUrl?: string;    // Firebase Storage URL — displayed on deal card and email

  voucherType: VoucherType;

  // ── Code generation ──────────────────────────────────────────────────────
  codePrefix?: string;  // "DUCK-"
  codeSuffix?: string;  // "-VIP"
  codeLength: number;   // length of the random middle segment, e.g. 6

  // ── Validity ─────────────────────────────────────────────────────────────
  validDays: number;    // days from issue date until expiry

  // ── Type-specific config ─────────────────────────────────────────────────
  /** Only when voucherType = 'online_discount' */
  onlineDiscount?: OnlineDiscountConfig;

  /** Only when voucherType = 'instore_gift' or 'instore_points' */
  instoreDescription?: string; // "1 lượt chơi game tại khu vui chơi"
  instorePoints?: number;      // extra points to load if instore_points

  /** Only when voucherType = 'event_gacha' */
  eventGachaConfig?: EventGachaConfig;

  isActive: boolean;

  // ── Counters (updated via Firestore Transaction) ──────────────────────────
  totalIssued: number;
  totalRedeemed: number;

  createdBy: string; // admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────
// bduck_issuedVouchers
// ─────────────────────────────────────────────

export type IssuedVoucherStatus = "active" | "redeemed" | "expired";

/**
 * A single voucher instance issued to a customer.
 * Created server-side after successful payment.
 * Document ID = auto-generated Firestore ID.
 */
export interface IssuedVoucherDocument {
  id: string;

  // ── Template reference ────────────────────────────────────────────────────
  templateId: string;      // indexed → bduck_voucherTemplates
  templateName: string;    // denormalized for admin display
  voucherType: VoucherType; // denormalized for validation routing

  // ── Unique code ───────────────────────────────────────────────────────────
  /** UPPERCASE, formatted as: {prefix}{randomChars}{suffix} — UNIQUE indexed */
  code: string;

  // ── Customer snapshot ─────────────────────────────────────────────────────
  customerId?: string;    // Firebase Auth UID (empty for guest)
  customerEmail: string;  // indexed — for email send + customer lookup
  customerPhone?: string; // for in-store staff lookup
  customerName: string;

  // ── Order provenance ──────────────────────────────────────────────────────
  orderId: string;        // indexed
  orderNumber: string;    // denormalized
  dealSectionId?: string; // which deal section triggered the issuance
  dealItemId?: string;    // which deal item triggered the issuance

  // ── Validity ──────────────────────────────────────────────────────────────
  issuedAt: Timestamp;
  expiresAt: Timestamp;   // issuedAt + template.validDays

  status: IssuedVoucherStatus; // indexed

  // ── Redemption audit ──────────────────────────────────────────────────────
  redeemedAt?: Timestamp;
  /** admin UID for in-store scans; "system" for online discount auto-redeem */
  redeemedBy?: string;
  redemptionNote?: string; // optional staff note

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

