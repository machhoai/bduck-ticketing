"use server";

import { createSession } from "@/lib/auth/session";

/**
 * Creates an HTTP-only session cookie from a Firebase ID token.
 * Called from the login page after successful Firebase client-side auth.
 *
 * Flow:
 *  1. Client: signInWithEmailAndPassword → getIdToken()
 *  2. Client: calls this Server Action with the idToken
 *  3. Server: createSession() mints an HTTP-only cookie (bduck_session)
 *  4. Client: router.push('/admin')
 */
export async function createUserSession(idToken: string): Promise<void> {
  await createSession(idToken);
}
