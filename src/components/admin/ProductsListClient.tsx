"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Edit2, Power, Search, X } from "lucide-react";
import { toggleProductStatus } from "@/actions/admin/products";
import type { ClientProduct } from "@/lib/serializeProduct";
import type { ProductStatus } from "@/types/firestore";

const STATUS_CONFIG: Record<ProductStatus, { label: string; style: string }> = {
  active:    { label: "Đang bán",  style: "bg-emerald-50 text-emerald-600" },
  "sold-out":{ label: "Hết vé",    style: "bg-amber-50 text-amber-600" },
  hidden:    { label: "Ẩn",        style: "bg-gray-100 text-gray-500" },
};

type FilterTab = "active" | "sold-out" | "hidden" | "all";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "active",    label: "Đang bán" },
  { key: "sold-out",  label: "Hết vé" },
  { key: "hidden",    label: "Đã ẩn" },
  { key: "all",       label: "Tất cả" },
];

function formatVND(v: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(v);
}

interface ProductsListClientProps {
  products: ClientProduct[];
  locale: string;
}

export function ProductsListClient({ products, locale }: ProductsListClientProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("active");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = products.filter((p) => {
    const matchTab = activeTab === "all" || p.status === activeTab;
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const count = (tab: FilterTab) =>
    tab === "all" ? products.length : products.filter((p) => p.status === tab).length;

  function handleToggle(id: string, status: ProductStatus) {
    startTransition(async () => {
      await toggleProductStatus(id, status);
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🎟️ Sản phẩm</h1>
          <p className="text-sm text-gray-400 mt-1">{filtered.length} / {products.length} sản phẩm</p>
        </div>
        <Link href={`/${locale}/admin/products/new`}>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Thêm sản phẩm
          </button>
        </Link>
      </div>

      {/* ── Filter Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                activeTab === key
                  ? "bg-[#1A1A2E] text-[#F5C842] shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === key ? "bg-[#F5C842]/20 text-[#F5C842]" : "bg-gray-200 text-gray-500"
              }`}>
                {count(key)}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên sản phẩm..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent bg-gray-50"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                {["Sản phẩm", "Nhóm", "Loại", "Giá", "Đã bán", "Stock", "Trạng thái", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((product) => {
                const st = STATUS_CONFIG[product.status] ?? STATUS_CONFIG.hidden;
                const hasStock = product.totalStock !== undefined;
                const stockLeft = hasStock ? product.totalStock! - product.soldCount : null;
                return (
                  <tr key={product.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.thumbnailUrl ? (
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                            <img src={product.thumbnailUrl} alt={product.name} className="absolute inset-0 h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-semibold text-[#1A1A2E] line-clamp-1">{product.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{product.id.slice(-8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {product.dealSectionId ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">⚡ Deal</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        product.type === "combo" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"
                      }`}>
                        {product.type === "combo" ? "Combo" : "Vé đơn"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#1A1A2E] whitespace-nowrap">
                      {formatVND(product.price)}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{product.soldCount ?? 0}</td>
                    <td className="px-4 py-3">
                      {hasStock ? (
                        <span className={`text-xs font-semibold ${stockLeft! <= 0 ? "text-red-500" : stockLeft! <= 10 ? "text-amber-500" : "text-gray-600"}`}>
                          {stockLeft} còn lại
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Không giới hạn</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${st.style}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/${locale}/admin/products/${product.id}`}>
                          <button className="p-1.5 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors" title="Sửa">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </Link>
                        <button
                          disabled={isPending}
                          onClick={() => handleToggle(product.id, product.status)}
                          title={product.status === "active" ? "Tắt bán" : "Bật bán"}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                            product.status === "active"
                              ? "text-emerald-500 hover:bg-emerald-50"
                              : "text-gray-400 hover:bg-gray-100"
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">
              {search ? `Không tìm thấy sản phẩm nào với "${search}"` : "Không có sản phẩm nào"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
