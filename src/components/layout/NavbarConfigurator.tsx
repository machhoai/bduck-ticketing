"use client";

import { useNavbar } from "@/stores/navbar";
import type { NavbarConfig } from "@/stores/navbar";

/**
 * Drop this into any Server Component to configure navbar appearance.
 * Renders nothing — only calls the useNavbar hook on the client.
 *
 * @example
 * // In a Server Component page:
 * <NavbarConfigurator solidBg darkText />
 */
export function NavbarConfigurator(config: Partial<NavbarConfig>) {
    useNavbar(config);
    return null;
}
