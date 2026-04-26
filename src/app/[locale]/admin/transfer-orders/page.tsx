import type { Metadata } from "next";
import { getAdminTransferOrders } from "@/actions/admin/orders";
import { TransferOrdersClient } from "./TransferOrdersClient";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Duyệt đơn chuyển khoản — Admin",
};

export default async function TransferOrdersPage() {
  const orders = await getAdminTransferOrders();

  // Collect unique approver UIDs
  const approverUids = new Set<string>();
  for (const o of orders) {
    const pd = o.paymentDetails?.providerData as Record<string, unknown> | undefined;
    const uid = pd?.approvedBy;
    if (uid && typeof uid === "string") approverUids.add(uid);
  }

  // Resolve UIDs to display names
  const approverMap: Record<string, string> = {};
  if (approverUids.size > 0) {
    const uids = [...approverUids];
    // Fetch in batches of 10 (Firestore "in" limit)
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const snap = await adminDb
        .collection(COLLECTIONS.USERS)
        .where("__name__", "in", batch)
        .get();
      for (const doc of snap.docs) {
        const data = doc.data();
        approverMap[doc.id] = data.displayName || data.name || data.email || doc.id;
      }
    }
  }

  // Serialize Firestore Timestamps for client
  const serialized = orders.map((o) => {
    const providerData = o.paymentDetails?.providerData as Record<string, unknown> | undefined;
    const approvedAtRaw = providerData?.approvedAt as { toMillis?: () => number } | undefined;

    return {
      ...o,
      createdAt: o.createdAt?.toMillis ? new Date(o.createdAt.toMillis()).toISOString() : "",
      updatedAt: o.updatedAt?.toMillis ? new Date(o.updatedAt.toMillis()).toISOString() : "",
      expiresAt: o.expiresAt?.toMillis ? new Date(o.expiresAt.toMillis()).toISOString() : undefined,
      paidAt: o.paidAt?.toMillis ? new Date(o.paidAt.toMillis()).toISOString() : undefined,
      cancelledAt: o.cancelledAt?.toMillis ? new Date(o.cancelledAt.toMillis()).toISOString() : undefined,
      // Serialize approvedAt from providerData
      paymentDetails: o.paymentDetails ? {
        ...o.paymentDetails,
        providerData: {
          ...providerData,
          approvedAt: approvedAtRaw?.toMillis
            ? new Date(approvedAtRaw.toMillis()).toISOString()
            : undefined,
          // Resolve approvedBy UID → display name
          approvedByName: providerData?.approvedBy
            ? approverMap[providerData.approvedBy as string] || String(providerData.approvedBy)
            : undefined,
        },
      } : undefined,
      // Flatten validity configs timestamps in items
      items: o.items.map((item) => ({
        ...item,
        validityConfig: {
          ...item.validityConfig,
          specificDate: undefined,
          overallExpiresAt: undefined,
        },
      })),
    };
  });

  return <TransferOrdersClient orders={JSON.parse(JSON.stringify(serialized))} />;
}
