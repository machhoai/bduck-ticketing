# Task Tracker — B.Duck Cityfuns

## Phase 1 — Foundation
- [x] 1.1 Read Next.js 16 docs
- [x] 1.2 Install dependencies (firebase, firebase-admin, zod, zustand, qrcode, @zxing/browser)
- [x] 1.3 Create `src/types/firestore.ts`
- [x] 1.4 Create `src/lib/firebase/client.ts` + `COLLECTIONS` constants
- [x] 1.5 Create `src/lib/firebase/admin.ts`
- [x] 1.6 Create `firestore.rules` + `firestore.indexes.json`
- [x] 1.7 Create `src/lib/auth/session.ts`, `provider.tsx`, `hooks.ts`
- [x] 1.8 Update `src/app/[locale]/layout.tsx` with AuthProvider
- [x] 1.9 Create `src/app/api/auth/logout/route.ts`
- [x] 1.10 Create `.env.local.example`

## Phase 2 — Customer Portal
- [ ] 2.1 Server Actions: products
- [ ] 2.2 Server Actions: checkout + VNPay
- [ ] 2.3 Cart store (Zustand)
- [ ] 2.4 QR + Pass generation
- [ ] 2.5 Routes: home, tickets, cart, checkout, orders, e-ticket, auth

## Phase 3 — Admin Portal
- [ ] 3.1 Admin layout + auth guard
- [ ] 3.2 Server Actions: admin (products, orders, promos, scan, affiliates, payouts)
- [ ] 3.3 QR Scanner component
- [ ] 3.4 Admin routes

## Phase 4 — Affiliate Portal
- [ ] 4.1 Affiliate layout + auth guard
- [ ] 4.2 Server Actions: affiliate
- [ ] 4.3 Tracking redirect API
- [ ] 4.4 Affiliate routes

## Phase 5 — Polish
- [ ] 5.1 Apple Wallet
- [ ] 5.2 SEO + sitemap
- [ ] 5.3 Loading states + error boundaries
- [ ] 5.4 Firestore indexes
- [ ] 5.5 Final security audit
