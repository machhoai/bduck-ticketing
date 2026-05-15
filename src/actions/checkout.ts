"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { getEffectivePrice } from "@/actions/products";
import type {
  CartItemInput,
  CounterPayData,
  BankTransferPayData,
  OrderDocument,
  OrderItem,
  ProductDocument,
  PromotionDocument,
} from "@/types/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { verifySession } from "@/lib/auth/session";
import { sendCounterOrderEmail } from "@/lib/email/counter-order";
import { sendTransferNotificationEmail } from "@/lib/email/transfer-notification";
import { sendTransferReservationEmail } from "@/lib/email/transfer-reservation";
import {
  validateDealItems,
  validateDealSectionConstraints,
  updateDealStock,
  updateDealStockInTransaction,
  type ResolvedDealItem,
} from "@/lib/deal-checkout";
import { getPayOS } from "@/lib/payos";

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

// ─── Deal Validation Helper ───────────────────────────────────────────────────

/**
 * Shared helper: extract deal items from cart, validate time gates, stock,
 * section constraints, and return resolved deal mappings.
 */
async function runDealValidation(
  items: CartItemInput[]
): Promise<
  | { valid: true; resolved: Map<string, ResolvedDealItem> }
  | { valid: false; errorKey: string; message?: string }
> {
  // Build maps for deal items only
  const dealMap = new Map<string, { sectionId: string; dealItemId: string }>();
  const qtyMap = new Map<string, number>();

  for (const item of items) {
    qtyMap.set(item.productId, item.quantity);
    if (item.dealSectionId && item.dealItemId) {
      dealMap.set(item.productId, {
        sectionId: item.dealSectionId,
        dealItemId: item.dealItemId,
      });
    }
  }

  if (dealMap.size === 0) {
    return { valid: true, resolved: new Map() };
  }

  // Validate individual deal items (time gate, stock, maxQtyPerOrder)
  const { errors, resolved } = await validateDealItems(dealMap, qtyMap);
  if (errors.length > 0) {
    return { valid: false, errorKey: errors[0].errorKey, message: errors[0].message };
  }

  // Validate section-level constraints
  const sectionErrors = await validateDealSectionConstraints(resolved, qtyMap);
  if (sectionErrors.length > 0) {
    return { valid: false, errorKey: sectionErrors[0].errorKey, message: sectionErrors[0].message };
  }

  return { valid: true, resolved };
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

  // ── Step 0.5: Validate deal items (time gate, stock, constraints) ──
  const dealResult = await runDealValidation(items);
  if (!dealResult.valid) {
    return { success: false, errorKey: dealResult.errorKey, message: dealResult.message };
  }
  const resolvedDeals = dealResult.resolved;

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

    // Use deal effective price if this is a deal item, else product price
    const deal = resolvedDeals.get(cartItem.productId);
    const unitPrice = deal ? deal.item.effectivePrice : getEffectivePrice(product);
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

    // Enrich with deal context
    if (deal) {
      orderItem.isDealItem = true;
      orderItem.dealSectionId = deal.sectionId;
      orderItem.dealItemId = deal.item.id;

      // Membership points from deal item
      if (deal.item.membershipConfig) {
        const mc = deal.item.membershipConfig;
        let bonusPoints = mc.bonusPoints ?? 0;
        if (deal.item.membershipBonusOverride) {
          const ov = deal.item.membershipBonusOverride;
          if (ov.applyTo === "bonusOnly") {
            bonusPoints = bonusPoints * ov.multiplier;
          } else {
            bonusPoints = ((mc.basePoints ?? 0) + bonusPoints) * ov.multiplier - (mc.basePoints ?? 0);
          }
        }
        orderItem.membershipPoints = mc.basePoints ?? 0;
        orderItem.bonusPoints = Math.round(bonusPoints);
        orderItem.totalPoints = (mc.basePoints ?? 0) + Math.round(bonusPoints);
        orderItem.merch = mc.merch;
      }
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

  // ── Step 5.5: Update deal item stock ──
  if (resolvedDeals.size > 0) {
    const qtyMap = new Map<string, number>();
    for (const item of items) qtyMap.set(item.productId, item.quantity);
    updateDealStock(resolvedDeals, qtyMap).catch((err) =>
      console.error("[createOrder] Deal stock update failed (non-fatal):", err)
    );
  }

  // ── Step 6: Build mock payment URL ──
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const paymentUrl = `${baseUrl}/api/mock-pay?orderId=${orderRef.id}&amount=${finalAmount}&simulate=success`;

  return {
    success: true,
    data: { orderId: orderRef.id, paymentUrl },
  };
}

// ─── Create Counter Order ─────────────────────────────────────────────────────
/**
 * Tạo đơn hàng với phương thức "thanh toán tại quầy" (Online-to-Offline).
 *
 * Khác createOrder (online) ở 3 điểm:
 *   1. Sinh orderCode (BDK-XXXXXX) với Transaction+Retry để đảm bảo UNIQUE (D6).
 *   2. Set expiresAt = createdAt + 24h — đơn tự huỷ nếu khách không đến quầy (D4).
 *   3. paymentDetails.provider = "counter"; providerData không có confirmedBy/At
 *      (sẽ được populate bởi confirmCounterPayment khi admin xác nhận).
 *
 * Pass KHÔNG được sinh ra ở đây — chỉ sinh sau khi nhân viên bấm xác nhẫn.
 *
 * @returns orderId (Firestore doc ID) và orderCode (để hiển thị QR cho khách)
 */
export async function createCounterOrder(
  input: CreateOrderInput
): Promise<ActionResult<{ orderId: string; orderCode: string }>> {
  const {
    items,
    customerName,
    customerEmail,
    customerPhone,
    customerId: clientCustomerId = "",
    promoCode,
    affiliateCode,
  } = input;

  // D8: Link to session user if available
  let customerId = clientCustomerId;
  if (!customerId) {
    const session = await verifySession();
    if (session?.uid) customerId = session.uid;
  }

  if (!items.length) {
    return { success: false, errorKey: "order.empty_cart" };
  }

  // ── Step 0.5: Validate deal items ──
  const dealResult = await runDealValidation(items);
  if (!dealResult.valid) {
    return { success: false, errorKey: dealResult.errorKey, message: dealResult.message };
  }
  const resolvedDeals = dealResult.resolved;

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

    const deal = resolvedDeals.get(cartItem.productId);
    const unitPrice = deal ? deal.item.effectivePrice : getEffectivePrice(product);
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

    // Enrich with deal context
    if (deal) {
      orderItem.isDealItem = true;
      orderItem.dealSectionId = deal.sectionId;
      orderItem.dealItemId = deal.item.id;
      if (deal.item.membershipConfig) {
        const mc = deal.item.membershipConfig;
        let bonusPoints = mc.bonusPoints ?? 0;
        if (deal.item.membershipBonusOverride) {
          const ov = deal.item.membershipBonusOverride;
          if (ov.applyTo === "bonusOnly") bonusPoints = bonusPoints * ov.multiplier;
          else bonusPoints = ((mc.basePoints ?? 0) + bonusPoints) * ov.multiplier - (mc.basePoints ?? 0);
        }
        orderItem.membershipPoints = mc.basePoints ?? 0;
        orderItem.bonusPoints = Math.round(bonusPoints);
        orderItem.totalPoints = (mc.basePoints ?? 0) + Math.round(bonusPoints);
        orderItem.merch = mc.merch;
      }
    }

    orderItems.push(orderItem);
  }

  // ── Step 2: Validate promo if provided ──
  let discountAmount = 0;
  let promotionId: string | undefined;
  let promotionCode: string | undefined;

  if (promoCode) {
    const promoResult = await validatePromoCode(promoCode, items, customerEmail);
    if (!promoResult.valid) {
      return { success: false, errorKey: promoResult.errorKey ?? "promo.invalid" };
    }
    discountAmount = promoResult.discountAmount;
    promotionId = promoResult.promotionId;
    promotionCode = promoResult.promotionCode;
  }

  const finalAmount = subtotal - discountAmount;

  // ── Step 3: Generate order number ──
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const orderNumber = `BDUCK-${dateStr}-${randomSuffix}`;

  // ── Step 4: Resolve affiliate ──
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
      let commissionRate = affData.defaultCommissionRate ?? 0;
      for (const item of orderItems) {
        const productDoc = await adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .doc(item.productId)
          .get();
        const product = productDoc.data() as ProductDocument;
        if (product.commissionRate !== undefined) {
          commissionRate = product.commissionRate;
          break;
        }
      }
      affiliateCommissionAmount = Math.round(finalAmount * commissionRate);
    }
  }

  // ── Step 5: Generate UNIQUE orderCode via Transaction + Retry (D6) ────────
  /**
   * Sinh 6 ký tự A-Z0-9 ngẫu nhiên, prefix "BDK-".
   * 36^6 ≈ 2.17 tỷ tổ hợp — xác suất trùng cực thấp nhưng vẫn phải verify.
   */
  const generateCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "BDK-";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const MAX_RETRIES = 3;
  let orderCode = "";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const candidate = generateCode();

    // Check uniqueness: query existing orders with this code
    const existing = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .where("orderCode", "==", candidate)
      .limit(1)
      .get();

    if (existing.empty) {
      orderCode = candidate;
      break;
    }
    // Collision — retry with new code
    console.warn(`[createCounterOrder] orderCode collision on attempt ${attempt + 1}: ${candidate}`);
  }

  if (!orderCode) {
    // Astronomically unlikely (p ≈ 1.5×10⁻¹⁸) but we never trust luck
    return { success: false, errorKey: "order.code_generation_failed" };
  }

  // ── Step 6: Write counter order to Firestore ──
  const now = Timestamp.now();
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  const expiresAt = Timestamp.fromMillis(now.toMillis() + TWENTY_FOUR_HOURS_MS);

  const counterPayData: CounterPayData = {}; // confirmedBy/At filled by confirmCounterPayment

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderData: Record<string, any> = {
    orderNumber,
    orderCode,
    expiresAt,
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
    paymentDetails: {
      provider: "counter",
      providerData: counterPayData,
    },
    passIds: [],
    createdAt: now,
    updatedAt: now,
  };

  // Remove undefined fields to satisfy Firestore
  Object.keys(orderData).forEach((key) => {
    if (orderData[key] === undefined) delete orderData[key];
  });

  const orderRef = await adminDb.collection(COLLECTIONS.ORDERS).add(orderData);

  // ── Step 6.5: Update deal item stock ──
  if (resolvedDeals.size > 0) {
    const qtyMap = new Map<string, number>();
    for (const item of items) qtyMap.set(item.productId, item.quantity);
    updateDealStock(resolvedDeals, qtyMap).catch((err) =>
      console.error("[createCounterOrder] Deal stock update failed (non-fatal):", err)
    );
  }

  // ── Step 7: Send confirmation email (fire-and-forget) ──
  // Non-blocking: email failure never aborts the order creation.
  sendCounterOrderEmail({
    to: customerEmail,
    customerName,
    orderId: orderRef.id,
    orderNumber,
    orderCode,
    items: orderItems.map((i) => ({
      productName: i.productName,
      productType: i.productType,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.subtotal,
    })),
    finalAmount,
    discountAmount,
    expiresAt: expiresAt.toDate(),
  }).catch((err) =>
    console.error("[createCounterOrder] Email send failed (non-fatal):", err)
  );

  return {
    success: true,
    data: { orderId: orderRef.id, orderCode },
  };
}

// ─── Create Bank Transfer Order ───────────────────────────────────────────────
/**
 * Tạo đơn hàng với phương thức "chuyển khoản ngân hàng" (VietQR).
 *
 * Khác createCounterOrder ở:
 *   1. Dùng Firestore Transaction để atomic stock check + reserve (increment soldCount).
 *   2. expiresAt = 30 phút (không phải 24h).
 *   3. Sinh qrDescription = DDMMYYHHmm + amount/1000 + random 4-char.
 *   4. Gửi 2 email: admin notification + customer reservation confirm (bilingual).
 *   5. KHÔNG tự huỷ khi hết hạn — admin toàn quyền quyết định cancel.
 *
 * @returns orderId
 */
export async function createBankTransferOrder(
  input: CreateOrderInput
): Promise<ActionResult<{ orderId: string }>> {
  const {
    items,
    customerName,
    customerEmail,
    customerPhone,
    customerId: clientCustomerId = "",
    promoCode,
    affiliateCode,
  } = input;

  // Link to session user if available
  let customerId = clientCustomerId;
  if (!customerId) {
    const session = await verifySession();
    if (session?.uid) customerId = session.uid;
  }

  if (!items.length) {
    return { success: false, errorKey: "order.empty_cart" };
  }

  // ── Step 0.5: Validate deal items ──
  const dealResult = await runDealValidation(items);
  if (!dealResult.valid) {
    return { success: false, errorKey: dealResult.errorKey, message: dealResult.message };
  }
  const resolvedDeals = dealResult.resolved;

  // ── Step 1: Re-fetch all product prices server-side ──
  const orderItems: OrderItem[] = [];
  let subtotal = 0;
  const productQuantities: { productId: string; quantity: number }[] = [];

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

    // Preliminary stock check (final check inside transaction)
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

    const deal = resolvedDeals.get(cartItem.productId);
    const unitPrice = deal ? deal.item.effectivePrice : getEffectivePrice(product);
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

    // Enrich with deal context
    if (deal) {
      orderItem.isDealItem = true;
      orderItem.dealSectionId = deal.sectionId;
      orderItem.dealItemId = deal.item.id;
      if (deal.item.membershipConfig) {
        const mc = deal.item.membershipConfig;
        let bonusPoints = mc.bonusPoints ?? 0;
        if (deal.item.membershipBonusOverride) {
          const ov = deal.item.membershipBonusOverride;
          if (ov.applyTo === "bonusOnly") bonusPoints = bonusPoints * ov.multiplier;
          else bonusPoints = ((mc.basePoints ?? 0) + bonusPoints) * ov.multiplier - (mc.basePoints ?? 0);
        }
        orderItem.membershipPoints = mc.basePoints ?? 0;
        orderItem.bonusPoints = Math.round(bonusPoints);
        orderItem.totalPoints = (mc.basePoints ?? 0) + Math.round(bonusPoints);
        orderItem.merch = mc.merch;
      }
    }

    orderItems.push(orderItem);
    productQuantities.push({ productId: product.id, quantity: cartItem.quantity });
  }

  // ── Step 2: Validate promo if provided ──
  let discountAmount = 0;
  let promotionId: string | undefined;
  let promotionCode: string | undefined;

  if (promoCode) {
    const promoResult = await validatePromoCode(promoCode, items, customerEmail);
    if (!promoResult.valid) {
      return { success: false, errorKey: promoResult.errorKey ?? "promo.invalid" };
    }
    discountAmount = promoResult.discountAmount;
    promotionId = promoResult.promotionId;
    promotionCode = promoResult.promotionCode;
  }

  const finalAmount = subtotal - discountAmount;

  // ── Step 3: Generate order number ──
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const orderNumber = `BDUCK-${dateStr}-${randomSuffix}`;

  // ── Step 4: Generate QR description ──
  // Format: DDMMYYHHmm + amount/1000 + 4-char random
  const nowDate = new Date();
  const dd = String(nowDate.getDate()).padStart(2, "0");
  const mm = String(nowDate.getMonth() + 1).padStart(2, "0");
  const yy = String(nowDate.getFullYear()).slice(2);
  const hh = String(nowDate.getHours()).padStart(2, "0");
  const mi = String(nowDate.getMinutes()).padStart(2, "0");
  const amountCode = Math.floor(finalAmount / 1000);
  const randChars = Math.random().toString(36).slice(2, 6).toUpperCase();
  const qrDescription = `${dd}${mm}${yy}${hh}${mi} ${amountCode} ${randChars}`;

  // ── Step 5: Resolve affiliate ──
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
      let commissionRate = affData.defaultCommissionRate ?? 0;
      for (const item of orderItems) {
        const productDoc = await adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .doc(item.productId)
          .get();
        const product = productDoc.data() as ProductDocument;
        if (product.commissionRate !== undefined) {
          commissionRate = product.commissionRate;
          break;
        }
      }
      affiliateCommissionAmount = Math.round(finalAmount * commissionRate);
    }
  }

  // ── Step 6: Firestore Transaction — stock reserve + write order ──
  // CRITICAL: Atomic stock check + increment to prevent overselling
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + THIRTY_MINUTES_MS);

  const bankTransferPayData: BankTransferPayData = { qrDescription };

  let orderId: string;

  try {
    orderId = await adminDb.runTransaction(async (tx) => {
      // Re-check stock inside transaction for each product
      for (const pq of productQuantities) {
        const productRef = adminDb.collection(COLLECTIONS.PRODUCTS).doc(pq.productId);
        const productSnap = await tx.get(productRef);
        if (!productSnap.exists) throw new Error("PRODUCT_NOT_FOUND");

        const productData = productSnap.data() as ProductDocument;
        if (
          productData.totalStock !== undefined &&
          productData.soldCount + pq.quantity > productData.totalStock
        ) {
          throw new Error(`STOCK_EXHAUSTED:${productData.name}`);
        }

        // Reserve stock — increment soldCount NOW
        tx.update(productRef, {
          soldCount: FieldValue.increment(pq.quantity),
        });
      }

      // Write order document
      const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orderData: Record<string, any> = {
        orderNumber,
        expiresAt,
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
        paymentDetails: {
          provider: "bank_transfer" as const,
          providerData: bankTransferPayData,
        },
        passIds: [],
        createdAt: now,
        updatedAt: now,
      };

      // Remove undefined fields
      Object.keys(orderData).forEach((key) => {
        if (orderData[key] === undefined) delete orderData[key];
      });

      tx.set(orderRef, orderData);

      // Update deal item stock inside the same transaction
      if (resolvedDeals.size > 0) {
        const qtyMap = new Map<string, number>();
        for (const item of items) qtyMap.set(item.productId, item.quantity);
        await updateDealStockInTransaction(tx, resolvedDeals, qtyMap);
      }

      return orderRef.id;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("STOCK_EXHAUSTED:")) {
      return {
        success: false,
        errorKey: "order.stock_exhausted",
        message: message.replace("STOCK_EXHAUSTED:", ""),
      };
    }
    console.error("[createBankTransferOrder] Transaction failed:", err);
    return { success: false, errorKey: "order.creation_failed" };
  }

  // ── Step 7: Fire-and-forget emails ──
  const emailItems = orderItems.map((i) => ({
    productName: i.productName,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    subtotal: i.subtotal,
  }));

  // Email 1: Notify all admins
  sendTransferNotificationEmail({
    orderId,
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    items: emailItems,
    finalAmount,
    discountAmount,
    qrDescription,
  }).catch((err) =>
    console.error("[createBankTransferOrder] Admin notification failed (non-fatal):", err)
  );

  // Email 2: Customer reservation confirmation (bilingual)
  sendTransferReservationEmail({
    to: customerEmail,
    customerName,
    orderNumber,
    items: emailItems,
    finalAmount,
    discountAmount,
    qrDescription,
  }).catch((err) =>
    console.error("[createBankTransferOrder] Customer reservation email failed (non-fatal):", err)
  );

  return {
    success: true,
    data: { orderId },
  };
}

// ─── Create PayOS Order ───────────────────────────────────────────────────────
/**
 * Tạo đơn hàng với phương thức thanh toán qua PayOS.
 *
 * Flow:
 *   1. Validate deal items, re-fetch prices, promo, affiliate — giống createOrder.
 *   2. Sinh payosOrderCode (số ngẫu nhiên 6 chữ số) dùng để webhook lookup.
 *   3. Gọi PayOS SDK `paymentRequests.create()` để lấy `checkoutUrl`.
 *   4. Client mở checkoutUrl trong embedded iframe (usePayOS hook).
 *   5. PayOS gọi webhook /api/payos/webhook khi thanh toán thành công → xử lý giống mock-pay.
 *
 * @returns orderId + checkoutUrl để client nhúng giao diện PayOS
 */
export async function createPayOSOrder(
  input: CreateOrderInput
): Promise<ActionResult<{ orderId: string; checkoutUrl: string }>> {
  const {
    items,
    customerName,
    customerEmail,
    customerPhone,
    customerId: clientCustomerId = "",
    promoCode,
    affiliateCode,
  } = input;

  // Link to session user if available
  let customerId = clientCustomerId;
  if (!customerId) {
    const session = await verifySession();
    if (session?.uid) customerId = session.uid;
  }

  if (!items.length) {
    return { success: false, errorKey: "order.empty_cart" };
  }

  // ── Step 0.5: Validate deal items ──
  const dealResult = await runDealValidation(items);
  if (!dealResult.valid) {
    return { success: false, errorKey: dealResult.errorKey, message: dealResult.message };
  }
  const resolvedDeals = dealResult.resolved;

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

    const deal = resolvedDeals.get(cartItem.productId);
    const unitPrice = deal ? deal.item.effectivePrice : getEffectivePrice(product);
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

    // Enrich with deal context
    if (deal) {
      orderItem.isDealItem = true;
      orderItem.dealSectionId = deal.sectionId;
      orderItem.dealItemId = deal.item.id;
      if (deal.item.membershipConfig) {
        const mc = deal.item.membershipConfig;
        let bonusPoints = mc.bonusPoints ?? 0;
        if (deal.item.membershipBonusOverride) {
          const ov = deal.item.membershipBonusOverride;
          if (ov.applyTo === "bonusOnly") bonusPoints = bonusPoints * ov.multiplier;
          else bonusPoints = ((mc.basePoints ?? 0) + bonusPoints) * ov.multiplier - (mc.basePoints ?? 0);
        }
        orderItem.membershipPoints = mc.basePoints ?? 0;
        orderItem.bonusPoints = Math.round(bonusPoints);
        orderItem.totalPoints = (mc.basePoints ?? 0) + Math.round(bonusPoints);
        orderItem.merch = mc.merch;
      }
    }

    orderItems.push(orderItem);
  }

  // ── Step 2: Validate promo if provided ──
  let discountAmount = 0;
  let promotionId: string | undefined;
  let promotionCode: string | undefined;

  if (promoCode) {
    const promoResult = await validatePromoCode(promoCode, items, customerEmail);
    if (!promoResult.valid) {
      return { success: false, errorKey: promoResult.errorKey ?? "promo.invalid" };
    }
    discountAmount = promoResult.discountAmount;
    promotionId = promoResult.promotionId;
    promotionCode = promoResult.promotionCode;
  }

  const finalAmount = subtotal - discountAmount;

  // ── Step 3: Generate order number ──
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  const orderNumber = `BDUCK-${dateStr}-${randomSuffix}`;

  // ── Step 4: Resolve affiliate ──
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
      let commissionRate = affData.defaultCommissionRate ?? 0;
      for (const item of orderItems) {
        const productDoc = await adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .doc(item.productId)
          .get();
        const product = productDoc.data() as ProductDocument;
        if (product.commissionRate !== undefined) {
          commissionRate = product.commissionRate;
          break;
        }
      }
      affiliateCommissionAmount = Math.round(finalAmount * commissionRate);
    }
  }

  // ── Step 5: Generate PayOS orderCode (numeric, unique) ──
  // PayOS requires orderCode to be a unique number.
  // We use last 6 digits of timestamp + random to keep it within safe range.
  const payosOrderCode = Number(
    String(Date.now()).slice(-6) + String(Math.floor(Math.random() * 1000)).padStart(3, "0")
  );

  // ── Step 6: Write pending order ──
  const now = Timestamp.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orderData: Record<string, any> = {
    orderNumber,
    payosOrderCode,
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
    paymentDetails: {
      provider: "payos",
      providerData: {
        payosOrderCode,
      },
    },
    passIds: [],
    createdAt: now,
    updatedAt: now,
  };

  // Remove undefined fields
  Object.keys(orderData).forEach((key) => {
    if (orderData[key] === undefined) delete orderData[key];
  });

  const orderRef = await adminDb.collection(COLLECTIONS.ORDERS).add(orderData);

  // ── Step 6.5: Update deal item stock ──
  if (resolvedDeals.size > 0) {
    const qtyMap = new Map<string, number>();
    for (const item of items) qtyMap.set(item.productId, item.quantity);
    updateDealStock(resolvedDeals, qtyMap).catch((err) =>
      console.error("[createPayOSOrder] Deal stock update failed (non-fatal):", err)
    );
  }

  // ── Step 7: Create PayOS payment link ──
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const returnUrl = `${appUrl}/checkout/result?orderId=${orderRef.id}`;
  const cancelUrl = `${appUrl}/checkout/result?orderId=${orderRef.id}&status=failed`;

  try {
    const payos = getPayOS();
    const paymentLink = await payos.paymentRequests.create({
      orderCode: payosOrderCode,
      amount: finalAmount,
      description: `BDUCK ${orderNumber.slice(-5)}`,
      returnUrl,
      cancelUrl,
      items: orderItems.map((item) => ({
        name: item.productName.slice(0, 50), // PayOS limit
        quantity: item.quantity,
        price: item.unitPrice,
      })),
      buyerName: customerName,
      buyerEmail: customerEmail,
      buyerPhone: customerPhone || undefined,
      // Expire in 30 minutes
      expiredAt: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    // Update order with PayOS paymentLinkId for reference
    await orderRef.update({
      "paymentDetails.providerData.paymentLinkId": paymentLink.paymentLinkId,
      "paymentDetails.providerData.checkoutUrl": paymentLink.checkoutUrl,
      "paymentDetails.providerData.qrCode": paymentLink.qrCode,
    });

    return {
      success: true,
      data: { orderId: orderRef.id, checkoutUrl: paymentLink.checkoutUrl },
    };
  } catch (err) {
    console.error("[createPayOSOrder] PayOS API error:", err);
    // Mark order as failed
    await orderRef.update({
      status: "cancelled",
      cancelReason: "payos_link_creation_failed",
      cancelledAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { success: false, errorKey: "order.payment_link_failed" };
  }
}

// ─── Cancel PayOS Order ───────────────────────────────────────────────────────
/**
 * Marks a pending PayOS order as cancelled.
 * Called when PayOS redirects back with cancel=true / status=CANCELLED.
 * Idempotent: no-op if order is already paid/cancelled.
 */
export async function cancelPayOSOrder(orderId: string): Promise<void> {
  const orderRef = adminDb.collection(COLLECTIONS.ORDERS).doc(orderId);
  const snap = await orderRef.get();
  if (!snap.exists) return;

  const data = snap.data();
  if (!data || data.status !== "pending") return;

  await orderRef.update({
    status: "cancelled",
    cancelReason: "user_cancelled_payos",
    cancelledAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}
// ─── Retry Failed Order Validation ──────────────────────────────────────────────
export async function validateOrderItemsForRetry(
  items: CartItemInput[]
): Promise<ActionResult<void>> {
  if (!items.length) {
    return { success: false, errorKey: "order.empty_cart" };
  }

  // 1. Validate deals (time gate, stock, section constraints)
  const dealResult = await runDealValidation(items);
  if (!dealResult.valid) {
    return { success: false, errorKey: dealResult.errorKey, message: dealResult.message };
  }

  // 2. Validate products (existence, availability, general stock)
  for (const cartItem of items) {
    const productDoc = await adminDb
      .collection(COLLECTIONS.PRODUCTS)
      .doc(cartItem.productId)
      .get();

    if (!productDoc.exists) {
      return { success: false, errorKey: "order.product_not_found" };
    }

    const productData = productDoc.data()!;
    if (productData.status === "draft" || productData.isAvailable === false) {
      return { success: false, errorKey: "order.product_unavailable" };
    }

    // Check base product stock if it's NOT a deal item.
    // If it is a deal item, runDealValidation already checked the deal stock.
    if (!cartItem.dealSectionId && !cartItem.dealItemId) {
      const stock = productData.stock as number | null | undefined;
      if (typeof stock === "number" && stock < cartItem.quantity) {
        return { success: false, errorKey: "order.stock_exhausted" };
      }
    }
  }

  return { success: true, data: undefined };
}
