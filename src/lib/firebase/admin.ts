import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0];

  // Validate at runtime — clear error message instead of Firebase's cryptic one
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    const missing = [
      !projectId && "FIREBASE_ADMIN_PROJECT_ID",
      !clientEmail && "FIREBASE_ADMIN_CLIENT_EMAIL",
      !privateKey && "FIREBASE_ADMIN_PRIVATE_KEY",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `[firebase/admin] Missing required environment variables: ${missing}`
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // Replace escaped newlines from env var string
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// Lazy Proxy singletons — initialized on first use (request time), not at import
// time (build time). Keeps the same usage shape: adminDb.collection(...) etc.
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: Storage | null = null;

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    _auth ??= getAuth(getAdminApp());
    return (_auth as never)[prop];
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    _db ??= getFirestore(getAdminApp());
    return (_db as never)[prop];
  },
});

export const adminStorage: Storage = new Proxy({} as Storage, {
  get(_, prop) {
    _storage ??= getStorage(getAdminApp());
    return (_storage as never)[prop];
  },
});
