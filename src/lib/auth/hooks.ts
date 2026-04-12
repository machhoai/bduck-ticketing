"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthContext } from "@/lib/auth/provider";
import type { UserRole } from "@/types/firestore";

// ─── Base Hook ────────────────────────────────────────────────────────────────

/** Returns current auth state. Safe to call anywhere in client components. */
export function useAuth() {
  return useAuthContext();
}

// ─── Guard Hooks ──────────────────────────────────────────────────────────────

/**
 * Redirects to /login if user is not authenticated.
 * Returns auth state after guard check.
 */
export function useRequireAuth(redirectTo = "/auth/login") {
  const auth = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.replace(redirectTo);
    }
  }, [auth.loading, auth.user, router, redirectTo]);

  return auth;
}

/**
 * Redirects to /unauthorized if user doesn't have the required role.
 * Returns auth state after guard check.
 */
export function useRequireRole(
  requiredRole: UserRole,
  redirectTo = "/unauthorized"
) {
  const auth = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (auth.loading) return;

    if (!auth.user) {
      router.replace("/auth/login");
      return;
    }

    if (auth.profile?.role !== requiredRole) {
      router.replace(redirectTo);
    }
  }, [auth.loading, auth.user, auth.profile, router, requiredRole, redirectTo]);

  return auth;
}

// ─── Convenience Hooks ────────────────────────────────────────────────────────

/** Returns true if the current user is an admin */
export function useIsAdmin(): boolean {
  const { profile } = useAuthContext();
  return profile?.role === "admin";
}

/** Returns true if the current user is an approved affiliate */
export function useIsAffiliate(): boolean {
  const { profile } = useAuthContext();
  return profile?.role === "affiliate";
}

/** Returns true if the current user is a customer */
export function useIsCustomer(): boolean {
  const { profile } = useAuthContext();
  return profile?.role === "customer";
}
