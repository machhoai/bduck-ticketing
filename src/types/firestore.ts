import type { Timestamp } from "firebase/firestore";

// ─────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────

export type ValidityType = "date-specific" | "date-range" | "open-dated";

export interface ValidityConfig {
  type: ValidityType;
  /** date-specific: exact date allowed to enter */
  specificDate?: Timestamp;
  /** date-range: number of days from purchase, e.g. 30 */
  validDaysFromPurchase?: number;
  /** optional hard deadline for any validity type */
  overallExpiresAt?: Timestamp;
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
  name: string; // e.g. "Vé lẻ", "Combo gia đình"
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

export type ProductType = "ticket" | "combo";
export type ProductStatus = "active" | "hidden" | "sold-out";

export interface FlashSaleConfig {
  salePrice: number; // VND
  startAt: Timestamp;
  endAt: Timestamp;
}

/** Document ID = auto-generated Firestore ID */
export interface ProductDocument {
  id: string;
  name: string;
  description: string;
  type: ProductType;
  price: number; // VND — original price
  thumbnailUrl: string; // Firebase Storage URL
  gallery?: string[]; // Firebase Storage URLs

  /** Admin configures at creation time; stamped onto passes at order time */
  validityConfig: ValidityConfig;

  /** Only when type = 'combo'. Displayed at gate scan for ticket exchange */
  comboItems?: ComboItem[];

  /** Managed via Firestore Transaction when order is paid */
  totalStock?: number; // undefined = unlimited
  soldCount: number;

  /**
   * Optional affiliate commission override.
   * Takes priority over affiliateProfiles.defaultCommissionRate if set.
   */
  commissionRate?: number; // e.g. 0.08 = 8%

  /**
   * Flash sale config — separate from promotions (promo codes).
   * Flash sale = automatic price override; promotions = user-entered discount code.
   * Both can be active simultaneously.
   */
  flashSale?: FlashSaleConfig;

  /** Reference to bduck_productGroups — admin assigns at product creation */
  groupId?: string;

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

export interface PaymentDetails {
  provider: "vnpay" | "mock";
  providerData: VNPayData | MockPayData;
}

export type OrderStatus = "pending" | "paid" | "cancelled";

/** Cart item passed from client → createOrder Server Action.
 *  Only productId + quantity — server re-fetches prices (D5: never trust client pricing). */
export interface CartItemInput {
  productId: string;
  quantity: number;
}

/** Document ID = auto-generated Firestore ID */
export interface OrderDocument {
  id: string;
  /** Human-readable: "BDUCK-20240412-00001" — for customer service & invoices */
  orderNumber: string;

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

  /**
   * QR code is rendered client-side from Document ID: "BDUCK-PASS-{id}"
   * using qrcode.react — no Firebase Storage needed (D2).
   */
  // Apple Wallet PKPass download — Firebase Storage URL (populated in Phase 5)
  walletPassUrl?: string;

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

