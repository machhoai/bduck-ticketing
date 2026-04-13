"use client";

// Client polling component for pending order status
// Polls /api/order-status every 3s, redirects when paid (max 30s timeout)
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ResultPollerProps {
  orderId: string;
  locale: string;
}

export function ResultPoller({ orderId, locale }: ResultPollerProps) {
  const router = useRouter();
  const startTime = useRef(Date.now());
  const MAX_POLL_MS = 30_000; // 30 seconds

  useEffect(() => {
    const interval = setInterval(async () => {
      // Timeout check
      if (Date.now() - startTime.current > MAX_POLL_MS) {
        clearInterval(interval);
        return; // show "check email" fallback — handled by parent page
      }

      try {
        const res = await fetch(
          `/api/order-status?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "paid") {
          clearInterval(interval);
          // Refresh RSC to show success state
          router.refresh();
        } else if (data.status === "cancelled") {
          clearInterval(interval);
          router.replace(
            `/${locale}/checkout/result?orderId=${orderId}&status=failed`
          );
        }
      } catch {
        // Network error — continue polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [orderId, locale, router]);

  return (
    <p className="text-xs text-gray-400 mt-4">
      Nếu sau 30 giây vẫn không thấy kết quả, vui lòng kiểm tra email hoặc{" "}
      <a
        href={`/${locale}/orders`}
        className="text-[#F5C842] font-semibold hover:underline"
      >
        xem lịch sử đơn hàng
      </a>
      .
    </p>
  );
}
