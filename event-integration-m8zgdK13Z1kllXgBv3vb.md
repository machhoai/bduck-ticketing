# Tài liệu Tích hợp API
> Dành cho Developer xây dựng Event Frontend

**Event:** Voucher 1 lượt chơi Trò chơi khi mua Combo giá sốc 649K
**Event ID:** `m8zgdK13Z1kllXgBv3vb`
**Base URL:** `https://employee.joyworld.vn`

---

## 0. Cấu hình Môi trường
Thêm Event ID vào file .env.local của custom event app.

```.env
NEXT_PUBLIC_EVENT_ID=m8zgdK13Z1kllXgBv3vb
```

💡 Event ID này được tạo từ trang Quản lý Sự kiện trong ERP. Cả hai app cùng dùng chung Firebase project.

---

## 1. Tracking Pageviews & Interactions
Gửi analytics (pageview, click, scroll) về hệ thống ERP.
Endpoint: POST /api/v1/events/track

```typescript
// Track a pageview or interaction
await fetch('https://employee.joyworld.vn/api/v1/events/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId: process.env.NEXT_PUBLIC_EVENT_ID,
    action: 'pageview',  // or 'button_click', 'spin_start', etc.
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    metadata: {
      page: '/landing',
      referrer: document.referrer,
    },
  }),
});
```

---

## 2. Đăng ký Khách hàng (Lead Collection)
Thu thập thông tin khách hàng và cấp lượt chơi mặc định.
Endpoint: POST /api/v1/events/register

```typescript
// Register a customer / collect lead data
const res = await fetch('https://employee.joyworld.vn/api/v1/events/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId: process.env.NEXT_PUBLIC_EVENT_ID,
    customer: {
      phone: '0909123456',       // Primary key (bắt buộc) — 10 số, bắt đầu 03/05/07/08/09
      fullName: 'Nguyen Van A',  // Bắt buộc
      dob: '1995-10-25',        // Bắt buộc (YYYY-MM-DD)
      email: 'a@email.com',     // Tùy chọn
    },
    source: 'qr_code',          // Tùy chọn: 'qr_code' | 'social_media' | 'direct'
    location: 'Hồ Chí Minh',   // Tùy chọn
  }),
});

const data = await res.json();
// Response (thành công):
// {
//   success: true,
//   isNewUser: true,             // false nếu phone đã đăng ký
//   spinsRemaining: 3,
//   message: 'Đăng ký thành công'
// }
//
// Response (lỗi validation):
// { error: 'Số điện thoại không đúng định dạng (VD: 0912345678)' }  // 400
// { error: 'customer.dob là bắt buộc (định dạng YYYY-MM-DD)' }          // 400
```

⚠️ Phone number là primary key. Nếu phone đã đăng ký trước đó, thông tin sẽ được cập nhật nhưng spins KHÔNG bị reset.

---

## 3. Gacha Roll (Quay thưởng)
Gọi Server Action sau khi hoạt ảnh mini-game kết thúc.

```typescript
// Execute a gacha spin (Server Action — call from server component or 'use server')
import { executeGacha } from '@/actions/universal_gacha';

const result = await executeGacha(
  process.env.NEXT_PUBLIC_EVENT_ID!,
  {
    phone: '0909123456',      // 10 số, bắt đầu 03/05/07/08/09 (bắt buộc)
    name: 'Nguyen Van A',     // Họ tên (bắt buộc)
    dob: '1995-10-25',        // Ngày sinh YYYY-MM-DD (bắt buộc)
    email: 'a@email.com',     // Email (tùy chọn)
  }
);

// Response (GachaResult):
// {
//   success: true,
//   status: 'WON_VOUCHER',        // or 'LUCK_NEXT_TIME' | 'NO_SPINS_LEFT' | 'ERROR'
//   spinsRemaining: 2,
//   prizeData: {
//     campaignId: 'CAMP_1',
//     campaignName: 'Giảm 10%',
//     rewardType: 'discount_percent',
//     rewardValue: 10,
//     voucherCode: 'OPEN-X7B9-26',  // Show QR for this code
//   },
//   message: 'You won: Giảm 10%!'
// }
```

🎰 Server Action chạy server-side. Toàn bộ logic gacha nằm trong Firestore transaction — không thể hack từ client.

---

## 4. TypeScript Response Types
Copy các interface này vào custom event app để type-safe.

```typescript
// TypeScript types for responses
interface GachaResult {
  success: boolean;
  status: 'WON_VOUCHER' | 'LUCK_NEXT_TIME' | 'NO_SPINS_LEFT' | 'ERROR';
  spinsRemaining?: number;
  prizeData?: {
    campaignId: string;
    campaignName: string;
    rewardType: string;
    rewardValue: number;
    voucherCode: string;
  };
  message?: string;
}

interface RegisterResponse {
  success: boolean;
  isNewUser: boolean;
  spinsRemaining: number;
  message: string;
}

interface TrackResponse {
  success: boolean;
  id: string;             // analytics doc ID
}
```
