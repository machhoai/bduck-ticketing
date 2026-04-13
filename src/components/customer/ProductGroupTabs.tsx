"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import type { ProductGroupDocument } from "@/types/firestore";

interface ProductGroupTabsProps {
  groups: ProductGroupDocument[];
  activeGroupId?: string;
}

export function ProductGroupTabs({
  groups,
  activeGroupId,
}: ProductGroupTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  function handleTabClick(groupId: string | null) {
    const url = new URL(pathname, window.location.origin);
    if (groupId) {
      url.searchParams.set("group", groupId);
    } else {
      url.searchParams.delete("group");
    }
    router.push(url.pathname + url.search, { scroll: false });
  }

  return (
    <nav
      role="tablist"
      aria-label="Nhóm sản phẩm"
      className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
    >
      {/* "Tất cả" tab */}
      <button
        role="tab"
        aria-selected={!activeGroupId}
        onClick={() => handleTabClick(null)}
        className={clsx(
          "flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap",
          !activeGroupId
            ? "bg-[#1A1A2E] text-[#F5C842] shadow-md scale-105"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        )}
      >
        Tất cả
      </button>

      {groups.map((group) => (
        <button
          key={group.id}
          role="tab"
          aria-selected={activeGroupId === group.id}
          onClick={() => handleTabClick(group.id)}
          className={clsx(
            "flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap",
            activeGroupId === group.id
              ? "bg-[#1A1A2E] text-[#F5C842] shadow-md scale-105"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          {group.name}
        </button>
      ))}
    </nav>
  );
}
