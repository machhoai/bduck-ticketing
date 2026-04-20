import {
  getProductGroupsAdmin,
  swapProductGroupOrder,
  toggleProductGroupActive,
  createProductGroup,
} from "@/actions/admin/productGroups";
import { ChevronUp, ChevronDown, Power, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nhóm sản phẩm" };
export const dynamic = "force-dynamic";

// ─── Server Actions (FormData-based — no closure over non-serializable objects)
async function actionSwapUp(formData: FormData) {
  "use server";
  const aId = String(formData.get("aId") ?? "");
  const aOrder = Number(formData.get("aOrder"));
  const bId = String(formData.get("bId") ?? "");
  const bOrder = Number(formData.get("bOrder"));
  if (aId && bId) await swapProductGroupOrder(aId, aOrder, bId, bOrder);
}

async function actionSwapDown(formData: FormData) {
  "use server";
  const aId = String(formData.get("aId") ?? "");
  const aOrder = Number(formData.get("aOrder"));
  const bId = String(formData.get("bId") ?? "");
  const bOrder = Number(formData.get("bOrder"));
  if (aId && bId) await swapProductGroupOrder(aId, aOrder, bId, bOrder);
}

async function actionToggle(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const isActive = formData.get("isActive") === "true";
  if (id) await toggleProductGroupActive(id, isActive);
}

async function actionCreate(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  const order = Number(formData.get("order") ?? 1);
  if (name && slug) {
    const nameLocales: Record<string, string> = { vi: name };
    if (nameEn) nameLocales["en"] = nameEn;
    await createProductGroup({ name, nameLocales, slug, order });
  }
}

interface PageProps {
  searchParams: Promise<{ showHidden?: string }>;
}

export default async function AdminProductGroupsPage({ searchParams }: PageProps) {
  const { showHidden } = await searchParams;
  const allGroups = await getProductGroupsAdmin();
  const showAll = showHidden === "1";
  const groups = showAll ? allGroups : allGroups.filter((g) => g.isActive);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E]">🗂️ Nhóm sản phẩm</h1>
          <p className="text-sm text-gray-400 mt-1">Quản lý tabs hiển thị trên trang chủ</p>
        </div>
        <div className="flex gap-1.5">
          <Link
            href="?showHidden=0"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              !showAll ? "bg-[#1A1A2E] text-[#F5C842] shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Eye className="h-3.5 w-3.5" /> Đang hiện ({allGroups.filter((g) => g.isActive).length})
          </Link>
          <Link
            href="?showHidden=1"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              showAll ? "bg-[#1A1A2E] text-[#F5C842] shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" /> Tất cả ({allGroups.length})
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Group List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
              <tr>
                {["Thứ tự", "Tên nhóm", "Slug", "Trạng thái", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groups.map((group, idx) => (
                <tr key={group.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400 font-mono text-xs w-5">{group.order}</span>
                      <div className="flex flex-col">
                        {/* Move Up */}
                        {idx > 0 && (
                          <form action={actionSwapUp}>
                            <input type="hidden" name="aId" value={group.id} />
                            <input type="hidden" name="aOrder" value={group.order} />
                            <input type="hidden" name="bId" value={groups[idx - 1].id} />
                            <input type="hidden" name="bOrder" value={groups[idx - 1].order} />
                            <button type="submit" className="p-0.5 text-gray-400 hover:text-[#1A1A2E]">
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        )}
                        {/* Move Down */}
                        {idx < groups.length - 1 && (
                          <form action={actionSwapDown}>
                            <input type="hidden" name="aId" value={group.id} />
                            <input type="hidden" name="aOrder" value={group.order} />
                            <input type="hidden" name="bId" value={groups[idx + 1].id} />
                            <input type="hidden" name="bOrder" value={groups[idx + 1].order} />
                            <button type="submit" className="p-0.5 text-gray-400 hover:text-[#1A1A2E]">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1A1A2E] text-sm">{group.name}</p>
                    {group.nameLocales?.["en"] && (
                      <p className="text-xs text-gray-400">{group.nameLocales["en"]}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{group.slug}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      group.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                    }`}>
                      {group.isActive ? "Hiện" : "Ẩn"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {/* Toggle active — only primitive values in FormData */}
                    <form action={actionToggle}>
                      <input type="hidden" name="id" value={group.id} />
                      <input type="hidden" name="isActive" value={String(group.isActive)} />
                      <button
                        type="submit"
                        className={`p-1.5 rounded-lg transition-colors ${
                          group.isActive
                            ? "text-emerald-500 hover:bg-emerald-50"
                            : "text-gray-400 hover:bg-gray-100"
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {groups.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">Chưa có nhóm nào</div>
          )}
        </div>

        {/* Create Form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-[#1A1A2E] mb-4">Tạo nhóm mới</h2>
          <form action={actionCreate} className="space-y-3">
            {/* Pass current length as hidden input — no closure over non-serializable data */}
            <input type="hidden" name="order" value={groups.length + 1} />
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Tên nhóm 🇻🇳 *</label>
              <input
                name="name"
                placeholder="VD: Vé Thuỷ Cung"
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Group Name 🇬🇧</label>
              <input
                name="nameEn"
                placeholder="E.g. Aquarium Tickets"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Slug (URL)</label>
              <input
                name="slug"
                placeholder="VD: ve-thuy-cung"
                required
                pattern="[a-z0-9\-]+"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors"
            >
              Tạo nhóm
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
