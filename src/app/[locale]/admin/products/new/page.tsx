import { getProductGroupsAdmin } from "@/actions/admin/productGroups";
import { ProductForm } from "@/components/admin/ProductForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Thêm sản phẩm" };

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewProductPage({ params }: PageProps) {
  const { locale } = await params;
  const result = await getProductGroupsAdmin();
  const groups = result.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${locale}/admin/products`}
          className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-xl transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🎟️ Thêm sản phẩm mới</h1>
          <p className="text-sm text-gray-400 mt-0.5">Điền thông tin để tạo sản phẩm mới</p>
        </div>
      </div>

      <ProductForm groups={groups} locale={locale} />
    </div>
  );
}
