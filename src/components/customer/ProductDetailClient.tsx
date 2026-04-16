"use client";

import { useNavbar } from "@/stores/navbar";
import type { ReactNode } from "react";

/**
 * Client wrapper for product detail page.
 * Configures the navbar to use dark text + solid bg since
 * this page has a light background.
 */
export function ProductDetailClient({ children }: { children: ReactNode }) {
    useNavbar({ darkText: true, shadow: false, solidBg: false });
    return <>{children}</>;
}
