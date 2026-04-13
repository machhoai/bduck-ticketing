import { notFound } from "next/navigation";
import { getProductGroupsAdmin } from "@/actions/admin/productGroups";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { ProductForm } from "@/components/admin/ProductForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import type { ProductDocument } from "@/types/firestore";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; productId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productId } = await params;
  const snap = await adminDb.collection(COLLECTIONS.PRODUCTS).doc(productId).get();
  const name = snap.exists ? (snap.data()?.name ?? "Sản phẩm") : "Sản phẩm";
  return { title: `Sửa: ${name}` };
}

export default async function EditProductPage({ params }: PageProps) {
  const { locale, productId } = await params;

  const [productSnap, groups] = await Promise.all([
    adminDb.collection(COLLECTIONS.PRODUCTS).doc(productId).get(),
    getProductGroupsAdmin(),
  ]);

  if (!productSnap.exists) notFound();

  const product = {
    id: productSnap.id,
    ...(productSnap.data() as Omit<ProductDocument, "id">),
  };

  const groupList = groups.map((g) => ({ id: g.id, name: g.name }));

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
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">✏️ Sửa sản phẩm</h1>
          <p className="text-sm text-gray-400 mt-0.5 font-mono">{productId}</p>
        </div>
      </div>

      <ProductForm
        groups={groupList}
        initialData={product}
        productId={productId}
        locale={locale}
      />
    </div>
  );
}
