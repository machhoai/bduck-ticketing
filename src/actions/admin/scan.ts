"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { OrderDocument, PassDocument } from "@/types/firestore";

export interface ScanResult {
  valid: boolean;
  type?: "pass" | "order";
  pass?: PassDocument;
  order?: OrderDocument;
  errorCode?: "not_found";
  errorMessage?: string;
}

/**
 * Unified scanner — accepts ANY code, READ-ONLY (no status changes).
 * Use markPassUsed() or confirmCounterPayment() to change state.
 *
 * Detection order:
 *   1. "BDUCK-PASS-{passId}" → pass lookup (legacy QR backward compat)
 *   2. "BDK-XXXXXX"          → order lookup by orderCode (fast path)
 *   3. Free-form             → passId → shortCode → orderNumber → orderCode
 */
export async function validatePass(qrPayload: string): Promise<ScanResult> {
  await requireAdmin();
  const trimmed = qrPayload.trim();

  if (!trimmed) {
    return { valid: false, errorCode: "not_found", errorMessage: "Mã không được để trống" };
  }

  const upper = trimmed.toUpperCase();

  // ── Fast path: pass code ──
  if (upper.startsWith("BDUCK-PASS-")) {
    const passId = trimmed.slice("BDUCK-PASS-".length);
    return handlePassLookup(passId);
  }

  // ── Fast path: order code ──
  if (upper.startsWith("BDK-")) {
    const orderResult = await findAndProcessOrder("orderCode", upper);
    if (orderResult) return orderResult;
    return { valid: false, errorCode: "not_found", errorMessage: `Không tìm thấy đơn hàng với mã ${upper}` };
  }

  // ── Free-form: try all strategies ──
  return handleFreeFormScan(trimmed);
}

/**
 * Mark a pass as used — called when admin clicks "Sử dụng vé".
 * Validates status + dates inside a transaction for safety.
 */
export async function markPassUsed(passId: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  const passRef = adminDb.collection(COLLECTIONS.PASSES).doc(passId);

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(passRef);
      if (!snap.exists) return { success: false, error: "Vé không tồn tại" };

      const pass = snap.data() as PassDocument;

      if (pass.status === "used") return { success: false, error: "Vé đã được sử dụng trước đó" };
      if (pass.status === "voided") return { success: false, error: "Vé đã bị vô hiệu hóa" };

      const now = Timestamp.now();
      if (pass.validFrom && now.toMillis() < pass.validFrom.toMillis()) {
        return { success: false, error: "Vé chưa đến ngày sử dụng" };
      }
      if (pass.validUntil && now.toMillis() > pass.validUntil.toMillis()) {
        return { success: false, error: "Vé đã hết hạn" };
      }

      tx.update(passRef, {
        status: "used",
        usedAt: now,
        usedBy: session.uid,
        scanCount: FieldValue.increment(1),
      });

      return { success: true };
    });
  } catch (err) {
    console.error("[markPassUsed]", err);
    return { success: false, error: "Lỗi hệ thống, thử lại" };
  }
}

// ── Free-form search ──────────────────────────────────────────────────────────

async function handleFreeFormScan(input: string): Promise<ScanResult> {
  const upper = input.toUpperCase();

  // 1. Try as raw passId (exact Firestore doc ID)
  const passResult = await handlePassLookup(input);
  if (passResult.valid || passResult.errorCode !== "not_found") {
    return passResult;
  }

  // 2. Try as pass short code (last 12 chars shown on ticket/email)
  const byShortCode = await findPassByShortCode(upper);
  if (byShortCode) return byShortCode;

  // 3. Try as orderNumber (e.g. "BDUCK-20260425-F68DU")
  const byNumber = await findAndProcessOrder("orderNumber", upper);
  if (byNumber) return byNumber;

  // 4. Try as orderCode
  const byCode = await findAndProcessOrder("orderCode", upper);
  if (byCode) return byCode;

  // 5. Nothing matched
  return {
    valid: false,
    errorCode: "not_found",
    errorMessage: `Không tìm thấy vé hoặc đơn hàng với mã "${input}"`,
  };
}

// ── Pass short code search ────────────────────────────────────────────────────

async function findPassByShortCode(shortCode: string): Promise<ScanResult | null> {
  if (shortCode.length < 6 || shortCode.length >= 20) return null;

  try {
    const snap = await adminDb
      .collection(COLLECTIONS.PASSES)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const lowerShort = shortCode.toLowerCase();
    const match = snap.docs.find((doc) => doc.id.toLowerCase().endsWith(lowerShort));
    if (!match) return null;

    return handlePassLookup(match.id);
  } catch (err) {
    console.error("[findPassByShortCode]", err);
    return null;
  }
}

// ── Order lookup & processing ──────────────────────────────────────────────────

async function findAndProcessOrder(
  field: "orderNumber" | "orderCode",
  value: string,
): Promise<ScanResult | null> {
  try {
    const snap = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .where(field, "==", value)
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0];
    let order = { id: doc.id, ...(doc.data() as Omit<OrderDocument, "id">) } as OrderDocument;

    // Lazy timeout: auto-cancel expired pending counter orders
    if (
      order.status === "pending" &&
      order.expiresAt &&
      Timestamp.now().toMillis() > order.expiresAt.toMillis()
    ) {
      const now = Timestamp.now();
      await doc.ref.update({
        status: "cancelled",
        cancelledAt: now,
        cancelReason: "counter_expired",
        updatedAt: now,
      });
      order = { ...order, status: "cancelled", cancelReason: "counter_expired" } as OrderDocument;
    }

    const safeOrder = JSON.parse(JSON.stringify(order));
    return { valid: true, type: "order", order: safeOrder };
  } catch (err) {
    console.error(`[findAndProcessOrder:${field}]`, err);
    return null;
  }
}

// ── Pass lookup (READ-ONLY — no status changes) ─────────────────────────────

async function handlePassLookup(passId: string): Promise<ScanResult> {
  if (!passId) {
    return { valid: false, type: "pass", errorCode: "not_found", errorMessage: "Mã vé thiếu ID" };
  }

  try {
    const snap = await adminDb.collection(COLLECTIONS.PASSES).doc(passId).get();

    if (!snap.exists) {
      return { valid: false, type: "pass", errorCode: "not_found", errorMessage: "Vé không tồn tại" };
    }

    const pass = { id: snap.id, ...snap.data() } as PassDocument;
    const safePass = JSON.parse(JSON.stringify(pass));
    return { valid: true, type: "pass", pass: safePass };
  } catch (err) {
    console.error("[handlePassLookup]", err);
    return { valid: false, type: "pass", errorCode: "not_found", errorMessage: "Lỗi hệ thống, thử lại" };
  }
}
