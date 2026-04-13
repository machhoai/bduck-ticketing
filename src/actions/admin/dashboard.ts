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
