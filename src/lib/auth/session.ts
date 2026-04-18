import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

const SESSION_COOKIE_NAME = "bduck_session";
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

/**
 * Creates an HTTP-only session cookie from a Firebase ID token.
 * Called after successful client-side Firebase Auth login.
 */
export async function createSession(idToken: string): Promise<void> {
  const expiresIn = SESSION_DURATION_MS;
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: expiresIn / 1000, // seconds
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Verifies the session cookie and returns the decoded token.
 * Returns null if the session is missing or invalid.
 */
export async function verifySession(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Deletes the session cookie (logout).
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Gets the current user from session, throws if unauthenticated.
 * Use in Server Actions that require auth.
 */
export async function requireAuth(): Promise<DecodedIdToken> {
  const session = await verifySession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}

/**
 * Gets the current user from session, throws if not admin.
 * Use in Server Actions that require admin role.
 */
export async function requireAdmin(): Promise<DecodedIdToken> {
  const session = await requireAuth();
  const user = await adminAuth.getUser(session.uid);
  const claims = user.customClaims as { role?: string } | undefined;

  if (claims?.role !== "admin") {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

/**
 * Gets the current user from session, throws if not an approved affiliate.
 * Use in Server Actions and layouts that require affiliate role.
 */
export async function requireAffiliate(): Promise<DecodedIdToken> {
  const session = await requireAuth();
  const user = await adminAuth.getUser(session.uid);
  const claims = user.customClaims as { role?: string } | undefined;

  if (claims?.role !== "affiliate") {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
