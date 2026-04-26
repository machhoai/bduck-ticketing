"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { CounterPayData, BankTransferPayData, OrderDocument, PassDocument } from "@/types/firestore";
import { generatePassesInTransaction } from "@/lib/pass-generation";
import { sendTicketEmail } from "@/lib/email/tickets";
import { sendTransferCancelEmail } from "@/lib/email/transfer-cancel";
import { issueVouchersFromOrderItems } from "@/lib/deal-checkout";

export type AdminActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface AdminOrderFilters {
  status?: "pending" | "paid" | "cancelled";
  search?: string; // orderNumber or email
  limit?: number;
  startAfter?: string; // last doc ID for cursor pagination
}

export type AdminOrderWithPasses = OrderDocument & { passes: PassDocument[] };

// ─── Get Orders (paginated) ───────────────────────────────────────────────────
export async function getAdminOrders(
  filters: AdminOrderFilters = {}
): Promise<{ orders: OrderDocument[]; hasMore: boolean }> {
  await requireAdmin();

  const { status, limit = 20, startAfter } = filters;

  let query = adminDb
    .collection(COLLECTIONS.ORDERS)
    .orderBy("createdAt", "desc");

  if (status) {
    query = query.where("status", "==", status) as typeof query;
  }

  if (startAfter) {
    const cursorDoc = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .doc(startAfter)
      .get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc) as typeof query;
    }
  }

  const snap = await query.limit(limit + 1).get();

  const hasMore = snap.docs.length > limit;
  const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

  const orders = docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<OrderDocument, "id">),
  }));

  // Client-side search filter (Firestore doesn't support full-text search natively)
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const filtered = orders.filter(
      (o) =>
        o.orderNumber?.toLowerCase().includes(q) ||
        o.customerEmail?.toLowerCase().includes(q) ||
        o.customerName?.toLowerCase().includes(q)
    );
    return { orders: filtered, hasMore };
  }

  return { orders, hasMore };
}

// ─── Get Order By ID (admin — includes passes) ────────────────────────────────
export async function getAdminOrderById(
  orderId: string
): Promise<AdminOrderWithPasses | null> {
  await requireAdmin();

  const orderDoc = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .doc(orderId)
    .get();

  if (!orderDoc.exists) return null;

  const order = {
    id: orderDoc.id,
    ...(orderDoc.data() as Omit<OrderDocument, "id">),
  };

  const passesSnap = await adminDb
    .collection(COLLECTIONS.PASSES)
    .where("orderId", "==", orderId)
    .get();

  const passes = passesSnap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<PassDocument, "id">),
  }));

  return { ...order, passes };
}

// ─── Void Pass ────────────────────────────────────────────────────────────────
export async function voidPass(
  passId: string,
  reason: string
): Promise<AdminActionResult> {
  const session = await requireAdmin();

  const passRef = adminDb.collection(COLLECTIONS.PASSES).doc(passId);
  const passDoc = await passRef.get();

  if (!passDoc.exists) {
    return { success: false, error: "Vé không tồn tại" };
  }

  const pass = passDoc.data() as PassDocument;
  if (pass.status === "voided") {
    return { success: false, error: "Vé đã bị vô hiệu hóa trước đó" };
  }

  await passRef.update({
    status: "voided",
    voidedAt: Timestamp.now(),
    voidedBy: session.uid,
    voidReason: reason,
  });

  return { success: true };
}

// ─── Lookup Counter Order by QR Code (Lazy Timeout Check) ────────────────────────

export type CounterLookupErrorCode =
  | "not_found"    // orderCode không tồn tại
  | "already_paid" // đơn đã được thanh toán trước đó
  | "cancelled"    // đơn đã bị huỷ thủ công
  | "expired";     // đơn quá 24h, chưa thanh toán → tự động cancel

export interface CounterLookupResult {
  found: boolean;
  order?: OrderDocument;
  errorCode?: CounterLookupErrorCode;
  errorMessage?: string;
}

/**
 * Tìm đơn hàng counter bằng orderCode được quét tại Admin Panel.
 * Thực hiện lazy timeout check: nếu expiresAt < now() → tự động cancel đơn.
 *
 * Flow:
 *   1. Query where("orderCode", "==", code) — một index read duy nhất.
 *   2. Kiểm tra status: nếu đã paid/cancelled → trả lỗi người dùng biết.
 *   3. Kiểm tra expiresAt: nếu hết hạn → cập nhật status='cancelled' rồi trả lỗi.
 *   4. Trả về OrderDocument để Admin Panel hiển thị và cho phép bấm xác nhận.
 */
export async function lookupOrderByCode(
  orderCode: string
): Promise<CounterLookupResult> {
  await requireAdmin();

  if (!orderCode?.trim()) {
    return { found: false, errorCode: "not_found", errorMessage: "Mã đơn hàng không hợp lệ" };
  }

  // Normalize: uppercase, trim whitespace
  const code = orderCode.trim().toUpperCase();

  const snap = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("orderCode", "==", code)
    .limit(1)
    .get();

  if (snap.empty) {
    return {
      found: false,
      errorCode: "not_found",
      errorMessage: `Không tìm thấy đơn hàng với mã ${code}`,
    };
  }

  const doc = snap.docs[0];
  const order = { id: doc.id, ...(doc.data() as Omit<OrderDocument, "id">) };

  // ── Trạng thái không hợp lệ ──
  if (order.status === "paid") {
    return {
      found: false,
      errorCode: "already_paid",
      errorMessage: `Đơn ${order.orderNumber} đã được thanh toán trước đó`,
    };
  }

  if (order.status === "cancelled") {
    return {
      found: false,
      errorCode: "cancelled",
      errorMessage: `Đơn ${order.orderNumber} đã bị huỷ`,
    };
  }

  // ── Lazy timeout check (D4 + D5) ───────────────────────────────────────────
  if (order.expiresAt && Timestamp.now().toMillis() > order.expiresAt.toMillis()) {
    // Tự động cancel đơn hết hạn — cancelReason "counter_expired" phân biệt cancel thủ công
    await doc.ref.update({
      status: "cancelled",
      cancelledAt: Timestamp.now(),
      cancelReason: "counter_expired",
      updatedAt: Timestamp.now(),
    });

    return {
      found: false,
      errorCode: "expired",
      errorMessage: `Đơn ${order.orderNumber} đã hết hạn (quá 24 giờ kể từ lúc đặt)`,
    };
  }

  return { found: true, order };
}

// ─── Confirm Counter Payment ───────────────────────────────────────────────────────────

/**
 * Admin bấm "Xác nhận đã thanh toán" — cập nhật đơn counter từ pending → paid.
 *
 * Dùng Firestore Transaction để đảm bảo:
 *   - Idempotency: nếu admin bấm 2 lần, lần 2 sẽ fail thay vì tạo pass trùng.
 *   - Atomic: status update + audit trail trong một write duy nhất.
 *
 * @param orderId  Firestore document ID của đơn hàng
 * @param note     Ghi chú nội bộ tuỳ chọn của nhân viên (v.d. "Khách trả tiền mặt")
 */
export async function confirmCounterPayment(
  orderId: string,
  note?: string
): Promise<AdminActionResult<{ orderId: string }>> {
  const session = await requireAdmin();

  const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);

      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");

      const order = snap.data() as Omit<OrderDocument, "id">;

      // Idempotency guard
      if (order.status === "paid") throw new Error("ALREADY_PAID");
      if (order.status === "cancelled") throw new Error("ALREADY_CANCELLED");

      // Sanity check: chỉ confirm được đơn counter
      if (order.paymentDetails?.provider !== "counter") {
        throw new Error("NOT_COUNTER_ORDER");
      }

      const now = Timestamp.now();

      // Populate audit trail vào CounterPayData
      const updatedProviderData: CounterPayData = {
        confirmedBy: session.uid,
        confirmedAt: now,
        ...(note ? { note } : {}),
      };

      tx.update(orderRef, {
        status: "paid",
        paidAt: now,
        updatedAt: now,
        "paymentDetails.providerData": updatedProviderData,
      });
    });

    // Fire-and-forget: issue deal vouchers
    const updatedSnap = await orderRef.get();
    const updatedOrder = { id: updatedSnap.id, ...updatedSnap.data() } as OrderDocument;
    issueVouchersFromOrderItems(updatedOrder).catch((err) =>
      console.error("[confirmCounterPayment] Voucher issuance failed (non-fatal):", err)
    );

    return { success: true, data: { orderId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";

    const errorMap: Record<string, string> = {
      ORDER_NOT_FOUND: "Đơn hàng không tồn tại",
      ALREADY_PAID: "Đơn hàng đã được thanh toán trước đó",
      ALREADY_CANCELLED: "Đơn hàng đã bị huỷ, không thể xác nhận",
      NOT_COUNTER_ORDER: "Đơn hàng này không phải thanh toán tại quầy",
    };

    console.error("[confirmCounterPayment]", err);
    return {
      success: false,
      error: errorMap[message] ?? "Lỗi hệ thống, vui lòng thử lại",
    };
  }
}

// ─── Bank Transfer: Approve Order ────────────────────────────────────────────
/**
 * Approve a pending bank_transfer order.
 * Uses Firestore Transaction + shared pass generation.
 * skipStockIncrement = true because stock was already reserved at order creation.
 */
export async function approveBankTransferOrder(
  orderId: string,
  note?: string
): Promise<AdminActionResult<{ passIds: string[] }>> {
  const session = await requireAdmin();

  const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);

  try {
    const passIds: string[] = [];

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");

      const order = { id: snap.id, ...snap.data() } as OrderDocument;

      // Idempotency
      if (order.status === "paid") throw new Error("ALREADY_PAID");
      if (order.status === "cancelled") throw new Error("ALREADY_CANCELLED");
      if (order.paymentDetails?.provider !== "bank_transfer")
        throw new Error("NOT_BANK_TRANSFER_ORDER");

      // Generate passes — skipStockIncrement because stock was reserved at order creation
      const generatedIds = generatePassesInTransaction(tx, orderRef, order, {
        skipStockIncrement: true,
        approverUid: session.uid,
      });
      passIds.push(...generatedIds);

      // Update providerData with approval info
      const providerData: BankTransferPayData = {
        ...(order.paymentDetails!.providerData as BankTransferPayData),
        approvedBy: session.uid,
        approvedAt: Timestamp.now() as unknown as import("@/types/firestore").Timestamp,
        ...(note ? { note } : {}),
      };

      tx.update(orderRef, {
        "paymentDetails.providerData": providerData,
      });
    });

    // Fire-and-forget: send ticket email
    const updatedSnap = await orderRef.get();
    const updated = { id: updatedSnap.id, ...updatedSnap.data() } as OrderDocument;

    sendTicketEmail({
      to: updated.customerEmail,
      customerName: updated.customerName,
      orderId,
      orderNumber: updated.orderNumber,
      items: updated.items.map((i) => ({
        productName: i.productName,
        productType: i.productType,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      finalAmount: updated.finalAmount,
      discountAmount: updated.discountAmount,
      passIds,
    }).catch((err) =>
      console.error("[approveBankTransferOrder] Ticket email failed:", err)
    );

    // Fire-and-forget: issue deal vouchers
    issueVouchersFromOrderItems(updated as OrderDocument).catch((err) =>
      console.error("[approveBankTransferOrder] Voucher issuance failed (non-fatal):", err)
    );

    return { success: true, data: { passIds } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    const errorMap: Record<string, string> = {
      ORDER_NOT_FOUND: "Đơn hàng không tồn tại",
      ALREADY_PAID: "Đơn hàng đã được duyệt trước đó",
      ALREADY_CANCELLED: "Đơn hàng đã bị huỷ",
      NOT_BANK_TRANSFER_ORDER: "Đơn hàng này không phải chuyển khoản",
    };
    console.error("[approveBankTransferOrder]", err);
    return { success: false, error: errorMap[message] ?? "Lỗi hệ thống" };
  }
}

// ─── Bank Transfer: Cancel Order ─────────────────────────────────────────────
/**
 * Cancel a bank_transfer order. Admin can ONLY cancel expired orders (>30 min).
 * Rolls back stock (decrement soldCount) and sends bilingual cancel email.
 */
export async function cancelBankTransferOrder(
  orderId: string,
  reason: string,
  adminNote?: string
): Promise<AdminActionResult> {
  await requireAdmin();

  const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);

  try {
    let customerEmail = "";
    let customerName = "";
    let orderNumber = "";
    let finalAmount = 0;

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) throw new Error("ORDER_NOT_FOUND");

      const order = snap.data() as Omit<OrderDocument, "id">;

      if (order.status !== "pending") throw new Error("NOT_PENDING");
      if (order.paymentDetails?.provider !== "bank_transfer")
        throw new Error("NOT_BANK_TRANSFER_ORDER");

      // Enforce: admin can only cancel EXPIRED orders
      const now = Timestamp.now();
      if (order.expiresAt && now.toMillis() < order.expiresAt.toMillis()) {
        throw new Error("ORDER_NOT_EXPIRED_YET");
      }

      // Capture for email
      customerEmail = order.customerEmail;
      customerName = order.customerName;
      orderNumber = order.orderNumber;
      finalAmount = order.finalAmount;

      // Stock rollback — decrement soldCount for each product
      for (const item of order.items) {
        const productRef = adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .doc(item.productId);
        tx.update(productRef, {
          soldCount: FieldValue.increment(-item.quantity),
        });
      }

      // Update order
      tx.update(orderRef, {
        status: "cancelled",
        cancelledAt: now,
        cancelReason: reason || "bank_transfer_expired",
        adminNotes: adminNote || undefined,
        updatedAt: now,
      });
    });

    // Fire-and-forget: send cancel email to customer
    if (customerEmail) {
      sendTransferCancelEmail({
        to: customerEmail,
        customerName,
        orderNumber,
        finalAmount,
        cancelReason: reason,
      })
        .then(() => {
          // Mark email as sent
          orderRef.update({ cancelEmailSent: true }).catch(() => {});
        })
        .catch((err) =>
          console.error("[cancelBankTransferOrder] Cancel email failed:", err)
        );
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNKNOWN";
    const errorMap: Record<string, string> = {
      ORDER_NOT_FOUND: "Đơn hàng không tồn tại",
      NOT_PENDING: "Đơn hàng không ở trạng thái chờ",
      NOT_BANK_TRANSFER_ORDER: "Đơn hàng này không phải chuyển khoản",
      ORDER_NOT_EXPIRED_YET: "Chưa thể hủy — đơn hàng chưa quá hạn 30 phút",
    };
    console.error("[cancelBankTransferOrder]", err);
    return { success: false, error: errorMap[message] ?? "Lỗi hệ thống" };
  }
}

// ─── Bank Transfer: Update Admin Notes ───────────────────────────────────────
export async function updateTransferOrderNote(
  orderId: string,
  note: string
): Promise<AdminActionResult> {
  await requireAdmin();

  try {
    await adminDb.collection(COLLECTIONS.ORDERS).doc(orderId).update({
      adminNotes: note,
      updatedAt: Timestamp.now(),
    });
    return { success: true };
  } catch {
    return { success: false, error: "Không thể cập nhật ghi chú" };
  }
}

// ─── Bank Transfer: Get Transfer Orders for Admin ───────────────────────────
/**
 * Fetch bank_transfer orders for admin approval page.
 * Returns pending orders first (expired ones at top), then recent paid/cancelled.
 */
export async function getAdminTransferOrders(): Promise<OrderDocument[]> {
  await requireAdmin();

  // Fetch recent orders (last 200) and filter by bank_transfer
  const snap = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  const orders = snap.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<OrderDocument, "id">),
    }))
    .filter((o) => o.paymentDetails?.provider === "bank_transfer");

  // Sort: pending first (expired at top), then paid, then cancelled
  const now = Date.now();
  return orders.sort((a, b) => {
    // Priority: pending > paid > cancelled
    const statusOrder = { pending: 0, paid: 1, cancelled: 2 };
    const aStatus = statusOrder[a.status] ?? 3;
    const bStatus = statusOrder[b.status] ?? 3;

    if (aStatus !== bStatus) return aStatus - bStatus;

    // Within pending: expired first
    if (a.status === "pending" && b.status === "pending") {
      const aExpired = a.expiresAt && now > a.expiresAt.toMillis();
      const bExpired = b.expiresAt && now > b.expiresAt.toMillis();
      if (aExpired && !bExpired) return -1;
      if (!aExpired && bExpired) return 1;
    }

    // Otherwise by createdAt desc
    return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
  });
}
