"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, COLLECTIONS } from "@/lib/firebase/client";
import type { UserDocument } from "@/types/firestore";

// ─── Context Types ────────────────────────────────────────────────────────────

interface AuthState {
  /** Firebase Auth user object (null = not logged in) */
  user: User | null;
  /** Full Firestore user profile with role */
  profile: UserDocument | null;
  /** True while auth state is being determined on initial load */
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  /** Manually refresh the user profile from Firestore */
  refreshProfile: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
  });

  const loadProfile = useCallback(async (user: User) => {
    try {
      const snap = await getDoc(
        doc(db, COLLECTIONS.USERS, user.uid)
      );
      const profile = snap.exists() ? (snap.data() as UserDocument) : null;
      setState({ user, profile, loading: false });
    } catch {
      setState({ user, profile: null, loading: false });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!state.user) return;
    await loadProfile(state.user);
  }, [state.user, loadProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadProfile(user);
      } else {
        setState({ user: null, profile: null, loading: false });
      }
    });

    return unsubscribe;
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    // Also clear the server-side session cookie
    await fetch("/api/auth/logout", { method: "POST" });
    setState({ user: null, profile: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/** Returns auth context. Must be used inside AuthProvider. */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
