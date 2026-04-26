import type { Metadata } from "next";
import { getAdminTransferOrders } from "@/actions/admin/orders";
import { TransferOrdersClient } from "./TransferOrdersClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Duyệt đơn chuyển khoản — Admin",
};

export default async function TransferOrdersPage() {
  const orders = await getAdminTransferOrders();

  // Serialize Firestore Timestamps for client
  const serialized = orders.map((o) => ({
    ...o,
    createdAt: o.createdAt?.toMillis ? new Date(o.createdAt.toMillis()).toISOString() : "",
    updatedAt: o.updatedAt?.toMillis ? new Date(o.updatedAt.toMillis()).toISOString() : "",
    expiresAt: o.expiresAt?.toMillis ? new Date(o.expiresAt.toMillis()).toISOString() : undefined,
    paidAt: o.paidAt?.toMillis ? new Date(o.paidAt.toMillis()).toISOString() : undefined,
    cancelledAt: o.cancelledAt?.toMillis ? new Date(o.cancelledAt.toMillis()).toISOString() : undefined,
    // Flatten validity configs timestamps in items
    items: o.items.map((item) => ({
      ...item,
      validityConfig: {
        ...item.validityConfig,
        specificDate: undefined,
        overallExpiresAt: undefined,
      },
    })),
  }));

  return <TransferOrdersClient orders={JSON.parse(JSON.stringify(serialized))} />;
}
