/**
 * Locale-aware navigation utilities for next-intl v4.
 *
 * Import useRouter, usePathname, Link, and redirect from here
 * instead of "next/navigation" to get automatic locale handling.
 *
 * Usage:
 *   import { useRouter, usePathname, Link } from "@/i18n/navigation";
 *   const router = useRouter();
 *   router.push("/tickets", { locale: "en" }); // switch locale
 *   router.push("/tickets");                    // keep current locale
 */
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
