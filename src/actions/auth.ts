"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { createSession } from "@/lib/auth/session";
import { FieldValue } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/client";
import type { UserRole } from "@/types/firestore";

/**
 * Single auth server action. Called after ANY client-side Firebase Auth
 * operation — email login, email register, or Google sign-in.
 *
 * Responsibilities (server-only):
 *  1. Verify the Firebase ID token is genuine via Admin SDK
 *  2. Mint an HTTP-only session cookie (5 days)
 *  3. Upsert a Firestore user profile in bduck_users
 *     - First login → creates profile with role:"customer"
 *     - Returning user → reads existing role (admin/affiliate/customer)
 *  4. Returns { role } so the client can do a smart redirect
 *
 * NOTE: The client Firebase SDK handles ALL credential operations
 * (signIn, signUp, Google popup). This action never creates Firebase
 * Auth users — that would cause "email already exists" errors.
 */
export async function createSessionAndSyncUser(
    idToken: string
): Promise<{ role: UserRole }> {
    // ── 1. Verify token ──────────────────────────────────────────────────────
    const decoded = await adminAuth.verifyIdToken(idToken);
    const { uid, email, name, picture } = decoded;

    // ── 2. Mint HTTP-only session cookie ─────────────────────────────────────
    await createSession(idToken);

    // ── 3. Upsert Firestore profile (Admin SDK — server-only) ────────────────
    const userRef = adminDb.collection(COLLECTIONS.USERS).doc(uid);
    const snap = await userRef.get();

    if (!snap.exists) {
        // First-time user — create profile with customer role
        await userRef.set({
            uid,
            email: email ?? "",
            displayName: name ?? email?.split("@")[0] ?? "User",
            photoURL: picture ?? null,
            role: "customer" satisfies UserRole,
            customerProfile: {
                totalOrders: 0,
                totalSpent: 0,
            },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { role: "customer" };
    }

    // Existing user — return their current role
    const data = snap.data();
    return { role: (data?.role ?? "customer") as UserRole };
}
