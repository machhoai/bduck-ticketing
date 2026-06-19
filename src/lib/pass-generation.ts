/**
 * Shared pass generation utility.
 *
 * Extracted from mock-pay/route.ts to be reused by:
 *   - mock-pay (online payment simulation)
 *   - API v1 confirm-payment (counter payment)
 *   - approveBankTransferOrder (admin bank transfer approval)
 *
 * All operations run inside a caller-provided Firestore Transaction
 * to ensure atomicity.
 */

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { OrderDocument } from "@/types/firestore";

export interface GeneratePassesOptions {
  /** Admin UID who approved (for audit trail in providerData) */
  approverUid?: string;
  /**
   * Skip incrementing product soldCount.
   * Set to true for bank_transfer orders where stock was already
   * reserved at order creation time.
   */
  skipStockIncrement?: boolean;
  /**
   * Extra fields merged into the order update.
   * Use for provider-specific paymentDetails, e.g.:
   *   { paymentDetails: { provider: "payos", providerData: { ... } } }
   */
  orderUpdateExtras?: Record<string, unknown>;
}

/**
 * Generate PassDocuments for a paid order within a Firestore Transaction.
 *
 * Side effects (inside transaction):
 *  1. Create a PassDocument for each order item × quantity
 *  2. Increment product soldCount (unless skipStockIncrement)
 *  3. Increment promotion usedCount (if promotionId present)
 *  4. Update order: status=paid, passIds, paidAt, updatedAt
 *
 * @returns Array of generated pass IDs
 */
export function generatePassesInTransaction(
  tx: FirebaseFirestore.Transaction,
  orderRef: FirebaseFirestore.DocumentReference,
  order: OrderDocument,
  options?: GeneratePassesOptions
): string[] {
  const { skipStockIncrement = false } = options ?? {};
  const now = Timestamp.now();
  const passIds: string[] = [];

  // Generate a PassDocument for each order item × quantity
  for (const item of order.items) {
    for (let i = 0; i < item.quantity; i++) {
      const passRef = adminDb.collection(COLLECTIONS.PASSES).doc();

      // Resolve validity dates from config
      let validFrom: FirebaseFirestore.Timestamp | undefined;
      let validUntil: FirebaseFirestore.Timestamp | undefined;
      let visitDate: FirebaseFirestore.Timestamp | undefined;

      const validity = item.validityConfig;

      if (validity.type === "date-specific" && validity.specificDate) {
        visitDate =
          validity.specificDate as unknown as FirebaseFirestore.Timestamp;
        validUntil =
          validity.specificDate as unknown as FirebaseFirestore.Timestamp;
      } else if (
        validity.type === "open-dated" &&
        validity.validDaysFromPurchase
      ) {
        validFrom = now;
        const expiryMs =
          now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
        validUntil = Timestamp.fromMillis(expiryMs);
      } else if (validity.type === "date-range") {
        validFrom = now;
        if (validity.validDaysFromPurchase) {
          const expiryMs =
            now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
          validUntil = Timestamp.fromMillis(expiryMs);
        }
        if (validity.overallExpiresAt)
          validUntil =
            validity.overallExpiresAt as unknown as FirebaseFirestore.Timestamp;
      } else if (validity.type === "time-slot") {
        validFrom = now;
        if (validity.validDaysFromPurchase) {
          const expiryMs =
            now.toMillis() + validity.validDaysFromPurchase * 86400 * 1000;
          validUntil = Timestamp.fromMillis(expiryMs);
        }
        if (validity.overallExpiresAt)
          validUntil =
            validity.overallExpiresAt as unknown as FirebaseFirestore.Timestamp;
      }

      // Override with hard deadline if set
      if (validity.overallExpiresAt) {
        validUntil =
          validity.overallExpiresAt as unknown as FirebaseFirestore.Timestamp;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const passData: Record<string, any> = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId ?? "",
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        productId: item.productId,
        productName: item.productName,
        productType: item.productType,
        thumbnailUrl: item.thumbnailUrl ?? "",
        validityType: validity.type,
        status: "active",
        createdAt: now,
      };

      // Only set optional fields if they have values (Firestore rejects undefined)
      if (item.comboItems) passData.comboItems = item.comboItems;
      if (visitDate) passData.visitDate = visitDate;
      if (validFrom) passData.validFrom = validFrom;
      if (validUntil) passData.validUntil = validUntil;
      if (validity.timeSlotStart) passData.timeSlotStart = validity.timeSlotStart;
      if (validity.timeSlotEnd) passData.timeSlotEnd = validity.timeSlotEnd;
      if (validity.allowedDaysOfWeek?.length) passData.allowedDaysOfWeek = validity.allowedDaysOfWeek;
      if (order.affiliateId) passData.affiliateId = order.affiliateId;

      tx.set(passRef, passData);
      passIds.push(passRef.id);
    }

    // Increment product soldCount — skip for bank_transfer (already reserved)
    if (!skipStockIncrement) {
      const productRef = adminDb
        .collection(COLLECTIONS.PRODUCTS)
        .doc(item.productId);
      tx.update(productRef, {
        soldCount: FieldValue.increment(item.quantity),
      });
    }
  }

  // Increment promotion usedCount
  if (order.promotionId) {
    const promoRef = adminDb
      .collection(COLLECTIONS.PROMOTIONS)
      .doc(order.promotionId);
    tx.update(promoRef, { usedCount: FieldValue.increment(1) });
  }

  // Update order to paid
  tx.update(orderRef, {
    status: "paid",
    passIds,
    paidAt: now,
    updatedAt: now,
    ...(options?.orderUpdateExtras ?? {}),
  });

  return passIds;
}
