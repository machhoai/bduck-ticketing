# B.Duck Deal Section + Membership + Voucher System

## ✅ Decision Log

| # | Quyết định | Lý do |
|---|-----------|-------|
| D1 | **Phương Án B** — Bounded Collections | Schema sạch, không "ô nhiễm" collection cũ, extensible |
| D2 | **Time gate = server-side `new Date()` trong Server Action** | Không cần cron, hoạt động Vercel free tier; client chỉ hiển thị countdown |
| D3 | **Membership = `ProductType` mới**, `membershipConfig` optional field | Tận dụng flow vé/pass hiện tại, chỉ thêm fields riêng cho membership |
| D4 | **Deal items nhúng trong DealSection document** (array) | Tránh subcollection, max ~20 items/section, đủ cho MVP |
| D5 | **Voucher code validate**: kiểm tra `bduck_issuedVouchers` TRƯỚC `bduck_promotions` | Online voucher bridge vào existing checkout flow |
| D6 | **Bonus points configurable**: `applyTo: "bonusOnly"\|"totalPoints"` + `multiplier` | Admin linh hoạt cấu hình từng chương trình |
| D7 | **Stock reset daily** = lazy check tại order time (không cron) | Consistent với pattern `orderCode` retry hiện tại |
| D8 | **Voucher distribution**: `perProduct` \| `perOrder` | Admin cấu hình: mua 1 = 1 voucher hoặc bao nhiêu cũng 1 |

---

## 📐 Final Design — Schema

### 1. Type Extensions (`src/types/firestore.ts`)

```typescript
// Extend ProductType
export type ProductType = "ticket" | "combo" | "membership"; // +membership

// Membership config — only when type = "membership"
export interface MembershipConfig {
  packageName: string;           // "Gói Bạc", "Gói Vàng"
  basePoints: number;            // e.g., 1210 (= price / 1000)
  bonusPoints: number;           // e.g., 385 (fixed gift)
  merch?: string;                // "1 gấu bông B.Duck" – display text
}

// Extend ProductDocument
// + membershipConfig?: MembershipConfig

// ─── bduck_dealSections ───────────────────────────────────────────

export type DealType = "percentage" | "fixed" | "buy1get1";

export interface DealBonusOverride {
  applyTo: "bonusOnly" | "totalPoints"; // which part to multiply
  multiplier: number;                    // e.g., 2 = double
}

export interface GiftVoucherConfig {
  templateId: string;                    // ref → bduck_voucherTemplates
  templateName: string;                  // denormalized display
  distribution: "perProduct" | "perOrder";
}

export interface DealItemDocument {
  id: string;                            // client-generated UUID (embedded)
  linkedProductId?: string;              // link to bduck_products (optional)

  name: string;
  description?: string;
  thumbnailUrl: string;
  productType: ProductType;

  originalPrice: number;                 // VND
  dealType: DealType;
  discountValue: number;                 // % or VND
  effectivePrice: number;                // pre-calculated for display

  // Membership-specific
  membershipConfig?: MembershipConfig;   // copy from product if linked
  membershipBonusOverride?: DealBonusOverride;

  // Gift voucher
  giftVoucher?: GiftVoucherConfig;

  // Merch gift (separate from membership merch)
  giftMerch?: string;                    // e.g., "1 merch B.Duck"

  // Stock (tracked per dealItem — reset daily if needed)
  totalStock?: number;                   // undefined = unlimited
  stockResetPeriod?: "daily" | "none";
  soldCount: number;
  lastStockResetDate?: string;           // "YYYY-MM-DD" — for lazy daily reset

  maxQtyPerOrder: number;               // default 1
  isActive: boolean;
  order: number;
}

export interface DealSectionDocument {
  id: string;
  title: string;
  description?: string;
  badgeLabel?: string;                    // "🔥 Flash Deal Hè 2025"

  // Daily time gate
  dailyOpenHour?: number;                 // 10 = opens at 10:00
  dailyOpenMinute?: number;               // 0

  // Section validity window
  startAt?: Timestamp;
  endAt?: Timestamp;

  // Order-level constraints
  maxPromoItemsPerOrder?: number;         // total qty of deal items per order
  maxPromoVariantsPerOrder?: number;      // distinct deal item types per order

  isActive: boolean;
  order: number;

  items: DealItemDocument[];             // embedded array

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── bduck_voucherTemplates ───────────────────────────────────────

export type VoucherType = "online_discount" | "instore_points" | "instore_gift";

export interface OnlineDiscountConfig {
  type: "percentage" | "fixed";
  value: number;
  minOrderValue?: number;
  maxDiscountAmount?: number;
  applicableProductIds?: string[];        // empty = all products
}

export interface VoucherTemplateDocument {
  id: string;
  name: string;                           // "Voucher chơi game miễn phí"
  description?: string;
  imageUrl?: string;                      // Firebase Storage URL

  voucherType: VoucherType;

  // Code generation
  codePrefix?: string;                    // "DUCK-"
  codeSuffix?: string;                    // "-VIP"
  codeLength: number;                     // random chars, e.g., 6

  // Validity
  validDays: number;                      // days from issue date

  // Online discount config (only if voucherType = "online_discount")
  onlineDiscount?: OnlineDiscountConfig;

  // In-store config
  instoreDescription?: string;           // "1 lượt chơi game khu vui chơi"
  instorePoints?: number;                // bonus points to load on card

  isActive: boolean;

  // Counters (updated via Transaction)
  totalIssued: number;
  totalRedeemed: number;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── bduck_issuedVouchers ─────────────────────────────────────────

export type IssuedVoucherStatus = "active" | "redeemed" | "expired";

export interface IssuedVoucherDocument {
  id: string;

  templateId: string;                    // indexed → bduck_voucherTemplates
  templateName: string;                  // denormalized
  voucherType: VoucherType;             // denormalized

  code: string;                          // UPPERCASE UNIQUE — indexed

  // Customer
  customerId?: string;
  customerEmail: string;                 // indexed
  customerPhone?: string;
  customerName: string;

  // Order link
  orderId: string;                       // indexed
  orderNumber: string;
  dealSectionId?: string;
  dealItemId?: string;

  // Validity
  issuedAt: Timestamp;
  expiresAt: Timestamp;

  status: IssuedVoucherStatus;          // indexed

  // Redemption
  redeemedAt?: Timestamp;
  redeemedBy?: string;                   // admin UID or "system"
  redemptionNote?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 2. Extend Existing Types

**`OrderItem`** thêm:
```typescript
isDealItem?: boolean;
dealSectionId?: string;
dealItemId?: string;
```

**`OrderDocument`** thêm:
```typescript
issuedVoucherIds?: string[];        // refs to bduck_issuedVouchers
dealSectionId?: string;             // which deal section applied
```

**`PassDocument`** thêm (for membership):
```typescript
// Only when productType = "membership"
membershipPoints?: number;          // basePoints
bonusPoints?: number;               // effective bonus after multiplier
totalPoints?: number;               // membershipPoints + bonusPoints
pointsBreakdown?: string;           // "1.210 gốc + 770 thưởng (×2)" — display text
merch?: string;                     // "1 gấu bông B.Duck"
```

**`CartItemInput`** thêm:
```typescript
dealSectionId?: string;
dealItemId?: string;
```

### 3. New Collections Constants
```typescript
DEAL_SECTIONS: "bduck_dealSections",
VOUCHER_TEMPLATES: "bduck_voucherTemplates",
ISSUED_VOUCHERS: "bduck_issuedVouchers",
```

---

## 🗂️ Implementation Phases

### Phase 1 — Data Layer *(Types + Collections)*
- [ ] Update `src/types/firestore.ts` với tất cả types mới
- [ ] Update `src/lib/firebase/client.ts` với 3 collections mới
- [ ] Update `COLLECTIONS` constant

### Phase 2 — Voucher Template Admin
- [ ] `src/actions/admin/voucherTemplates.ts` — CRUD actions
- [ ] `src/app/[locale]/admin/voucher-templates/page.tsx` — list page
- [ ] `src/app/[locale]/admin/voucher-templates/new/page.tsx` — create form
- [ ] `src/app/[locale]/admin/voucher-templates/[id]/page.tsx` — edit + issued history
- [ ] Admin sidebar nav item

### Phase 3 — Deal Section Admin
- [ ] `src/actions/admin/dealSections.ts` — CRUD actions (section + items)
- [ ] `src/actions/dealSections.ts` — public read (active sections only)
- [ ] `src/app/[locale]/admin/deal-sections/page.tsx` — list page
- [ ] `src/app/[locale]/admin/deal-sections/new/page.tsx` — create section form
- [ ] `src/app/[locale]/admin/deal-sections/[id]/page.tsx` — manage items + settings
- [ ] Admin sidebar nav item

### Phase 4 — Membership Product Type
- [ ] Update `ProductType` union + `ProductDocument` in types
- [ ] Update `ProductForm.tsx` — show `MembershipConfig` fields when `type === "membership"`
- [ ] Update `src/app/[locale]/admin/scan/page.tsx`:
  - Display `membershipPoints`, `bonusPoints`, `totalPoints`, `merch` when productType = membership
  - Add manual code input field (fallback for QR errors)
- [ ] Update `PassDocument` types + pass generation in checkout

### Phase 5 — Frontend DealCard + DealSection
- [ ] `src/components/customer/DealCard.tsx` — special card with:
  - B.Duck sticker (rotating from sticker_bduck/, assigned by item index)
  - Countdown timer (if `dailyOpenHour` set)
  - Discount ribbon/badge
  - Membership points display
  - Voucher gift indicator
  - Stock remaining indicator
- [ ] `src/components/customer/DealSection.tsx` — section container:
  - Header (title, badge, description, countdown)
  - Horizontal scroll mobile / grid desktop
  - Timed lock state (before 10am: locked + countdown)
- [ ] Update `src/app/[locale]/page.tsx` — add DealSections between Attractions and ProductListing

### Phase 6 — Cart & Checkout Validation
- [ ] Update `src/actions/checkout.ts`:
  - `validateDealItem()` — check time gate (`dailyOpenHour`), stock, `maxQtyPerOrder`
  - `validateDealSectionConstraints()` — check `maxPromoItemsPerOrder`, `maxPromoVariantsPerOrder`
  - `generateVoucherCode()` — prefix + random + suffix, unique check
  - `issueVouchers()` — create `bduck_issuedVouchers` docs post-payment
  - `calculateMembershipPoints()` — base + bonus with multiplier override
  - Update `validatePromoCode()` — check `bduck_issuedVouchers` first for online_discount vouchers
  - Update `createOrder()` — wire in deal logic, voucher issuance, membership pass fields
  - Daily stock reset lazy check in `validateDealItem()`
- [ ] Update cart UI: show placeholder voucher in cart when deal item has `giftVoucher`

### Phase 7 — Email Integration
- [ ] Update `src/lib/email/tickets.ts` — add voucher section to email HTML:
  - Show issued voucher code + name + validity + image
  - Members: show points breakdown

### Phase 8 — Stock Reset Logic (Lazy, No Cron)
- [ ] In `validateDealItem()`: check `lastStockResetDate !== today`
  - If different: reset `soldCount = 0`, `lastStockResetDate = today` via Transaction
  - Then continue validation with reset count

---

## 🔐 Time Gate Logic (Server-Side, No Cron)

```typescript
// In createOrder() Server Action:
function isDealSectionOpen(section: DealSectionDocument): boolean {
  const now = new Date();
  const hour = now.getHours();   // Server time (UTC+7 via TZ env var)
  const minute = now.getMinutes();

  if (section.dailyOpenHour !== undefined) {
    const openMinute = section.dailyOpenMinute ?? 0;
    const nowMinutes = hour * 60 + minute;
    const openMinutes = section.dailyOpenHour * 60 + openMinute;
    if (nowMinutes < openMinutes) return false;
  }

  // Also check overall validity window
  const nowTs = Timestamp.now();
  if (section.startAt && nowTs.toMillis() < section.startAt.toMillis()) return false;
  if (section.endAt && nowTs.toMillis() > section.endAt.toMillis()) return false;

  return true;
}
```

> ⚠️ Vercel server time: set `TZ=Asia/Ho_Chi_Minh` in environment variables để `new Date()` trả giờ VN.

---

## 🎨 DealCard Design Spec

**Layout**: Card cam-vàng gradient nổi bật, khác hoàn toàn ProductCard trắng:

```
┌─────────────────────────────┐
│ [DEAL] ribbon chéo góc      │
│  ┌───────────────────────┐  │
│  │   Product image       │ 🦆│ ← B.Duck sticker nổi, float animation
│  │   [Thumb]             │  │
│  └───────────────────────┘  │
│                             │
│  📛 Product Name            │
│  💬 Description             │
│                             │
│  🏷 ~~150K~~ → 88K         │ ← -41% badge
│                             │
│  🎫 +1 Voucher game        │ ← nếu có giftVoucher
│  🎁 +1 merch B.Duck        │ ← nếu có giftMerch
│  💳 1.210đ + 770 thưởng    │ ← nếu membership
│                             │
│  ⏳ Còn 23 suất             │ ← nếu có stock
│                             │
│  [⏰ Mở lúc 10:00]         │ ← nếu chưa mở (clock locked state)
│  [+ Thêm vào giỏ]          │ ← sau 10h
└─────────────────────────────┘
```

**Sticker assignment**: `STICKER_POOL = [37,38,39,...,72]`, index = `dealItem.order % STICKER_POOL.length`

---

## ✅ Verification Plan

### Build & Type Check
```bash
npm run build   # TypeScript compile + Next.js build
```

### Manual Testing Checklist
1. [ ] Admin tạo VoucherTemplate (online_discount) → kiểm tra fields
2. [ ] Admin tạo DealSection với `dailyOpenHour: 10`, add 3 item (ticket + combo + membership)
3. [ ] Frontend: trước 10h → DealCard hiện countdown, nút locked
4. [ ] Frontend: sau 10h → DealCard active, thêm vào giỏ
5. [ ] Mua deal combo → cart hiện placeholder voucher
6. [ ] Thanh toán → order có `issuedVoucherIds`, email có voucher section
7. [ ] Admin `/scan` → quét membership pass → hiện points breakdown + merch
8. [ ] Admin nhập mã thủ công → kết quả tương tự
9. [ ] Mua 2x deal ticket → server reject nếu `maxQtyPerOrder: 1`
10. [ ] Hôm sau 9h45: stock vẫn đúng → 10h stock reset → 30 suất mới
