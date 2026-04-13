import { Suspense } from "react";
import { Hero } from "@/components/home/Hero";
import { Attractions } from "@/components/home/Attractions";
import { ProductGroupTabs } from "@/components/customer/ProductGroupTabs";
import { ProductCard } from "@/components/customer/ProductCard";
import { Skeleton } from "@/components/ui";
import { getProductGroups, getProducts } from "@/actions/products";
import { setRequestLocale } from "next-intl/server";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ group?: string }>;
}

export default async function HomePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { group: activeGroupId } = await searchParams;
  setRequestLocale(locale);

  const [groups, products] = await Promise.all([
    getProductGroups(),
    getProducts(activeGroupId),
  ]);

  return (
    <>
      <Hero />
      <Attractions />

      {/* ── Ticket Listing Section ── */}
      <section
        id="tickets"
        aria-labelledby="tickets-heading"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-14"
      >
        <div className="mb-8">
          <h2
            id="tickets-heading"
            className="text-3xl font-extrabold text-[#1A1A2E] mb-1"
          >
            🎟️ Mua vé{" "}
            <span className="text-[#F5C842]">B.Duck Cityfuns</span>
          </h2>
          <p className="text-gray-500 text-sm">
            Chọn loại vé phù hợp, thanh toán an toàn, nhận vé điện tử ngay lập tức.
          </p>
        </div>

        {/* Tab navigation — Client Component */}
        {groups.length > 0 && (
          <div className="mb-6">
            <ProductGroupTabs
              groups={groups}
              activeGroupId={activeGroupId}
            />
          </div>
        )}

        {/* Product grid */}
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          }
        >
          {products.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-4xl mb-3">🦆</p>
              <p>Chưa có sản phẩm trong nhóm này.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                />
              ))}
            </div>
          )}
        </Suspense>
      </section>
    </>
  );
}
