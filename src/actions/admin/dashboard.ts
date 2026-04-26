"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";
import { COLLECTIONS } from "@/lib/firebase/client";
import { Timestamp } from "firebase-admin/firestore";

export interface DashboardStats {
  revenueThirtyDays: number;
  ordersThirtyDays: number;
  totalPassesIssued: number;
  pendingAffiliates: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    finalAmount: number;
    status: string;
    createdAt: Timestamp;
  }>;
}

export interface RangeStats {
  revenue: number;
  orders: number;
  passes: number;
  avgOrderValue: number;
  dailyRevenue: Array<{ date: string; revenue: number; orders: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    finalAmount: number;
    status: string;
    createdAt: string; // ISO string for client serialization
  }>;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin();

  const thirtyDaysAgo = Timestamp.fromMillis(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  );

  const [paidOrdersSnap, pendingAffSnap, recentSnap] = await Promise.all([
    adminDb
      .collection(COLLECTIONS.ORDERS)
      .where("status", "==", "paid")
      .where("createdAt", ">=", thirtyDaysAgo)
      .get(),
    adminDb
      .collection(COLLECTIONS.AFFILIATE_PROFILES)
      .where("applicationStatus", "==", "pending")
      .get(),
    adminDb
      .collection(COLLECTIONS.ORDERS)
      .where("status", "==", "paid")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get(),
  ]);

  let revenueThirtyDays = 0;
  let totalPassesIssued = 0;

  for (const doc of paidOrdersSnap.docs) {
    const data = doc.data();
    revenueThirtyDays += data.finalAmount ?? 0;
    totalPassesIssued += (data.passIds as string[])?.length ?? 0;
  }

  const recentOrders = recentSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      orderNumber: d.orderNumber,
      customerName: d.customerName,
      finalAmount: d.finalAmount,
      status: d.status,
      createdAt: d.createdAt,
    };
  });

  return {
    revenueThirtyDays,
    ordersThirtyDays: paidOrdersSnap.size,
    totalPassesIssued,
    pendingAffiliates: pendingAffSnap.size,
    recentOrders,
  };
}

// ─── Get Revenue Stats for a custom date range ────────────────────────────────
/**
 * Returns aggregated revenue data for a given date range.
 * Used by the DashboardClient for the date picker.
 * Dates are ISO strings (YYYY-MM-DD) in local time.
 */
export async function getDashboardStatsByRange(
  fromISO: string, // e.g. "2024-04-01"
  toISO: string    // e.g. "2024-04-30"
): Promise<RangeStats> {
  await requireAdmin();

  const fromMs = new Date(fromISO + "T00:00:00+07:00").getTime();
  const toMs   = new Date(toISO   + "T23:59:59+07:00").getTime();

  const snap = await adminDb
    .collection(COLLECTIONS.ORDERS)
    .where("status", "==", "paid")
    .where("createdAt", ">=", Timestamp.fromMillis(fromMs))
    .where("createdAt", "<=", Timestamp.fromMillis(toMs))
    .orderBy("createdAt", "asc")
    .get();

  let revenue = 0;
  let passes  = 0;
  const dailyMap: Record<string, { revenue: number; orders: number }> = {};

  for (const doc of snap.docs) {
    const d = doc.data();
    revenue += d.finalAmount ?? 0;
    passes  += (d.passIds as string[])?.length ?? 0;

    // Group by date (Asia/Ho_Chi_Minh = UTC+7)
    const date = new Date((d.createdAt as Timestamp).toMillis())
      .toLocaleString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" })
      .slice(0, 10); // "YYYY-MM-DD"

    if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0 };
    dailyMap[date].revenue += d.finalAmount ?? 0;
    dailyMap[date].orders  += 1;
  }

  const orders = snap.size;
  const avgOrderValue = orders > 0 ? Math.round(revenue / orders) : 0;

  // Fill in every day in range (even with 0)
  const dailyRevenue: Array<{ date: string; revenue: number; orders: number }> = [];
  const cursor = new Date(fromMs);
  const end    = new Date(toMs);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    dailyRevenue.push({
      date:    key,
      revenue: dailyMap[key]?.revenue ?? 0,
      orders:  dailyMap[key]?.orders  ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Recent orders (newest first, max 10) — from the SAME date-filtered set
  const recentOrders = snap.docs
    .slice()
    .sort((a, b) => {
      const ta = (a.data().createdAt as Timestamp).toMillis();
      const tb = (b.data().createdAt as Timestamp).toMillis();
      return tb - ta;
    })
    .slice(0, 10)
    .map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        orderNumber: d.orderNumber as string,
        customerName: d.customerName as string,
        finalAmount: (d.finalAmount ?? 0) as number,
        status: d.status as string,
        createdAt: new Date((d.createdAt as Timestamp).toMillis()).toISOString(),
      };
    });

  return { revenue, orders, passes, avgOrderValue, dailyRevenue, recentOrders };
}
