# Firestore Schema — B.Duck Cityfuns Ticketing Platform

> **Generated via:** `@brainstorming` skill  
> **Date:** 2026-04-12  
> **Status:** ✅ Design Validated & Approved  
> **Scale Target:** Medium — < 50,000 orders/month

---

## Understanding Summary

| # | Hạng mục | Quyết định |
|---|---|---|
| 1 | **Thương hiệu** | B.Duck Cityfuns |
| 2 | **Scale** | Trung bình — < 50,000 orders/tháng |
| 3 | **Pass Validity** | Cấu hình tại `products` level bởi admin (`date-specific`, `date-range`, `open-dated`) |
| 4 | **Combo Pattern** | 1 Combo = 1 QR Pass + embedded `comboItems[]`; Individual ticket = 1 Pass riêng |
| 5 | **Payment Phase 1** | VNPay only, thiết kế extensible với discriminated union `provider` |
| 6 | **Affiliate Commission** | Hybrid: KOL default rate + Product-level override rate (product rate ưu tiên) |
| 7 | **Refund Policy** | No refund — Admin chỉ được `void` Pass |
| 8 | **QR Payload** | Document ID thuần túy (Firestore 20-char random ID) |
| 9 | **Image Storage** | Tất cả assets upload lên Firebase Storage; Firestore chỉ lưu download URL |
| 10 | **Collection Naming** | Prefix `b_` để tách biệt với ERP collections trong cùng Firebase project |

---

## Decision Log

| # | Quyết định | Alternatives | Lý do chọn |
|---|---|---|---|
| D1 | Toàn Root Collections | Sub-collections theo user | Admin cần query toàn cục trên orders, passes mà không biết userId trước |
| D2 | `flashSale` embed trong `products` | Collection `promotions` riêng | Flash sale = giá sản phẩm; promo code = discount đơn hàng. Khác concept, có thể dùng đồng thời |
| D3 | `usedCount` trong `promotions` tăng bằng Transaction | Counter service riêng | Đủ cho scale trung bình, không cần distributed counters |
| D4 | `maxUsesPerUser` check qua query `orders` | Array userId trong document | Document không tăng kích thước vô hạn |
| D5 | `items[]` là full snapshot trong `orders` | Reference sang `products` | Lịch sử đơn hàng bất biến dù admin sửa sản phẩm sau |
| D6 | Pass Document ID = QR payload | Signed JWT | Đơn giản, 1 Firestore read tại gate, Firestore ID đủ random để không đoán được |
| D7 | `bankInfoSnapshot` trong `payoutRequests` | Reference sang `affiliateProfiles` | Audit trail bất biến dù KOL đổi bank account sau |
| D8 | `walletBalance` trừ bằng Transaction khi tạo payoutRequest | Trừ sau khi complete | Không thể withdraw 2 lần, balance luôn nhất quán |
| D9 | `affiliateCommissionAmount` lock tại thời điểm order paid | Tính lại khi payout | Bảo vệ KOL khỏi thay đổi commission rate về sau |
| D10 | `validityConfig` stamp xuống `passes` tại order time | Lookup product khi scan | Gate scan chỉ cần 1 read, không phụ thuộc product document |

---

## Assumptions

| # | Assumption |
|---|---|
| A1 | Hệ thống phục vụ 1 địa điểm duy nhất ở Phase 1 |
| A2 | Apple Wallet dùng PKPass, nhúng QR từ `passes.qrCodeUrl` |
| A3 | Affiliate tracking qua UTM-style `?ref=CODE` trong URL |
| A4 | Khách có thể mua nhiều số lượng của cùng 1 vé trong 1 đơn |
| A5 | Commission tính trên `finalAmount` (sau khi áp promo code) |
| A6 | `totalClicks` tracking qua Next.js API redirect endpoint |
| A7 | Cloud Functions update stats KOL async sau mỗi order paid |
| A8 | Admin scan gate dùng camera trên browser/PWA |

---

## Collection Architecture

```
firestore-root/
├── b_users/              ← tất cả user roles (customer, admin, affiliate)
├── b_products/           ← tickets & combos
├── b_promotions/         ← promo codes
├── b_orders/             ← giao dịch tài chính
├── b_passes/             ← QR entities được scan tại cổng
├── b_affiliateProfiles/  ← KOL data & wallet balance
└── b_payoutRequests/     ← yêu cầu rút tiền
```

---

## TypeScript Interfaces

### Shared Types

```typescript
type ValidityType = 'date-specific' | 'date-range' | 'open-dated';

interface ValidityConfig {
  type: ValidityType;
  specificDate?: Timestamp;        // date-specific: ngày được phép vào
  validDaysFromPurchase?: number;  // date-range: số ngày kể từ ngày mua, vd: 30
  overallExpiresAt?: Timestamp;    // deadline cuối của đợt bán vé (mọi type)
}

interface ComboItem {
  productId: string;
  productName: string;    // denormalized
  thumbnailUrl: string;   // Firebase Storage URL — denormalized
  quantity: number;
}

interface BankInfo {
  bankName: string;           // vd: "Vietcombank"
  accountNumber: string;
  accountHolderName: string;
  branch?: string;
}
```

---

### Collection: `b_users`

```typescript
// Document ID = Firebase Auth UID
interface UserDocument {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoURL?: string;          // Firebase Storage URL

  role: 'customer' | 'admin' | 'affiliate';

  customerProfile?: {
    totalOrders: number;      // denormalized counter
    totalSpent: number;       // VND, for future loyalty tiers
  };

  fcmTokens?: string[];       // for push notifications (multi-device)

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **Indexing:** `role`

---

### Collection: `b_products`

```typescript
// Document ID = auto-generated Firestore ID
interface ProductDocument {
  id: string;
  name: string;
  description: string;
  type: 'ticket' | 'combo';
  price: number;              // VND, giá gốc
  thumbnailUrl: string;       // Firebase Storage URL
  gallery?: string[];         // Firebase Storage URLs

  // Validity — admin cấu hình khi tạo, stamp xuống passes khi order paid
  validityConfig: ValidityConfig;

  // Chỉ có khi type = 'combo'
  // Gate scan hiển thị list này để nhân viên đổi vé giấy
  comboItems?: ComboItem[];

  // Inventory — tăng bằng Firestore Transaction khi order paid
  totalStock?: number;        // undefined = unlimited
  soldCount: number;

  // Affiliate commission override
  // Nếu có → ưu tiên hơn affiliateProfiles.defaultCommissionRate
  commissionRate?: number;    // vd: 0.08 = 8%

  // Flash sale — embed trực tiếp, tách biệt với promotions (promo code)
  flashSale?: {
    salePrice: number;        // VND
    startAt: Timestamp;
    endAt: Timestamp;
  };

  status: 'active' | 'hidden' | 'sold-out';
  tags?: string[];            // vd: ['weekend', 'family', 'vip']

  createdBy: string;          // admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **Indexing:** `status`, `type`, `tags` (array-contains), `flashSale.startAt + flashSale.endAt` (composite)

---

### Collection: `b_promotions`

```typescript
// Document ID = auto-generated Firestore ID
interface PromotionDocument {
  id: string;
  code: string;               // UPPERCASE unique — index riêng
  name: string;               // tên nội bộ
  description?: string;       // hiển thị cho khách

  type: 'percentage' | 'fixed';
  discountValue: number;
  // percentage → vd: 10 = giảm 10%
  // fixed      → vd: 50000 = giảm 50,000 VND

  minOrderValue?: number;
  maxDiscountAmount?: number;  // cap cho percentage, vd: tối đa giảm 200k

  // null = áp dụng tất cả sản phẩm
  applicableProductIds?: string[];

  // Concurrency-safe — tăng bằng Firestore Transaction khi order paid
  maxUses: number;
  usedCount: number;
  // Check qua query orders (không lưu array userId → document không bloat)
  maxUsesPerUser?: number;

  startAt?: Timestamp;
  endAt?: Timestamp;

  status: 'active' | 'inactive' | 'expired';

  createdBy: string;          // admin UID
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **Indexing:** `code` (unique lookup), `status + startAt + endAt` (composite)

---

### Collection: `b_orders`

```typescript
interface OrderItem {
  productId: string;
  productName: string;        // denormalized snapshot
  productType: 'ticket' | 'combo';
  thumbnailUrl: string;       // Firebase Storage URL — denormalized snapshot
  quantity: number;
  unitPrice: number;          // VND — giá tại thời điểm mua (lịch sử)
  subtotal: number;           // unitPrice × quantity
  validityConfig: ValidityConfig;   // stamp từ product
  comboItems?: ComboItem[];         // stamp từ product nếu là combo
}

interface VNPayData {
  vnpTxnRef: string;          // mã B.Duck gửi sang VNPay
  vnpTransactionNo?: string;  // mã VNPay trả về
  vnpResponseCode?: string;   // "00" = success
  vnpBankCode?: string;       // vd: "NCB", "VCB"
  vnpPayDate?: string;        // "20240412153000"
}

// Extensible cho Phase 2 (Stripe, MoMo, etc.)
interface PaymentDetails {
  provider: 'vnpay' | 'stripe';
  providerData: VNPayData;    // union type mở rộng khi thêm gateway
}

// Document ID = auto-generated Firestore ID
interface OrderDocument {
  id: string;
  orderNumber: string;        // human-readable: "BDUCK-20240412-00001"

  // Customer snapshot (denormalized)
  customerId: string;         // Firebase Auth UID — index này
  customerEmail: string;
  customerName: string;
  customerPhone?: string;

  // Full snapshot tại thời điểm mua — bất biến dù admin sửa product sau
  items: OrderItem[];

  // Pricing
  subtotal: number;
  discountAmount: number;     // 0 nếu không có promo
  finalAmount: number;        // subtotal - discountAmount

  // Promotion (nếu có)
  promotionId?: string;
  promotionCode?: string;     // denormalized để hiển thị

  // Affiliate tracking
  affiliateId?: string;       // index này
  affiliateCode?: string;     // raw ?ref=CODE trong URL
  // Lock tại thời điểm paid — bất biến dù commission rate thay đổi sau
  affiliateCommissionAmount?: number; // VND

  // Payment
  status: 'pending' | 'paid' | 'cancelled';
  paymentDetails?: PaymentDetails;
  paidAt?: Timestamp;
  cancelledAt?: Timestamp;
  cancelReason?: string;

  // 2-way reference với b_passes
  passIds: string[];

  createdAt: Timestamp;       // index này
  updatedAt: Timestamp;
}
```

> **Indexing:**
> - `customerId + createdAt` (Order history)
> - `affiliateId + status` (KOL conversion stats)
> - `status + createdAt` (Admin order management)
> - `promotionCode + customerId` (maxUsesPerUser check)

---

### Collection: `b_passes`

```typescript
type PassStatus = 'active' | 'used' | 'expired' | 'voided';

// Document ID = auto-generated Firestore ID
// QR Code encodes: document ID (plain string → 1 getDoc() call để validate)
interface PassDocument {
  id: string;                 // = nội dung QR code

  // 2-way reference với b_orders
  orderId: string;
  orderNumber: string;        // denormalized — hiển thị tại màn hình scan

  // Customer snapshot
  customerId: string;
  customerName: string;       // denormalized
  customerEmail: string;      // denormalized — gửi e-ticket

  // Product snapshot — đóng băng tại thời điểm tạo pass
  productId: string;
  productName: string;
  productType: 'ticket' | 'combo';
  thumbnailUrl: string;       // Firebase Storage URL

  // Combo manifest — hiển thị tại gate scan để đổi vé giấy
  comboItems?: ComboItem[];   // chỉ có khi productType = 'combo'

  // Validity — resolved thành giá trị cụ thể tại order time
  validityType: ValidityType;
  visitDate?: Timestamp;      // date-specific
  validFrom?: Timestamp;      // date-range
  validUntil?: Timestamp;     // date-range & date-specific

  // QR & Wallet
  qrCodeUrl: string;          // Firebase Storage URL — hiển thị trên e-ticket & email
  walletPassUrl?: string;     // Firebase Storage URL — PKPass download (Apple Wallet)

  // Gate scan tracking
  status: PassStatus;
  usedAt?: Timestamp;
  usedBy?: string;            // admin UID thực hiện scan
  voidedAt?: Timestamp;
  voidedBy?: string;          // admin UID
  voidReason?: string;

  affiliateId?: string;       // inherited từ order

  createdAt: Timestamp;
}
```

> **Indexing:**
> - `customerId + status` (Customer e-ticket list)
> - `status + validUntil` (Expiry processing)
> - `orderId` (Admin order detail → pass list)

---

### Collection: `b_affiliateProfiles`

```typescript
interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
}

// Document ID = Firebase Auth UID (mirror b_users)
interface AffiliateProfileDocument {
  id: string;                 // = Firebase Auth UID

  userId: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  avatarUrl?: string;         // Firebase Storage URL

  socialLinks?: SocialLinks;
  followerCount?: number;
  niche?: string;             // vd: "family", "travel", "lifestyle"
  bio?: string;

  applicationStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  appliedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;        // admin UID
  rejectionReason?: string;

  // Commission — set bởi admin khi approve
  // Product commissionRate ưu tiên hơn nếu tồn tại
  defaultCommissionRate: number;  // vd: 0.07 = 7%

  referralCode: string;       // unique, vd: "KOLDUCK01" — index này
  trackingLink: string;       // vd: "https://bduck.vn/?ref=KOLDUCK01"

  // Stats — updated async bởi Cloud Function
  totalClicks: number;
  totalConversions: number;
  totalCommissionEarned: number;  // VND cumulative

  // Wallet — updated bằng Firestore Transaction
  walletBalance: number;      // VND available để withdraw
  totalPaidOut: number;       // VND đã payout tổng cộng

  bankInfo?: BankInfo;        // KOL tự điền
  bankInfoVerified: boolean;  // admin verify

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

> **Indexing:** `referralCode`, `applicationStatus`

---

### Collection: `b_payoutRequests`

```typescript
type PayoutStatus =
  | 'pending'     // KOL vừa gửi yêu cầu
  | 'approved'    // Admin duyệt
  | 'processing'  // Đang chuyển khoản
  | 'completed'   // Hoàn tất
  | 'rejected';   // Từ chối

// Document ID = auto-generated Firestore ID
interface PayoutRequestDocument {
  id: string;

  affiliateId: string;              // Firebase Auth UID — index này
  affiliateDisplayName: string;     // denormalized

  // Snapshot tại thời điểm request — bất biến dù KOL đổi bank sau
  bankInfoSnapshot: BankInfo;

  amount: number;                   // VND requested
  walletBalanceBefore: number;      // audit trail

  status: PayoutStatus;

  reviewedBy?: string;              // admin UID
  reviewedAt?: Timestamp;
  rejectionReason?: string;

  transferNote?: string;
  transferProofUrl?: string;        // Firebase Storage URL — screenshot bank transfer
  completedAt?: Timestamp;

  createdAt: Timestamp;             // index này
  updatedAt: Timestamp;
}
```

> **Indexing:** `affiliateId + status`, `status + createdAt`

---

## Transaction Patterns

### 1. Checkout Transaction (Order Paid)

```typescript
Firestore.runTransaction(async (t) => {
  // 1. Validate promo
  const promo = await t.get(b_promotions/promoId);
  if (promo.usedCount >= promo.maxUses) throw new Error('PROMO_EXHAUSTED');

  // 2. Validate stock
  const product = await t.get(b_products/productId);
  if (product.soldCount + qty > product.totalStock) throw new Error('OUT_OF_STOCK');

  // 3. Update order
  t.update(b_orders/orderId, { status: 'paid', paidAt, passIds });

  // 4. Increment counters
  t.update(b_promotions/promoId, { usedCount: increment(1) });
  t.update(b_products/productId, { soldCount: increment(qty) });

  // 5. Create passes
  passIds.forEach(pid => t.set(b_passes/pid, passData));

  // 6. Affiliate wallet (async via Cloud Function — không block checkout)
  // trigger: onOrderPaid → affiliateProfiles.walletBalance += commissionAmount
});
```

### 2. Payout Request Transaction

```typescript
Firestore.runTransaction(async (t) => {
  const profile = await t.get(b_affiliateProfiles/uid);
  if (profile.walletBalance < amount) throw new Error('INSUFFICIENT_BALANCE');

  t.update(b_affiliateProfiles/uid, { walletBalance: increment(-amount) });
  t.set(b_payoutRequests/newId, {
    amount,
    walletBalanceBefore: profile.walletBalance,
    status: 'pending',
    ...
  });
});
```

---

## Firebase Storage Structure

```
firebase-storage/
├── b_products/
│   └── {productId}/
│       ├── thumbnail.webp
│       └── gallery/
│           ├── 01.webp
│           └── 02.webp
├── b_passes/
│   └── {passId}/
│       ├── qrcode.png
│       └── wallet.pkpass
├── b_affiliates/
│   └── {uid}/
│       └── avatar.webp
└── b_payouts/
    └── {payoutRequestId}/
        └── transfer-proof.jpg
```

> **Note:** Prefix `b_` áp dụng cho cả Firebase Storage folders để đồng nhất convention.

---

## Collection Naming Convention

| Platform | Collections |
|---|---|
| **B.Duck Cityfuns** | `b_users`, `b_products`, `b_promotions`, `b_orders`, `b_passes`, `b_affiliateProfiles`, `b_payoutRequests` |
| **ERP (existing)** | `employees`, `schedules`, `inventory`, ... (không prefix) |
