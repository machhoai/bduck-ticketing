/**
 * GET /api/v1/reports/sales?from={date}&to={date}
 *
 * Returns paid-order revenue and sold-item aggregation for external systems.
 *
 * Auth: Bearer <INTERNAL_API_KEY>
 */

import { verifyApiKey, unauthorizedResponse } from "@/lib/api/verify-api-key";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";
import type { OrderDocument, OrderItem, ProductType } from "@/types/firestore";

export const runtime = "nodejs";

const REPORT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_TIME_ZONE_RE = /(Z|[+-]\d{2}:\d{2})$/i;
const MAX_RANGE_DAYS = 366;

interface ProductSalesRow {
  productId: string;
  productName: string;
  productType: ProductType;
  quantitySold: number;
  grossRevenue: number;
  netRevenue: number;
  orderCount: number;
}

interface DailySalesRow {
  date: string;
  orderCount: number;
  itemQuantity: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
}

interface PaymentProviderRow {
  provider: string;
  orderCount: number;
  netRevenue: number;
}

export async function GET(req: Request): Promise<Response> {
  if (!verifyApiKey(req)) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from")?.trim() ?? "";
  const toParam = searchParams.get("to")?.trim() ?? "";
  const includeOrders = searchParams.get("includeOrders") === "true";
  const orderLimit = parseOrderLimit(searchParams.get("orderLimit"));

  const fromMs = parseDateBoundary(fromParam, "start");
  const toMs = parseDateBoundary(toParam, "end");

  if (!fromParam || !toParam || fromMs === null || toMs === null) {
    return Response.json(
      {
        success: false,
        error: "INVALID_DATE_RANGE",
        message:
          "Query params from and to are required. Use YYYY-MM-DD or ISO-8601 datetime.",
      },
      { status: 400 }
    );
  }

  if (fromMs > toMs) {
    return Response.json(
      {
        success: false,
        error: "INVALID_DATE_RANGE",
        message: "from must be earlier than or equal to to.",
      },
      { status: 400 }
    );
  }

  const rangeDays = Math.ceil((toMs - fromMs + 1) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_RANGE_DAYS) {
    return Response.json(
      {
        success: false,
        error: "DATE_RANGE_TOO_LARGE",
        message: `Date range must be ${MAX_RANGE_DAYS} days or less.`,
      },
      { status: 400 }
    );
  }

  try {
    const snap = await adminDb
      .collection(COLLECTIONS.ORDERS)
      .where("status", "==", "paid")
      .where("createdAt", ">=", Timestamp.fromMillis(fromMs))
      .where("createdAt", "<=", Timestamp.fromMillis(toMs))
      .orderBy("createdAt", "desc")
      .get();

    let grossRevenue = 0;
    let discountAmount = 0;
    let netRevenue = 0;
    let itemQuantity = 0;
    let passesIssued = 0;

    const dailyMap = buildDailyMap(fromMs, toMs);
    const productMap = new Map<string, ProductSalesRow>();
    const providerMap = new Map<string, PaymentProviderRow>();
    const orders = [];

    for (const doc of snap.docs) {
      const order = {
        id: doc.id,
        ...(doc.data() as Omit<OrderDocument, "id">),
      } as OrderDocument;
      const orderGrossRevenue = toNumber(order.subtotal);
      const orderDiscountAmount = toNumber(order.discountAmount);
      const orderNetRevenue = toNumber(order.finalAmount);
      const orderItems = Array.isArray(order.items) ? order.items : [];
      const orderItemQuantity = orderItems.reduce(
        (sum, item) => sum + toNumber(item.quantity),
        0
      );

      grossRevenue += orderGrossRevenue;
      discountAmount += orderDiscountAmount;
      netRevenue += orderNetRevenue;
      itemQuantity += orderItemQuantity;
      passesIssued += Array.isArray(order.passIds) ? order.passIds.length : 0;

      const createdAtMs = order.createdAt.toMillis();
      const dayKey = formatDateInTimeZone(createdAtMs);
      const day = dailyMap.get(dayKey);
      if (day) {
        day.orderCount += 1;
        day.itemQuantity += orderItemQuantity;
        day.grossRevenue += orderGrossRevenue;
        day.discountAmount += orderDiscountAmount;
        day.netRevenue += orderNetRevenue;
      }

      const provider = order.paymentDetails?.provider ?? "unknown";
      const providerRow =
        providerMap.get(provider) ??
        {
          provider,
          orderCount: 0,
          netRevenue: 0,
        };
      providerRow.orderCount += 1;
      providerRow.netRevenue += orderNetRevenue;
      providerMap.set(provider, providerRow);

      addProducts(productMap, orderItems, orderNetRevenue, orderGrossRevenue);

      if (includeOrders && orders.length < orderLimit) {
        orders.push(serializeOrder(order));
      }
    }

    const productSales = Array.from(productMap.values()).sort(
      (a, b) => b.quantitySold - a.quantitySold || b.netRevenue - a.netRevenue
    );
    const paymentProviders = Array.from(providerMap.values()).sort(
      (a, b) => b.netRevenue - a.netRevenue
    );
    const orderCount = snap.size;

    return Response.json({
      success: true,
      generatedAt: new Date().toISOString(),
      timeZone: REPORT_TIME_ZONE,
      range: {
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
      },
      summary: {
        orderCount,
        itemQuantity,
        passesIssued,
        grossRevenue,
        discountAmount,
        netRevenue,
        averageOrderValue:
          orderCount > 0 ? Math.round(netRevenue / orderCount) : 0,
      },
      dailySales: Array.from(dailyMap.values()),
      productSales,
      paymentProviders,
      ...(includeOrders
        ? {
            orders,
            ordersTruncated: snap.size > orders.length,
            orderLimit,
          }
        : {}),
    });
  } catch (err) {
    console.error("[API sales report]", err);
    return Response.json(
      {
        success: false,
        error: "SERVER_ERROR",
        message: "Unable to generate sales report.",
      },
      { status: 500 }
    );
  }
}

function parseDateBoundary(
  value: string,
  boundary: "start" | "end"
): number | null {
  if (!value) return null;

  if (DATE_ONLY_RE.test(value)) {
    const time =
      boundary === "start" ? "T00:00:00.000+07:00" : "T23:59:59.999+07:00";
    return parseValidDate(value + time);
  }

  const normalized = value.includes(" ") ? value.replace(" ", "T") : value;
  const dateValue = HAS_TIME_ZONE_RE.test(normalized)
    ? normalized
    : normalized + "+07:00";
  return parseValidDate(dateValue);
}

function parseValidDate(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function parseOrderLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(Math.max(Math.floor(parsed), 1), 500);
}

function buildDailyMap(fromMs: number, toMs: number): Map<string, DailySalesRow> {
  const dailyMap = new Map<string, DailySalesRow>();
  let cursor = formatDateInTimeZone(fromMs);
  const end = formatDateInTimeZone(toMs);

  while (cursor <= end) {
    dailyMap.set(cursor, {
      date: cursor,
      orderCount: 0,
      itemQuantity: 0,
      grossRevenue: 0,
      discountAmount: 0,
      netRevenue: 0,
    });
    cursor = addOneDay(cursor);
  }

  return dailyMap;
}

function addOneDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function formatDateInTimeZone(ms: number): string {
  return new Date(ms)
    .toLocaleString("sv-SE", { timeZone: REPORT_TIME_ZONE })
    .slice(0, 10);
}

function addProducts(
  productMap: Map<string, ProductSalesRow>,
  items: OrderItem[],
  orderNetRevenue: number,
  orderGrossRevenue: number
) {
  const netAllocations = allocateItemNetRevenue(
    items,
    orderNetRevenue,
    orderGrossRevenue
  );
  const countedProductIds = new Set<string>();

  items.forEach((item, index) => {
    const productId = item.productId || "unknown";
    const row =
      productMap.get(productId) ??
      {
        productId,
        productName: item.productName || "Unknown product",
        productType: item.productType,
        quantitySold: 0,
        grossRevenue: 0,
        netRevenue: 0,
        orderCount: 0,
      };

    row.quantitySold += toNumber(item.quantity);
    row.grossRevenue += getItemSubtotal(item);
    row.netRevenue += netAllocations[index] ?? 0;
    if (!countedProductIds.has(productId)) {
      row.orderCount += 1;
      countedProductIds.add(productId);
    }
    productMap.set(productId, row);
  });
}

function allocateItemNetRevenue(
  items: OrderItem[],
  orderNetRevenue: number,
  orderGrossRevenue: number
): number[] {
  if (items.length === 0) return [];

  const totalItemSubtotal =
    orderGrossRevenue > 0
      ? orderGrossRevenue
      : items.reduce((sum, item) => sum + getItemSubtotal(item), 0);

  if (totalItemSubtotal <= 0) return items.map(() => 0);

  let allocated = 0;
  return items.map((item, index) => {
    if (index === items.length - 1) return orderNetRevenue - allocated;
    const value = Math.round((getItemSubtotal(item) / totalItemSubtotal) * orderNetRevenue);
    allocated += value;
    return value;
  });
}

function getItemSubtotal(item: OrderItem): number {
  const explicitSubtotal = toNumber(item.subtotal);
  if (explicitSubtotal > 0) return explicitSubtotal;
  return toNumber(item.unitPrice) * toNumber(item.quantity);
}

function serializeOrder(order: OrderDocument) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    orderCode: order.orderCode ?? null,
    status: order.status,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone ?? null,
    paymentProvider: order.paymentDetails?.provider ?? null,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount,
    finalAmount: order.finalAmount,
    itemQuantity: order.items.reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0
    ),
    passIds: order.passIds ?? [],
    paidAt: timestampToISO(order.paidAt),
    createdAt: timestampToISO(order.createdAt),
  };
}

function timestampToISO(
  ts: { toMillis?: () => number; toDate?: () => Date } | undefined | null
): string | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate().toISOString();
  if (ts.toMillis) return new Date(ts.toMillis()).toISOString();
  return null;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
