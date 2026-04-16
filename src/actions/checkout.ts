"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { getEffectivePrice } from "@/actions/products";
import type {
  CartItemInput,
  OrderDocument,
  OrderItem,
  ProductDocument,
  PromotionDocument,
} from "@/types/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { verifySession } from "@/lib/auth/session";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; errorKey: string; message?: string };

export interface PromoValidationResult {
  valid: boolean;
  discountAmount: number;
  promotionId?: string;
  promotionCode?: string;
  errorKey?: string;
  message?: string; // extra context e.g. minOrderValue amount
}

export interface CreateOrderInput {
  items: CartItemInput[]; // Only productId + quantity — prices re-fetched server-side (D5)
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerId?: string; // Firebase Auth UID — empty = guest order
  promoCode?: string;
  affiliateCode?: string;
}

// ─── Validate Promo Code ──────────────────────────────────────────────────────
export async function validatePromoCode(
  code: string,
  cartItems: CartItemInput[],
  customerEmail: string
): Promise<PromoValidationResult> {
  if (!code?.trim()) {
    return { valid: false, discountAmount: 0, errorKey: "promo.empty" };
  }

  const upperCode = code.trim().toUpperCase();

  // Find promo by code
  const promoSnap = await adminDb
    .collection(COLLECTIONS.PROMOTIONS)
    .where("code", "==", upperCode)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (promoSnap.empty) {
    return { valid: false, discountAmount: 0, errorKey: "promo.not_found" };
  }

  const promoDoc = promoSnap.docs[0];
  const promo = { id: promoDoc.id, ...promoDoc.data() } as PromotionDocument;

  // Date range check
  const now = Timestamp.now();
  if (promo.startAt && now.toMillis() < promo.startAt.toMillis()) {
    return { valid: false, discountAmount: 0, errorKey: "promo.not_started" };
  }
  if (promo.endAt && now.toMillis() > promo.endAt.toMillis()) {
    return { valid: false, discountAmount: 0, errorKey: "promo.expired" };
  }

  // Max uses check
  if (promo.usedCount >= promo.maxUses) {
    return { valid: false, discountAmount: 0, errorKey: "promo.exhausted" };
  }

  // Per-user limit check
  if (promo.maxUsesPerUser) {
    const userUsageSnap = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .where("customerEmail", "==", customerEmail)
      .where("promotionCode", "==", upperCode)
      .where("status", "in", ["pending", "paid"])
      .get();

    if (userUsageSnap.size >= promo.maxUsesPerUser) {
      return { valid: false, discountAmount: 0, errorKey: "promo.user_limit" };
    }
  }

  // Re-fetch server-side prices to compute subtotal (D5)
  let subtotal = 0;
  for (const item of cartItems) {
    const productDoc = await adminDb
      .collection(COLLECTIONS.PRODUCTS)
      .doc(item.productId)
      .get();
    if (!productDoc.exists) continue;
    const product = {
      id: productDoc.id,
      ...productDoc.data(),
    } as ProductDocument;
    subtotal += getEffectivePrice(product) * item.quantity;
  }

  // Min order value check
  if (promo.minOrderValue && subtotal < promo.minOrderValue) {
    return {
      valid: false,
      discountAmount: 0,
      errorKey: "promo.min_order",
      message: String(promo.minOrderValue),
    };
  }

  // Calculate discount
  let discountAmount = 0;
  if (promo.type === "percentage") {
    discountAmount = Math.round(subtotal * (promo.discountValue / 100));
    if (promo.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, promo.maxDiscountAmount);
    }
  } else {
    discountAmount = promo.discountValue;
  }

  discountAmount = Math.min(discountAmount, subtotal); // never exceed subtotal

  return {
    valid: true,
    discountAmount,
    promotionId: promo.id,
    promotionCode: upperCode,
  };
}

// ─── Create Order ─────────────────────────────────────────────────────────────
/**
 * Creates a pending order in Firestore.
 * CRITICAL (D5): All prices are re-fetched from Firestore server-side.
 * Client-submitted prices are completely ignored.
 *
 * @returns orderId and mockPaymentUrl to redirect user
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<ActionResult<{ orderId: string; paymentUrl: string }>> {
  const {
    items,
    customerName,
    customerEmail,
    customerPhone,
    customerId: clientCustomerId = "",
    promoCode,
    affiliateCode,
  } = input;

  // D8: If no customerId sent by client, try to read from verified session cookie.
  // This links the order to the logged-in user for /orders page display.
  let customerId = clientCustomerId;
  if (!customerId) {
    const session = await verifySession();
    if (session?.uid) customerId = session.uid;
  }

  if (!items.length) {
    return { success: false, errorKey: "order.empty_cart" };
  }

  // ── Step 1: Re-fetch all product prices server-side (D5) ──
  const orderItems: OrderItem[] = [];
  let subtotal = 0;

  for (const cartItem of items) {
    const productDoc = await adminDb
      .collection(COLLECTIONS.PRODUCTS)
      .doc(cartItem.productId)
      .get();

    if (!productDoc.exists) {
      return {
        success: false,
        errorKey: "order.product_not_found",
        message: cartItem.productId,
      };
    }

    const product = {
      id: productDoc.id,
      ...productDoc.data(),
    } as ProductDocument;

    if (product.status !== "active") {
      return {
        success: false,
        errorKey: "order.product_unavailable",
        message: product.name,
      };
    }

    // Stock check
    if (
      product.totalStock !== undefined &&
      product.soldCount + cartItem.quantity > product.totalStock
    ) {
      return {
        success: false,
        errorKey: "order.stock_exhausted",
        message: product.name,
      };
    }

    const unitPrice = getEffectivePrice(product);
    const itemSubtotal = unitPrice * cartItem.quantity;
    subtotal += itemSubtotal;

    const orderItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      productType: product.type,
      thumbnailUrl: product.thumbnailUrl,
      quantity: cartItem.quantity,
      unitPrice,
      subtotal: itemSubtotal,
      validityConfig: product.validityConfig,
    };

    if (product.comboItems !== undefined) {
      orderItem.comboItems = product.comboItems;
    }

    orderItems.push(orderItem);
  }

  // ── Step 2: Validate promo if provided ──
  let discountAmount = 0;
  let promotionId: string | undefined;
  let promotionCode: string | undefined;

  if (promoCode) {
    const promoResult = await validatePromoCode(
      promoCode,
      items,
      customerEmail
    );
    if (!promoResult.valid) {
      return {
        success: false,
        errorKey: promoResult.errorKey ?? "promo.invalid",
      };
    }
    discountAmount = promoResult.discountAmount;
    promotionId = promoResult.promotionId;
    promotionCode = promoResult.promotionCode;
  }

  const finalAmount = subtotal - discountAmount;

  // ── Step 3: Generate order number ──
  const dateStr = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const orderNumber = `BDUCK-${dateStr}-${randomSuffix}`;

  // ── Step 4: Resolve affiliate (if cookie present as input) ──
  let affiliateId: string | undefined;
  let affiliateCommissionAmount: number | undefined;

  if (affiliateCode) {
    const affSnap = await adminDb
      .collection(COLLECTIONS.AFFILIATE_PROFILES)
      .where("referralCode", "==", affiliateCode)
      .where("applicationStatus", "==", "approved")
      .limit(1)
      .get();

    if (!affSnap.empty) {
      const affDoc = affSnap.docs[0];
      affiliateId = affDoc.id;
      const affData = affDoc.data();

      // Compute commission — product-level rate takes priority
      let commissionRate = affData.defaultCommissionRate ?? 0;
      for (const item of orderItems) {
        const productDoc = await adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .doc(item.productId)
          .get();
        const product = productDoc.data() as ProductDocument;
        if (product.commissionRate !== undefined) {
          commissionRate = product.commissionRate;
          break; // simplified: use first product's rate
        }
      }
      affiliateCommissionAmount = Math.round(finalAmount * commissionRate);
    }
  }

  // ── Step 5: Write pending order ──
  const now = Timestamp.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderData: Record<string, any> = {
    orderNumber,
    customerId,
    isGuestOrder: !customerId,
    customerEmail,
    customerName,
    customerPhone,
    items: orderItems,
    subtotal,
    discountAmount,
    finalAmount,
    promotionId,
    promotionCode,
    affiliateId,
    affiliateCode,
    affiliateCommissionAmount,
    status: "pending",
    passIds: [],
    createdAt: now,
    updatedAt: now,
  };

  // Remove undefined fields to satisfy Firestore
  Object.keys(orderData).forEach((key) => {
    if (orderData[key] === undefined) {
      delete orderData[key];
    }
  });

  const orderRef = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .add(orderData);

  // ── Step 6: Build mock payment URL ──
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const paymentUrl = `${baseUrl}/api/mock-pay?orderId=${orderRef.id}&amount=${finalAmount}&simulate=success`;

  return {
    success: true,
    data: { orderId: orderRef.id, paymentUrl },
  };
}
