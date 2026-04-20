import { getAdminProducts } from "@/actions/admin/products";
import { ProductsListClient } from "@/components/admin/ProductsListClient";
import { serializeProducts } from "@/lib/serializeProduct";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sản phẩm" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminProductsPage({ params }: PageProps) {
  const { locale } = await params;
  const raw = await getAdminProducts();
  const products = serializeProducts(raw);

  return <ProductsListClient products={products} locale={locale} />;
}
