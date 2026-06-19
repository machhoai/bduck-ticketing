# Deal Section: Cài đặt hiển thị theo giờ & ngày trong tuần

## Mô tả

Hiện tại deal section chỉ có `dailyOpenHour/Minute` — kiểm soát **giờ mở bán** (sau giờ này mới cho mua). Yêu cầu mở rộng tương tự cơ chế time-slot của vé:

1. **Khung giờ** — Thêm giờ đóng (`dailyCloseHour/Minute`) → section chỉ hiển thị/cho mua trong khung giờ cụ thể (ví dụ: 17:00–18:00)
2. **Ngày trong tuần** — Thêm `allowedDaysOfWeek` → section chỉ hiển thị/cho mua vào những ngày cụ thể (ví dụ: Thứ 2–Thứ 5)

## Thiết kế

### Mở rộng `DealSectionDocument` (không tạo interface mới)

Thêm 3 field optional vào `DealSectionDocument`:
- `dailyCloseHour?: number` + `dailyCloseMinute?: number` — giờ đóng section
- `allowedDaysOfWeek?: number[]` — ngày trong tuần được phép (0=CN, 1=T2, ..., 6=T7)

### Logic hiển thị

| Trường hợp | Hiện tại | Sau thay đổi |
|------------|----------|-------------|
| Chỉ có `dailyOpenHour` | Mở từ giờ đó → hết ngày | Giữ nguyên (backward compatible) |
| Có cả open + close | N/A | Chỉ mở trong khung giờ open→close |
| Có `allowedDaysOfWeek` | N/A | Chỉ mở vào ngày được chọn |
| Kết hợp cả 3 | N/A | Chỉ mở khi đúng ngày VÀ đúng giờ |

## Proposed Changes

### Types

#### [MODIFY] [firestore.ts](file:///f:/Github/joywrold/bduck-ticketing/src/types/firestore.ts)

Thêm 3 field vào `DealSectionDocument` (sau `dailyOpenMinute`, line ~769):
```typescript
/** Daily close time — section locks after this time. undefined = no close gate */
dailyCloseHour?: number;   // 18 = closes at 18:00
dailyCloseMinute?: number; // 0
/** Restrict section to specific days of week. undefined = all days. */
allowedDaysOfWeek?: DayOfWeek[];
```

---

### Core Logic

#### [MODIFY] [dealUtils.ts](file:///f:/Github/joywrold/bduck-ticketing/src/lib/dealUtils.ts)

Mở rộng `checkDealSectionTimeGate()` để kiểm tra thêm:
1. **Close time**: Nếu có `dailyCloseHour` → kiểm tra hiện tại < giờ đóng
2. **Day-of-week**: Nếu có `allowedDaysOfWeek` → kiểm tra ngày hiện tại nằm trong mảng
3. Return thêm `closesAt: string | null` cho UI countdown

> [!IMPORTANT]
> Hàm này là **single source of truth** cho cả client display (DealSection.tsx) và server validation (deal-checkout.ts). Sửa 1 chỗ → tất cả đều nhất quán.

---

### Admin Form

#### [MODIFY] [DealSectionForm.tsx](file:///f:/Github/joywrold/bduck-ticketing/src/components/admin/DealSectionForm.tsx)

1. **State**: Thêm `dailyCloseHour`, `dailyCloseMinute`, `allowedDaysOfWeek` vào form state
2. **Submit handler**: Thêm các field vào input object
3. **UI Time Gate section** (line ~123–167):
   - Thêm giờ đóng bên cạnh giờ mở
   - Thêm checkbox grid 7 ngày (tái sử dụng UI giống ProductForm)
   - Warning label hiển thị cài đặt hiện tại

---

### Admin Server Actions

#### [MODIFY] [dealSections.ts](file:///f:/Github/joywrold/bduck-ticketing/src/actions/admin/dealSections.ts)

1. **`CreateDealSectionInput`**: Thêm `dailyCloseHour?`, `dailyCloseMinute?`, `allowedDaysOfWeek?`
2. **`createDealSection()`**: Ghi các field vào payload
3. **`updateDealSection()`**: Cập nhật các field

---

### Customer Display

#### [MODIFY] [DealSection.tsx](file:///f:/Github/joywrold/bduck-ticketing/src/components/customer/DealSection.tsx)

- Truyền thêm `closesAt` vào `DealStatusPill`
- Hiển thị info ngày nếu có `allowedDaysOfWeek`

#### [MODIFY] [DealStatusPill.tsx](file:///f:/Github/joywrold/bduck-ticketing/src/components/customer/DealStatusPill.tsx)

- Hỗ trợ hiển thị `closesAt` (countdown đến giờ đóng khi đang mở)
- Hiển thị "Không mở hôm nay" nếu ngày hiện tại không nằm trong `allowedDaysOfWeek`

---

### Admin Listing

#### [MODIFY] [admin/deal-sections/page.tsx](file:///f:/Github/joywrold/bduck-ticketing/src/app/%5Blocale%5D/admin/deal-sections/page.tsx)

- Line ~74: Cập nhật label hiển thị để bao gồm giờ đóng và ngày trong tuần

---

## Open Questions

> [!IMPORTANT]
> **Giờ đóng**: Có cần hỗ trợ trường hợp close < open (ví dụ: 22:00–02:00 = qua đêm) không? Tôi sẽ implement đơn giản trước (open < close trong cùng ngày), có thể bổ sung sau nếu cần.

> [!NOTE]
> **Server validation (deal-checkout.ts)**: Không cần sửa trực tiếp vì nó gọi `checkDealSectionTimeGate()` — sửa hàm util là đủ.

## Verification Plan

### Automated Tests
- TypeScript check: `npx tsc --noEmit`

### Manual Verification
- Tạo deal section mới → chọn giờ mở/đóng + ngày trong tuần → verify data Firestore
- Kiểm tra customer homepage hiển thị đúng trạng thái
- Thử checkout khi ngoài giờ/ngày → server phải reject
