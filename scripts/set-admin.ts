/**
 * One-time script to grant admin role to a Firebase user.
 *
 * USAGE:
 *   npx tsx scripts/set-admin.ts <email>
 *
 * EXAMPLE:
 *   npx tsx scripts/set-admin.ts admin@bduck.vn
 *
 * This sets:
 *  - Firebase custom claims: { role: "admin" }
 *  - Firestore bduck_users document: { role: "admin" }
 *
 * The user must already exist in Firebase Authentication.
 */

import * as admin from "firebase-admin";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local
config({ path: resolve(process.cwd(), ".env.local") });

const email = process.argv[2];
if (!email) {
  console.error("❌  Usage: npx tsx scripts/set-admin.ts <email>");
  process.exit(1);
}

// Parse private key (handles escaped \n from .env.local)
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? "")
  .replace(/\\n/g, "\n")
  .replace(/^"|"$/g, "");

// Init admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const authAdmin = admin.auth();

async function setAdmin(email: string) {
  console.log(`\n🔍  Looking up user: ${email}`);

  // Get user by email
  let user: admin.auth.UserRecord;
  try {
    user = await authAdmin.getUserByEmail(email);
  } catch {
    console.error(`❌  User not found: ${email}`);
    console.error("    Make sure the user has signed up at least once via Firebase Auth.");
    process.exit(1);
  }

  console.log(`✅  Found user: ${user.displayName ?? "(no display name)"} [uid: ${user.uid}]`);

  // Set custom claims
  await authAdmin.setCustomUserClaims(user.uid, { role: "admin" });
  console.log(`🔐  Custom claims set: { role: "admin" }`);

  // Upsert Firestore bduck_users document
  await db
    .collection("bduck_users")
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName ?? email.split("@")[0],
        role: "admin",
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );
  console.log(`📄  Firestore bduck_users/${user.uid} updated: { role: "admin" }`);

  console.log(`\n🎉  Done! ${email} is now an admin.`);
  console.log(`    Ask them to sign out and sign back in for the claims to take effect.\n`);
}

setAdmin(email).catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
