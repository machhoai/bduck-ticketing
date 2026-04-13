import Link from "next/link";
import { getAdminProducts } from "@/actions/admin/products";
import { toggleProductStatus } from "@/actions/admin/products";
import { Plus, Edit2, Power } from "lucide-react";
import type { Metadata } from "next";
import type { ProductStatus } from "@/types/firestore";

export const metadata: Metadata = { title: "Sản phẩm" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<ProductStatus | string, { label: string; style: string }> = {
  active: { label: "Đang bán", style: "bg-emerald-50 text-emerald-600" },
  "sold-out": { label: "Hết vé", style: "bg-amber-50 text-amber-600" },
  hidden: { label: "Ẩn", style: "bg-gray-100 text-gray-500" },
};

export default async function AdminProductsPage() {
  const products = await getAdminProducts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🎟️ Sản phẩm</h1>
          <p className="text-sm text-gray-400 mt-1">{products.length} sản phẩm</p>
        </div>
        <Link href="products/new">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors">
            <Plus className="h-4 w-4" /> Thêm sản phẩm
          </button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                {["Sản phẩm", "Loại", "Giá", "Đã bán", "Trạng thái", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((product) => {
                const st = STATUS_STYLE[product.status] ?? STATUS_STYLE.hidden;
                return (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.thumbnailUrl && (
                          <img
                            src={product.thumbnailUrl}
                            alt={product.name}
                            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                          />
                        )}
                        <span className="font-semibold text-[#1A1A2E] line-clamp-1">
                          {product.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 capitalize">{product.type}</td>
                    <td className="px-4 py-3 font-semibold">
                      {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(product.price)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{product.soldCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.style}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`products/${product.id}`}>
                          <button className="p-1.5 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors" title="Sửa">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                        <form action={async () => {
                          "use server";
                          await toggleProductStatus(product.id, product.status as ProductStatus);
                        }}>
                          <button
                            type="submit"
                            title={product.status === "active" ? "Tắt bán" : "Bật bán"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              product.status === "active"
                                ? "text-emerald-500 hover:bg-emerald-50"
                                : "text-gray-400 hover:bg-gray-100"
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {products.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              Chưa có sản phẩm nào.{" "}
              <Link href="products/new" className="text-[#F5C842] font-semibold">
                Tạo sản phẩm đầu tiên →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
