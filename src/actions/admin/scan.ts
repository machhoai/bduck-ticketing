"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { PassDocument } from "@/types/firestore";

export interface ScanResult {
  valid: boolean;
  pass?: PassDocument;
  errorCode?:
    | "not_found"
    | "already_used"
    | "voided"
    | "expired"
    | "not_yet_valid";
  errorMessage?: string;
}

/**
 * Gate scanner action — validates and marks a pass as used.
 * Firestore Transaction ensures idempotency (D1 pattern for scan).
 *
 * QR payload format: "BDUCK-PASS-{passId}" (D2)
 */
export async function validatePass(qrPayload: string): Promise<ScanResult> {
  const session = await requireAdmin();

  // Parse QR payload
  const PREFIX = "BDUCK-PASS-";
  if (!qrPayload.startsWith(PREFIX)) {
    return { valid: false, errorCode: "not_found", errorMessage: "QR không hợp lệ" };
  }
  const passId = qrPayload.slice(PREFIX.length);

  const passRef = adminDb.collection(COLLECTIONS.PASSES).doc(passId);

  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(passRef);

      if (!snap.exists) {
        return { valid: false, errorCode: "not_found" as const, errorMessage: "Vé không tồn tại" };
      }

      const pass = { id: snap.id, ...snap.data() } as PassDocument;

      // Status checks
      if (pass.status === "used") {
        return { valid: false, errorCode: "already_used" as const, errorMessage: "Vé đã được sử dụng" };
      }
      if (pass.status === "voided") {
        return { valid: false, errorCode: "voided" as const, errorMessage: "Vé đã bị vô hiệu hóa" };
      }

      // Validity date checks
      const now = Timestamp.now();
      if (pass.validFrom && now.toMillis() < pass.validFrom.toMillis()) {
        return { valid: false, errorCode: "not_yet_valid" as const, errorMessage: "Vé chưa đến ngày sử dụng" };
      }
      if (pass.validUntil && now.toMillis() > pass.validUntil.toMillis()) {
        return { valid: false, errorCode: "expired" as const, errorMessage: "Vé đã hết hạn" };
      }

      // Mark as used
      tx.update(passRef, {
        status: "used",
        usedAt: now,
        usedBy: session.uid,
        scanCount: FieldValue.increment(1),
      });

      return { valid: true, pass };
    });

    return result;
  } catch (err) {
    console.error("[validatePass]", err);
    return { valid: false, errorCode: "not_found", errorMessage: "Lỗi hệ thống, thử lại" };
  }
}
