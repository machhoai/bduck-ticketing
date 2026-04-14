"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
    const t = useTranslations("ticketSection");

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
            aria-label="Product groups"
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide overflow-visible p-2"
        >
            {/* "All" tab */}
            <button
                role="tab"
                aria-selected={!activeGroupId}
                onClick={() => handleTabClick(null)}
                className={clsx(
                    "flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer",
                    !activeGroupId
                        ? "bg-[#1A1A2E] text-[#F5C842] shadow-md scale-105"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
            >
                {t("allTab")}
            </button>

            {groups.map((group) => (
                <button
                    key={group.id}
                    role="tab"
                    aria-selected={activeGroupId === group.id}
                    onClick={() => handleTabClick(group.id)}
                    className={clsx(
                        "flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer",
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
