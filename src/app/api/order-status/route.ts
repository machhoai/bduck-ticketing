import { type NextRequest, NextResponse } from "next/server";
import { getOrderStatus } from "@/actions/orders";

/**
 * Lightweight polling endpoint for the checkout result page.
 * Called every 3 seconds by the client while order.status === 'pending'.
 *
 * No auth required — orderId is known from the redirect URL.
 * Returns only { status, passIds } to avoid over-fetching.
 *
 * GET /api/order-status?orderId=xxx
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json(
      { error: "missing_order_id" },
      { status: 400 }
    );
  }

  const result = await getOrderStatus(orderId);

  if (!result) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(result, {
    headers: {
      // No caching — this must always be fresh
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
