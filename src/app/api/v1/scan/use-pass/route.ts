/**
 * POST /api/v1/scan/use-pass
 *
 * Mark a pass as "used" — called when gate staff confirms entry.
 * Uses a Firestore transaction for idempotency and validates:
 *   - Pass exists
 *   - Pass is not already used or voided
 *   - Current time is within validity window (validFrom ↔ validUntil)
 *
 * Body: { passId: string }
 * Auth: Bearer <INTERNAL_API_KEY>
 */

import { verifyApiKey, unauthorizedResponse } from "@/lib/api/verify-api-key";
import { serverErrorResponse, validateCode, validateJsonBodySize } from "@/lib/api/request-guards";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import type { PassDocument } from "@/types/firestore";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  if (!verifyApiKey(req)) return unauthorizedResponse();
  const invalidBodySizeResponse = validateJsonBodySize(req);
  if (invalidBodySizeResponse) return invalidBodySizeResponse;

  // ── Parse body ────────────────────────────────────────────────────────────
  let passId: string;
  try {
    const body = await req.json();
    passId = typeof body?.passId === "string" ? body.passId.trim() : "";
  } catch {
    return Response.json(
      { success: false, error: "INVALID_BODY", message: "Request body must be JSON with { passId: string }" },
      { status: 400 }
    );
  }

  if (!passId) {
    return Response.json(
      { success: false, error: "MISSING_PASS_ID", message: "passId is required" },
      { status: 400 }
    );
  }
  const invalidPassIdResponse = validateCode(passId, "passId");
  if (invalidPassIdResponse) return invalidPassIdResponse;

  // ── Resolve short code → full ID if needed ────────────────────────────────
  let resolvedId: string | null;
  try {
    resolvedId = await resolvePassId(passId);
  } catch (err) {
    return serverErrorResponse("[API use-pass resolve]", err);
  }
  if (!resolvedId) {
    return Response.json(
      { success: false, error: "PASS_NOT_FOUND", message: `Vé không tồn tại: ${passId}` },
      { status: 404 }
    );
  }

  const passRef = adminDb.collection(COLLECTIONS.PASSES).doc(resolvedId);

  // ── Atomic update via transaction ─────────────────────────────────────────
  try {
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(passRef);
      if (!snap.exists) return { error: "PASS_NOT_FOUND", status: 404, message: "Vé không tồn tại" };

      const pass = snap.data() as PassDocument;

      // Always build pass info for the response (even on error)
      const tsToISO = (ts: { toMillis?: () => number; toDate?: () => Date } | undefined | null): string | null => {
        if (!ts) return null;
        if (typeof ts === "object" && "toDate" in ts && ts.toDate) return ts.toDate().toISOString();
        if (typeof ts === "object" && "toMillis" in ts && ts.toMillis) return new Date(ts.toMillis()).toISOString();
        return null;
      };

      const passInfo = {
        id: resolvedId,
        shortCode: resolvedId.slice(-12).toUpperCase(),
        qrCode: resolvedId,
        status: pass.status,
        customerName: pass.customerName,
        customerEmail: pass.customerEmail,
        productName: pass.productName,
        productType: pass.productType,
        thumbnailUrl: pass.thumbnailUrl ?? null,
        validityType: pass.validityType,
        orderNumber: pass.orderNumber,
        comboItems: pass.comboItems ?? null,
        visitDate: tsToISO(pass.visitDate as never),
        validFrom: tsToISO(pass.validFrom as never),
        validUntil: tsToISO(pass.validUntil as never),
        timeSlotStart: pass.timeSlotStart ?? null,
        timeSlotEnd: pass.timeSlotEnd ?? null,
        allowedDaysOfWeek: pass.allowedDaysOfWeek ?? null,
        createdAt: tsToISO(pass.createdAt as never),
        usedAt: tsToISO(pass.usedAt as never),
        usedBy: pass.usedBy ?? null,
      };

      if (pass.status === "used") {
        return { error: "ALREADY_USED", status: 422, message: "Vé đã được sử dụng trước đó", pass: passInfo };
      }
      if (pass.status === "voided") {
        return { error: "VOIDED", status: 422, message: "Vé đã bị vô hiệu hóa", pass: passInfo };
      }

      const now = Timestamp.now();
      if (pass.validFrom && now.toMillis() < pass.validFrom.toMillis()) {
        return { error: "NOT_YET_VALID", status: 422, message: "Vé chưa đến ngày sử dụng", pass: passInfo };
      }
      if (pass.validUntil && now.toMillis() > pass.validUntil.toMillis()) {
        return { error: "EXPIRED", status: 422, message: "Vé đã hết hạn", pass: passInfo };
      }

      if (pass.validityType === "time-slot" && pass.timeSlotStart && pass.timeSlotEnd) {
        const formatter = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
        });
        const vnTimeStr = formatter.format(new Date(now.toMillis()));
        const [currentHour, currentMinute] = vnTimeStr.split(":").map(Number);
        const currentTotalMinutes = currentHour * 60 + currentMinute;
        
        const [startHour, startMinute] = pass.timeSlotStart.split(":").map(Number);
        const startTotalMinutes = startHour * 60 + startMinute;
        
        const [endHour, endMinute] = pass.timeSlotEnd.split(":").map(Number);
        const endTotalMinutes = endHour * 60 + endMinute;
        
        if (currentTotalMinutes < startTotalMinutes || currentTotalMinutes > endTotalMinutes) {
          return { error: "OUT_OF_TIME_SLOT", status: 422, message: `Vé chỉ có thể kích hoạt trong khung giờ ${pass.timeSlotStart} - ${pass.timeSlotEnd}`, pass: passInfo };
        }
      }

      // Day-of-week restriction (time-slot only)
      if (pass.validityType === "time-slot" && pass.allowedDaysOfWeek?.length) {
        const VN_DAY_NAMES = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
        const vnDate = new Date(now.toMillis());
        const vnDayStr = new Intl.DateTimeFormat("en-US", {
          timeZone: "Asia/Ho_Chi_Minh",
          weekday: "short",
        }).format(vnDate);
        const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const currentDay = dayMap[vnDayStr] ?? vnDate.getDay();

        if (!pass.allowedDaysOfWeek.includes(currentDay)) {
          const todayName = VN_DAY_NAMES[currentDay];
          const allowedNames = pass.allowedDaysOfWeek
            .sort((a, b) => a - b)
            .map((d) => VN_DAY_NAMES[d])
            .join(", ");
          return {
            error: "WRONG_DAY_OF_WEEK",
            status: 422,
            message: `Vé không áp dụng cho ${todayName}. Chỉ sử dụng vào: ${allowedNames}`,
            pass: passInfo,
          };
        }
      }

      tx.update(passRef, {
        status: "used",
        usedAt: now,
        usedBy: "api_external",
        scanCount: FieldValue.increment(1),
      });

      return {
        success: true,
        pass: {
          ...passInfo,
          status: "used",
          usedAt: new Date(now.toMillis()).toISOString(),
          usedBy: "api_external",
        },
      };
    });

    if ("error" in result) {
      return Response.json(
        { success: false, error: result.error, message: result.message, pass: result.pass ?? null },
        { status: result.status }
      );
    }

    return Response.json({ success: true, message: "Vé đã được sử dụng thành công", pass: result.pass });
  } catch (err) {
    console.error("[API use-pass]", err);
    return Response.json(
      { success: false, error: "SERVER_ERROR", message: "Lỗi hệ thống, vui lòng thử lại" },
      { status: 500 }
    );
  }
}

// ── Short code resolver ───────────────────────────────────────────────────────

async function resolvePassId(input: string): Promise<string | null> {
  // 1. Strip BDUCK-PASS- prefix if present
  const cleaned = input.toUpperCase().startsWith("BDUCK-PASS-")
    ? input.slice("BDUCK-PASS-".length)
    : input;

  // 2. Try exact ID first
  const exactSnap = await adminDb.collection(COLLECTIONS.PASSES).doc(cleaned).get();
  if (exactSnap.exists) return cleaned;

  // 3. Try as short code (6..19 chars)
  if (cleaned.length >= 6 && cleaned.length < 20) {
    const snap = await adminDb
      .collection(COLLECTIONS.PASSES)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const lower = cleaned.toLowerCase();
    const match = snap.docs.find((doc) => doc.id.toLowerCase().endsWith(lower));
    if (match) return match.id;
  }

  return null;
}
