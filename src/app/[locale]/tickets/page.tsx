import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { getProducts, getProductGroups } from "@/actions/products";
import { serializeProducts } from "@/lib/serializeProduct";
import { ProductsExplorer } from "@/components/customer/ProductsExplorer";
import { Skeleton } from "@/components/ui";
import type { Metadata } from "next";

// ─── SEO ──────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Mua vé — B.Duck Cityfuns",
  description:
    "Khám phá toàn bộ vé tham quan, combo ưu đãi tại B.Duck Cityfuns. Thanh toán an toàn, nhận vé điện tử ngay lập tức.",
  keywords: ["mua vé", "B.Duck Cityfuns", "vé khu vui chơi", "combo vé"],
  openGraph: {
    title: "Mua vé B.Duck Cityfuns",
    description: "Tất cả vé tham quan và combo ưu đãi tại B.Duck Cityfuns.",
    type: "website",
  },
};

// Revalidate every 60s — matches product cache TTL
export const revalidate = 60;

// ─── Skeleton fallback ────────────────────────────────────────────────────────
function ExplorerSkeleton() {
  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Banner skeleton */}
      <div className="bg-[#1A1A2E] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <Skeleton className="h-6 w-48 mx-auto rounded-full bg-white/10" />
          <Skeleton className="h-12 w-96 mx-auto rounded-2xl bg-white/10" />
          <Skeleton className="h-5 w-72 mx-auto rounded-xl bg-white/10" />
          <Skeleton className="h-12 max-w-lg mx-auto rounded-2xl bg-white/10 mt-4" />
        </div>
      </div>
      {/* Filter bar skeleton */}
      <div className="bg-white border-b border-gray-100 py-3 px-6">
        <div className="max-w-6xl mx-auto flex gap-2">
          {["w-20", "w-24", "w-24", "w-28"].map((w) => (
            <Skeleton key={w} className={`h-9 rounded-full ${w}`} />
          ))}
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Data Fetcher (inner RSC) ─────────────────────────────────────────────────
async function ProductsData({ locale }: { locale: string }) {
  const [allProducts, groups] = await Promise.all([
    getProducts(), // no groupId = all active products
    getProductGroups(),
  ]);

  // Serialize Firestore Timestamps → plain numbers before passing to Client Component
  const clientProducts = serializeProducts(allProducts);

  return (
    <ProductsExplorer
      allProducts={clientProducts}
      groups={groups}
      locale={locale}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function TicketsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <Suspense fallback={<ExplorerSkeleton />}>
      <ProductsData locale={locale} />
    </Suspense>
  );
}
