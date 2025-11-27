import { StorageDoctor } from "./storage-doctor";
import { GalleryCleanup } from "./gallery-cleanup";
import type { DiagnosisResult, CleanupResult } from "./types";

/**
 * Doctor Feature - Storage Health Diagnostics and Repair
 *
 * Safely cleans up gallery_* keys from Chrome storage after IndexedDB migration.
 *
 * Usage:
 *   // Diagnosis only (safe, read-only)
 *   const diagnosis = await doctorAPI.diagnose();
 *
 *   // Diagnosis + Cleanup (slow, but safe)
 *   const result = await doctorAPI.checkAndCleanup();
 */
export const doctorAPI = {
  /**
   * Diagnose storage health (read-only, safe)
   * Returns cleanup candidates without deleting anything
   */
  async diagnose(): Promise<DiagnosisResult> {
    return await StorageDoctor.diagnose();
  },

  /**
   * Diagnose and cleanup (if needed)
   * Deletes gallery_* keys from Chrome storage one by one
   *
   * SAFETY:
   * - Only runs once (idempotent)
   * - 500ms delay between deletions
   * - Only deletes gallery_* keys
   */
  async checkAndCleanup(): Promise<CleanupResult | null> {
    // Check if already cleaned
    if (await GalleryCleanup.isCleanupDone()) {
      console.log("🧑‍🎨 [Doctor] Cleanup already done, skipping");
      return null;
    }

    // Perform diagnosis
    const diagnosis = await StorageDoctor.diagnose();

    // No cleanup needed
    if (diagnosis.cleanupCandidates.length === 0) {
      console.log("🧑‍🎨 [Doctor] No cleanup needed");
      return null;
    }

    // Perform cleanup
    const result = await GalleryCleanup.performCleanup(diagnosis.cleanupCandidates, {
      totalGalleryItems: diagnosis.totalGalleryItems,
      estimatedFreedMB: diagnosis.estimatedFreedMB,
    });

    return result;
  },

  /**
   * Reset cleanup flag (for testing/debugging)
   */
  async resetCleanupFlag(): Promise<void> {
    await GalleryCleanup.resetCleanupFlag();
  },
};
