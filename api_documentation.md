# B.Duck Cityfuns — Scan & Ticketing API

> **Version**: v1 · **Base URL**: `https://your-domain.com/api/v1`
> **Auth**: Bearer Token · **Format**: JSON

---

## 🔐 Authentication

All API endpoints require a **Bearer Token** in the `Authorization` header.

```
Authorization: Bearer <INTERNAL_API_KEY>
```

### Your API Key

```
bduck_sk_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
```

> [!CAUTION]
> **Keep this key secret!** Do NOT expose it in frontend code, mobile apps, or public repositories.
> If compromised, change `INTERNAL_API_KEY` in your `.env.local` and restart the server.

### Test Authentication

```bash
curl -s https://your-domain.com/api/v1/health \
  -H "Authorization: Bearer bduck_sk_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
```

---

## 📋 API Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/scan?code={code}` | Lookup pass or order by any code |
| `POST` | `/scan/use-pass` | Mark a pass as "used" (check-in) |
| `POST` | `/scan/confirm-payment` | Confirm counter payment + generate passes |
| `GET` | `/ticket/lookup?code={orderCode}` | Legacy: Lookup order by orderCode only |
| `POST` | `/ticket/{orderId}/confirm-payment` | Legacy: Confirm payment by orderId |

---

## 1️⃣ Scan / Lookup

**`GET /api/v1/scan?code={code}`**

Universal lookup — accepts **any** code format and finds the matching pass or order.

### Supported Code Formats

| Format | Example | Match Strategy |
|--------|---------|----------------|
| Pass QR code | `BDUCK-PASS-abc123XYZ789defGHI12` | Direct pass document lookup |
| Pass short code | `HJV6KPR7EYHJ` | Last 12 chars of pass ID (shown on ticket) |
| Order number | `BDUCK-20260425-F68DU` | Query by orderNumber field |
| Order code | `BDK-A3F9X2` | Query by orderCode field |
| Raw pass ID | `abc123XYZ789defGHI12` | Direct document lookup |

### Request

```bash
curl -s "https://your-domain.com/api/v1/scan?code=HJV6KPR7EYHJ" \
  -H "Authorization: Bearer <API_KEY>"
```

### Response — Pass Found

```json
{
  "success": true,
  "type": "pass",
  "pass": {
    "id": "abc123XYZ789defGHI12",
    "shortCode": "HJV6KPR7EYHJ",
    "qrCode": "BDUCK-PASS-abc123XYZ789defGHI12",
    "orderId": "order_abc123",
    "orderNumber": "BDUCK-20260425-F68DU",
    "customerId": "user_123",
    "customerName": "Nguyễn Văn A",
    "customerEmail": "a@example.com",
    "productId": "prod_ticket_01",
    "productName": "Vé tham quan Joyworld",
    "productType": "ticket",
    "thumbnailUrl": "https://...",
    "validityType": "open-dated",
    "status": "active",
    "comboItems": null,
    "visitDate": null,
    "validFrom": "2026-04-25T10:00:00.000Z",
    "validUntil": "2026-05-25T10:00:00.000Z",
    "createdAt": "2026-04-25T10:00:00.000Z",
    "usedAt": null,
    "usedBy": null
  }
}
```

### Response — Order Found

```json
{
  "success": true,
  "type": "order",
  "order": {
    "id": "order_abc123",
    "orderNumber": "BDUCK-20260425-F68DU",
    "orderCode": "BDK-A3F9X2",
    "status": "paid",
    "customerName": "Nguyễn Văn A",
    "customerEmail": "a@example.com",
    "customerPhone": "0901234567",
    "isGuestOrder": false,
    "paymentProvider": "counter",
    "items": [
      {
        "productId": "prod_ticket_01",
        "productName": "Vé tham quan Joyworld",
        "productType": "ticket",
        "quantity": 2,
        "unitPrice": 150000,
        "subtotal": 300000
      }
    ],
    "subtotal": 300000,
    "discountAmount": 0,
    "finalAmount": 300000,
    "promotionCode": null,
    "passIds": ["abc123...", "def456..."],
    "paidAt": "2026-04-25T12:00:00.000Z",
    "createdAt": "2026-04-25T10:00:00.000Z",
    "expiresAt": "2026-04-26T10:00:00.000Z",
    "cancelReason": null
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Không tìm thấy vé hoặc đơn hàng với mã \"XYZ123\""
}
```

---

## 2️⃣ Use Pass (Check-in)

**`POST /api/v1/scan/use-pass`**

Mark a pass as **"used"** — call this when a customer enters the gate.

### Supported `passId` Formats

- Full Firestore ID: `abc123XYZ789defGHI12`
- Short code (12 chars): `HJV6KPR7EYHJ`
- QR code string: `BDUCK-PASS-abc123XYZ789defGHI12`

### Request

```bash
curl -X POST "https://your-domain.com/api/v1/scan/use-pass" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "passId": "HJV6KPR7EYHJ" }'
```

### Success Response

```json
{
  "success": true,
  "message": "Vé đã được sử dụng thành công",
  "pass": {
    "id": "abc123XYZ789defGHI12",
    "shortCode": "HJV6KPR7EYHJ",
    "qrCode": "BDUCK-PASS-abc123XYZ789defGHI12",
    "status": "used",
    "customerName": "Nguyễn Văn A",
    "customerEmail": "a@example.com",
    "productName": "Vé tham quan Joyworld",
    "productType": "ticket",
    "thumbnailUrl": "https://...",
    "validityType": "open-dated",
    "orderNumber": "BDUCK-20260425-F68DU",
    "comboItems": null,
    "visitDate": null,
    "validFrom": "2026-04-25T10:00:00.000Z",
    "validUntil": "2026-05-25T10:00:00.000Z",
    "createdAt": "2026-04-25T10:00:00.000Z",
    "usedAt": "2026-04-25T14:30:00.000Z",
    "usedBy": "api_external"
  }
}
```

### Error Codes

| HTTP | Error Code | Meaning |
|------|------------|---------|
| 400 | `MISSING_PASS_ID` | `passId` is empty or missing |
| 404 | `PASS_NOT_FOUND` | No pass found with the given code |
| 422 | `ALREADY_USED` | Pass was already used |
| 422 | `VOIDED` | Pass has been voided/cancelled |
| 422 | `NOT_YET_VALID` | Current time is before `validFrom` |
| 422 | `EXPIRED` | Current time is after `validUntil` |

> [!IMPORTANT]
> **Error responses still include the full `pass` object** — your UI should display the ticket details with a disabled "Use" button.
> Check `pass.status` and `pass.usedAt` to show the usage timestamp.

### Error Example — Already Used

```json
{
  "success": false,
  "error": "ALREADY_USED",
  "message": "Vé đã được sử dụng trước đó",
  "pass": {
    "id": "abc123XYZ789defGHI12",
    "shortCode": "HJV6KPR7EYHJ",
    "qrCode": "BDUCK-PASS-abc123XYZ789defGHI12",
    "status": "used",
    "customerName": "Nguyễn Văn A",
    "customerEmail": "a@example.com",
    "productName": "Vé tham quan Joyworld",
    "productType": "ticket",
    "validityType": "open-dated",
    "orderNumber": "BDUCK-20260425-F68DU",
    "usedAt": "2026-04-25T12:00:00.000Z",
    "usedBy": "api_external"
  }
}
```

### Error Example — Not Found (no pass object)

```json
{
  "success": false,
  "error": "PASS_NOT_FOUND",
  "message": "Vé không tồn tại: XYZ123",
  "pass": null
}
```

---

## 3️⃣ Confirm Payment

**`POST /api/v1/scan/confirm-payment`**

Confirm counter payment for a **pending** order. This will:
1. Mark the order as `paid`
2. Generate passes (tickets) for all items in the order
3. Return the new pass IDs and QR codes

### Request

```bash
curl -X POST "https://your-domain.com/api/v1/scan/confirm-payment" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "orderId": "order_abc123", "note": "Khách thanh toán tiền mặt" }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderId` | string | ✅ | Firestore order document ID |
| `note` | string | ❌ | Optional staff note |

> [!TIP]
> To get the `orderId`, first call `GET /scan?code=BDK-XXXXXX`, then use the `order.id` from the response.

### Success Response

```json
{
  "success": true,
  "message": "Xác nhận thanh toán thành công",
  "order": {
    "id": "order_abc123",
    "orderNumber": "BDUCK-20260425-F68DU",
    "orderCode": "BDK-A3F9X2",
    "status": "paid",
    "finalAmount": 300000,
    "customerName": "Nguyễn Văn A",
    "paidAt": "2026-04-25T14:30:00.000Z"
  },
  "passes": [
    {
      "id": "pass_xyz789...",
      "shortCode": "XYZ789ABCDEF",
      "qrCode": "BDUCK-PASS-pass_xyz789...",
      "status": "active"
    },
    {
      "id": "pass_abc123...",
      "shortCode": "ABC123GHIJKL",
      "qrCode": "BDUCK-PASS-pass_abc123...",
      "status": "active"
    }
  ]
}
```

### Error Codes

| HTTP | Error Code | Meaning |
|------|------------|---------|
| 400 | `MISSING_ORDER_ID` | `orderId` is missing |
| 404 | `ORDER_NOT_FOUND` | Order doesn't exist |
| 422 | `ALREADY_PAID` | Order was already paid |
| 422 | `ALREADY_CANCELLED` | Order was cancelled |
| 422 | `NOT_COUNTER_ORDER` | Order is not a counter payment order |
| 422 | `ORDER_EXPIRED` | Counter order has expired (past 24h) |

---

## 🔄 Typical Integration Flow

### Flow 1: Gate Check-in (QR Scan)

```mermaid
sequenceDiagram
    participant S as Scanner/POS
    participant A as B.Duck API

    S->>A: GET /scan?code=BDUCK-PASS-xxx
    A-->>S: { type: "pass", pass: { status: "active", ... } }

    Note over S: Display pass info on screen
    Note over S: Staff confirms entry

    S->>A: POST /scan/use-pass { passId: "xxx" }
    A-->>S: { success: true, pass: { status: "used" } }

    Note over S: ✅ Allow entry
```

### Flow 2: Counter Payment (Order QR)

```mermaid
sequenceDiagram
    participant S as Scanner/POS
    participant A as B.Duck API

    S->>A: GET /scan?code=BDK-A3F9X2
    A-->>S: { type: "order", order: { status: "pending", finalAmount: 300000 } }

    Note over S: Display amount due
    Note over S: Collect payment from customer

    S->>A: POST /scan/confirm-payment { orderId: "xxx" }
    A-->>S: { success: true, passes: [...] }

    Note over S: 🎟️ Print tickets using pass QR codes
```

### Flow 3: Manual Code Entry

```mermaid
sequenceDiagram
    participant S as Scanner/POS
    participant A as B.Duck API

    Note over S: Staff types "HJV6KPR7EYHJ"
    S->>A: GET /scan?code=HJV6KPR7EYHJ
    A-->>S: { type: "pass", pass: { status: "active", ... } }

    S->>A: POST /scan/use-pass { passId: "HJV6KPR7EYHJ" }
    A-->>S: { success: true }
```

---

## 📊 Pass Status Lifecycle

```
                  ┌──────────┐
   Payment ──────>│  active   │
   confirmed      └─────┬────┘
                        │
              ┌─────────┼─────────┐
              ▼                   ▼
        ┌──────────┐        ┌──────────┐
        │   used   │        │  voided  │
        │ (scanned)│        │ (admin)  │
        └──────────┘        └──────────┘
```

| Status | Meaning | Can be used? |
|--------|---------|:------------:|
| `active` | Valid, ready for use | ✅ |
| `used` | Already scanned/checked-in | ❌ |
| `voided` | Cancelled by admin | ❌ |

---

## 📊 Order Status Lifecycle

```
        ┌──────────┐
        │ pending  │ (waiting for payment)
        └─────┬────┘
              │
    ┌─────────┼─────────┐
    ▼                   ▼
┌──────────┐      ┌───────────┐
│   paid   │      │ cancelled │
│ (success)│      │ (expired/ │
└──────────┘      │  failed)  │
                  └───────────┘
```

---

## 🛡️ Security Notes

1. **Rate limiting**: Not enforced at API level — implement at your load balancer/CDN
2. **HTTPS only**: Never call these APIs over plain HTTP in production
3. **Key rotation**: Change `INTERNAL_API_KEY` in `.env.local` and restart to rotate
4. **Audit trail**: All pass usage is logged with `usedBy: "api_external"` and timestamps

---

## 🧪 Quick Test (cURL)

```bash
# Set your API key
export API_KEY="bduck_sk_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
export BASE="http://localhost:3000/api/v1"

# 1. Scan a code
curl -s "$BASE/scan?code=HJV6KPR7EYHJ" \
  -H "Authorization: Bearer $API_KEY" | jq

# 2. Mark pass as used
curl -s -X POST "$BASE/scan/use-pass" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"passId":"HJV6KPR7EYHJ"}' | jq

# 3. Confirm counter payment
curl -s -X POST "$BASE/scan/confirm-payment" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"YOUR_ORDER_ID"}' | jq
```

> [!NOTE]
> Replace `localhost:3000` with your production domain.
> The `jq` command is optional — formats JSON output for readability.
