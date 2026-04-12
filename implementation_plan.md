# Implementation Plan — B.Duck Cityfuns Ticketing Platform

> **Schema:** Approved ✅ — [firestore-schema.md](./firestore-schema.md)
> **Deadline:** 2 weeks
> **Stack:** Next.js 16.2.3 · React 19 · Firebase · Tailwind CSS v4 · next-intl

---

## Current State

| Layer | Status |
|---|---|
| Next.js + next-intl i18n routing | ✅ Done |
| Firebase SDK | ❌ Not installed |
| TypeScript types (schema) | ❌ Not created |
| Auth | ❌ Not implemented |
| Any feature | ❌ Not implemented |

---

## Technology Decisions (Pre-Implementation)

| Concern | Decision | Lý do |
|---|---|---|
| **State Management (Cart)** | Zustand | Lightweight, no boilerplate, SSR-safe |
| **Form Handling** | React Hook Form + Zod | Type-safe validation, tích hợp tốt với Next.js |
| **QR Code Generation** | `qrcode` npm package | Generate QR server-side, upload PNG lên Firebase Storage |
| **Email** | Firebase Extension: Trigger Email (via Nodemailer) | Không cần backend riêng |
| **Image Upload** | Firebase Storage SDK | Align với decision D9 |
| **Server Logic** | Next.js Server Actions | Tránh expose Firebase Admin credentials ở client |

> ⚠️ **AGENTS.md Rule:** Trước khi viết bất kỳ Next.js code nào, phải đọc `node_modules/next/dist/docs/` vì Next.js 16 có breaking changes so với training data.

---

## Phase 1 — Foundation (Day 1–2)

### 1.1 — Install Dependencies

```bash
npm install firebase firebase-admin zod react-hook-form zustand qrcode
npm install @hookform/resolvers
npm install -D @types/qrcode
```

### 1.2 — TypeScript Types

**[NEW]** `src/types/firestore.ts`
- Export tất cả interfaces từ schema đã thiết kế
- Shared types: `ValidityConfig`, `ComboItem`, `BankInfo`
- Collection types: `UserDocument`, `ProductDocument`, `PromotionDocument`, `OrderDocument`, `PassDocument`, `AffiliateProfileDocument`, `PayoutRequestDocument`

### 1.3 — Firebase Configuration

**[NEW]** `src/lib/firebase/client.ts`
- `initializeApp` với env vars
- Export `db`, `auth`, `storage`

**[NEW]** `src/lib/firebase/admin.ts`
- Firebase Admin SDK (dùng trong Server Actions)
- Export `adminDb`, `adminAuth`

**[NEW]** `.env.local` (template)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=
```

### 1.4 — Firestore Security Rules

**[NEW]** `firestore.rules`
- `b_users`: owner read/write, admin read-all
- `b_products`: public read (active only), admin write
- `b_promotions`: no client read (validate via Server Action), admin write
- `b_orders`: owner read, admin read/write, no client create (Server Action only)
- `b_passes`: owner read, admin read/write, no client write
- `b_affiliateProfiles`: owner read/write (own doc), admin read-all
- `b_payoutRequests`: owner create/read (own), admin read/write

### 1.5 — Auth Setup

**[NEW]** `src/lib/auth/provider.tsx` — Firebase Auth Context Provider
**[NEW]** `src/lib/auth/hooks.ts` — `useAuth()`, `useRequireAuth()`, `useRequireRole()`
**[MODIFY]** `src/app/[locale]/layout.tsx` — Wrap với AuthProvider

---

## Phase 2 — Customer Portal (Day 3–7)

### 2.1 — Route Structure

```
src/app/[locale]/
├── page.tsx                    ← Home: hero + ticket listing
├── tickets/
│   └── [productId]/
│       └── page.tsx            ← Product detail + add to cart
├── cart/
│   └── page.tsx                ← Cart review
├── checkout/
│   ├── page.tsx                ← Checkout form
│   └── result/
│       └── page.tsx            ← Payment result (VNPay callback)
├── orders/
│   └── page.tsx                ← Order history
├── tickets-wallet/
│   └── [passId]/
│       └── page.tsx            ← E-ticket detail + QR display
└── auth/
    ├── login/page.tsx
    └── register/page.tsx
```

### 2.2 — Server Actions

**[NEW]** `src/actions/products.ts`
- `getProducts()` — list active products (public)
- `getProductById(id)` — product detail (public)

**[NEW]** `src/actions/checkout.ts`
- `validatePromoCode(code, cartItems, userId)` — check promo validity + maxUsesPerUser
- `createOrder(orderData)` — create pending order, return VNPay redirect URL
- `confirmPayment(vnpParams)` — verify VNPay signature → Firestore Transaction:
  - Update order status: `paid`
  - Increment `promotions.usedCount`
  - Increment `products.soldCount`
  - Generate passes + QR codes
  - Trigger email (Firebase Extension)

**[NEW]** `src/actions/orders.ts`
- `getMyOrders(userId)` — customer order history
- `getOrderById(orderId, userId)` — order detail + passes

### 2.3 — Cart (Zustand)

**[NEW]** `src/stores/cart.ts`
- `CartItem`: `{ product: ProductDocument, quantity: number }`
- Actions: `addItem`, `removeItem`, `updateQuantity`, `clearCart`
- Persist to `localStorage`

### 2.4 — VNPay Integration

**[NEW]** `src/lib/vnpay/index.ts`
- `createPaymentUrl(order)` — build VNPay redirect URL với HMAC-SHA512 signature
- `verifyReturnUrl(params)` — verify VNPay callback signature

**[NEW]** `src/app/api/vnpay/ipn/route.ts`
- IPN (Instant Payment Notification) endpoint
- VNPay server-to-server call để confirm payment
- Gọi `confirmPayment` Server Action

### 2.5 — Pass & QR Generation

**[NEW]** `src/lib/passes/generate.ts`
- `generatePass(order, orderItem)` → create `PassDocument`, generate QR PNG, upload to Firebase Storage, return `passId`
- Logic: individual ticket → 1 pass per quantity; combo → 1 pass with comboItems

### 2.6 — E-ticket Email

- Dùng Firebase Extension "Trigger Email"
- **[NEW]** `src/lib/email/templates/eticket.ts` — HTML template với QR code embedded

---

## Phase 3 — Admin Portal (Day 8–11)

### 3.1 — Route Structure

```
src/app/[locale]/admin/
├── layout.tsx                  ← Auth guard: role === 'admin'
├── page.tsx                    ← Dashboard: stats overview
├── products/
│   ├── page.tsx                ← Product list + status toggle
│   └── [productId]/
│       └── page.tsx            ← Create/Edit product form
├── orders/
│   ├── page.tsx                ← Order list + search
│   └── [orderId]/
│       └── page.tsx            ← Order detail + void pass action
├── promotions/
│   ├── page.tsx                ← Promo list
│   └── [promoId]/
│       └── page.tsx            ← Create/Edit promo
├── scan/
│   └── page.tsx                ← Gate QR scanner (camera)
├── affiliates/
│   ├── page.tsx                ← KOL list + approval queue
│   └── [affiliateId]/
│       └── page.tsx            ← KOL profile + set commission
└── payouts/
    └── page.tsx                ← Payout queue + process
```

### 3.2 — Server Actions (Admin)

**[NEW]** `src/actions/admin/products.ts`
- `createProduct(data)`, `updateProduct(id, data)`, `toggleProductStatus(id)`
- Upload thumbnail → Firebase Storage → save URL

**[NEW]** `src/actions/admin/orders.ts`
- `getOrders(filters)` — paginated order list
- `voidPass(passId, reason, adminUid)` — mark pass voided

**[NEW]** `src/actions/admin/promotions.ts`
- `createPromotion(data)`, `updatePromotion(id, data)`, `deactivatePromotion(id)`

**[NEW]** `src/actions/admin/scan.ts`
- `validatePass(passId, adminUid)` — lookup pass, check validity, mark `used`
- Returns: `{ valid: boolean, pass: PassDocument, errorCode?: string }`

**[NEW]** `src/actions/admin/affiliates.ts`
- `approveAffiliate(uid, commissionRate)`, `rejectAffiliate(uid, reason)`
- `suspendAffiliate(uid)`

**[NEW]** `src/actions/admin/payouts.ts`
- `approvePayoutRequest(id)`, `completePayoutRequest(id, proofUrl)`, `rejectPayoutRequest(id, reason)`

### 3.3 — Gate Scanner Component

**[NEW]** `src/components/admin/QRScanner.tsx`
- Dùng `@zxing/browser` để access device camera
- Decode QR → gọi `validatePass()` Server Action
- Hiển thị kết quả: ✅ Valid (với comboItems nếu là combo) / ❌ Invalid (reason)

---

## Phase 4 — Affiliate Portal (Day 12–13)

### 4.1 — Route Structure

```
src/app/[locale]/affiliate/
├── layout.tsx                  ← Auth guard: role === 'affiliate' + applicationStatus === 'approved'
├── page.tsx                    ← Dashboard: clicks, conversions, wallet balance
├── apply/
│   └── page.tsx                ← Application form (public, no auth guard)
├── stats/
│   └── page.tsx                ← Detailed conversion stats
└── payouts/
    ├── page.tsx                ← Payout history + request new
    └── bank-info/
        └── page.tsx            ← Update bank info
```

### 4.2 — Server Actions (Affiliate)

**[NEW]** `src/actions/affiliate/apply.ts`
- `submitApplication(data, userId)` — create `affiliateProfiles` doc, update `users.role`

**[NEW]** `src/actions/affiliate/stats.ts`
- `getAffiliateStats(uid)` — clicks, conversions, commission earned

**[NEW]** `src/actions/affiliate/payouts.ts`
- `requestPayout(uid, amount)` — Firestore Transaction: deduct wallet, create payoutRequest
- `getPayoutHistory(uid)` — list payout requests

### 4.3 — Tracking Redirect

**[NEW]** `src/app/api/ref/[code]/route.ts`
- Increment `totalClicks` async
- Set affiliate cookie (30-day)
- Redirect về homepage

---

## Phase 5 — Polish & QA (Day 14)

- [ ] Apple Wallet PKPass generation (`src/lib/wallet/apple.ts`)
- [ ] `robots.txt`, sitemap, SEO meta tags
- [ ] Loading skeletons + error boundaries toàn app
- [ ] Mobile responsive check (PWA target)
- [ ] Firestore indexes deploy (`firestore.indexes.json`)
- [ ] Environment variables audit
- [ ] Security: verify tất cả Server Actions có auth check

---

## File Structure Overview

```
src/
├── actions/                    ← Server Actions (Firebase Admin)
│   ├── products.ts
│   ├── checkout.ts
│   ├── orders.ts
│   └── admin/
│       ├── products.ts
│       ├── orders.ts
│       ├── promotions.ts
│       ├── scan.ts
│       ├── affiliates.ts
│       └── payouts.ts
│   └── affiliate/
│       ├── apply.ts
│       ├── stats.ts
│       └── payouts.ts
├── app/
│   ├── api/
│   │   ├── vnpay/ipn/route.ts
│   │   └── ref/[code]/route.ts
│   └── [locale]/
│       ├── layout.tsx
│       ├── page.tsx
│       ├── tickets/
│       ├── cart/
│       ├── checkout/
│       ├── orders/
│       ├── tickets-wallet/
│       ├── auth/
│       ├── admin/
│       └── affiliate/
├── components/
│   ├── ui/                     ← Reusable primitives
│   ├── customer/               ← Customer-facing components
│   ├── admin/                  ← Admin components (QRScanner, etc.)
│   └── affiliate/              ← KOL components
├── lib/
│   ├── firebase/
│   │   ├── client.ts
│   │   └── admin.ts
│   ├── auth/
│   │   ├── provider.tsx
│   │   └── hooks.ts
│   ├── vnpay/
│   │   └── index.ts
│   ├── passes/
│   │   └── generate.ts
│   ├── email/
│   │   └── templates/
│   └── wallet/
│       └── apple.ts
├── stores/
│   └── cart.ts
└── types/
    └── firestore.ts
```

---

## Key Risks

| Risk | Mitigation |
|---|---|
| Next.js 16 breaking changes | Đọc `node_modules/next/dist/docs/` trước khi code |
| VNPay IPN signature mismatch | Test kỹ với VNPay sandbox trước khi production |
| QR flood attack (guess pass ID) | Firestore Security Rules: passes chỉ readable bởi owner hoặc admin role |
| Commission double-count | Firestore Transaction trong Cloud Function, idempotency key = orderId |
| 2-week timeline | Affiliate Portal có thể defer sang tuần 3 nếu cần, Customer + Admin là MVP |

---

## Execution Order (Recommended)

```
Phase 1 (Foundation) → Phase 2 (Customer) → Phase 3 (Admin) → Phase 4 (Affiliate) → Phase 5 (Polish)
```

Có thể chạy song song Phase 3 Admin cơ bản với Phase 2 sau khi Foundation xong.
