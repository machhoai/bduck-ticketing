"use server";

import { adminDb } from "@/lib/firebase/admin";
import { revalidatePath } from "next/cache";
import type { AttractionsSettingsDocument } from "@/types/firestore";
import { FieldValue } from "firebase-admin/firestore";

const SETTINGS_COLLECTION = "bduck_settings";
const ATTRACTIONS_DOC = "attractions";

/**
 * Fetch the global attractions gallery images.
 * This is safe to call from Server Components.
 */
export async function getAttractionsGallery(): Promise<string[]> {
  try {
    const docRef = adminDb.collection(SETTINGS_COLLECTION).doc(ATTRACTIONS_DOC);
    const snap = await docRef.get();
    
    if (!snap.exists) {
      return [];
    }

    const data = snap.data() as AttractionsSettingsDocument;
    return data.images || [];
  } catch (error) {
    console.error("Failed to fetch custom attraction gallery:", error);
    return [];
  }
}

/**
 * Update the attractions gallery images (Admin only).
 * Requires adminUid for basic authorization (assumes caller verified `verifyAdmin()`).
 */
export async function updateAttractionsGallery(images: string[], adminUid: string) {
  try {
    const docRef = adminDb.collection(SETTINGS_COLLECTION).doc(ATTRACTIONS_DOC);
    
    // Using object spread and explicit FieldValue.serverTimestamp() from firebase-admin
    await docRef.set({
      images,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: adminUid,
    }, { merge: true });

    // Revalidate the homepage so the new gallery appears immediately
    revalidatePath("/", "layout");
    
    return { success: true };
  } catch (error: any) {
    console.error("Failed to update attractions gallery:", error);
    return { success: false, error: error.message };
  }
}
