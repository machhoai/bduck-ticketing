import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Prevent duplicate initialization in Next.js hot reload
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ─── Collection Name Constants ────────────────────────────────────────────────
// All B.Duck Cityfuns collections use 'bduck_' prefix to coexist with ERP
// collections in the same Firebase project without collision.
export const COLLECTIONS = {
  USERS: "bduck_users",
  PRODUCT_GROUPS: "bduck_productGroups",
  PRODUCTS: "bduck_products",
  PROMOTIONS: "bduck_promotions",
  ORDERS: "bduck_orders",
  PASSES: "bduck_passes",
  AFFILIATE_PROFILES: "bduck_affiliateProfiles",
  PAYOUT_REQUESTS: "bduck_payoutRequests",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
