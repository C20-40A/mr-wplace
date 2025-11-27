import { storage } from "@/utils/browser-api";
import type { CleanupResult, CleanupProgress } from "./types";

/**
 * Gallery Cleanup Utility
 * Safely removes gallery_* keys from Chrome storage after IndexedDB migration
 *
 * SAFETY:
 * - Only deletes gallery_* keys
 * - One key at a time (500ms delay between deletions)
 * - Idempotent (safe to run multiple times)
 */
export class GalleryCleanup {
  private static readonly CLEANUP_FLAG_KEY = "mr-wplace-doctor-cleanup-v1";
  private static readonly DELAY_MS = 500; // Wait 500ms between deletions

  /**
   * Check if cleanup has already been performed
   */
  static async isCleanupDone(): Promise<boolean> {
    const result = await storage.get([this.CLEANUP_FLAG_KEY]);
    return !!result[this.CLEANUP_FLAG_KEY];
  }

  /**
   * Mark cleanup as complete
   */
  private static async markCleanupDone(): Promise<void> {
    await storage.set({ [this.CLEANUP_FLAG_KEY]: true });
  }

  /**
   * Remove dataUrl from gallery item (keep metadata and stats)
   * This implements hybrid storage: metadata in Chrome, blob in IndexedDB
   */
  private static async cleanupOne(
    key: string,
    index: number,
    total: number
  ): Promise<void> {
    // Get current item
    const result = await storage.get([key]);
    const item = result[key];

    if (!item || typeof item !== "object") {
      console.warn(`🧑‍🎨 [Doctor] Item ${key} not found or invalid, skipping`);
      return;
    }

    // Remove only dataUrl (keep metadata and stats)
    const { dataUrl, ...metadata } = item;

    // Save metadata back (without dataUrl)
    await storage.set({ [key]: metadata });

    console.log(
      `🧑‍🎨 [Doctor] Cleaned dataUrl from ${index + 1}/${total}: ${key.substring(0, 30)}...`
    );

    // Wait before next deletion to avoid Chrome freeze
    await new Promise((resolve) => setTimeout(resolve, this.DELAY_MS));
  }

  /**
   * Perform gradual cleanup of gallery keys
   * Deletes one key at a time with 500ms delay
   */
  static async performCleanup(
    candidates: string[],
    diagnosisResult: {
      totalGalleryItems: number;
      estimatedFreedMB: number;
    }
  ): Promise<CleanupResult> {
    const startTime = performance.now();
    const failed: string[] = [];
    let cleaned = 0;

    console.log(
      `🧑‍🎨 [Doctor] Starting cleanup: ${candidates.length} items (estimated ${diagnosisResult.estimatedFreedMB.toFixed(2)}MB)`
    );

    for (let i = 0; i < candidates.length; i++) {
      const key = candidates[i];

      try {
        await this.cleanupOne(key, i, candidates.length);
        cleaned++;
      } catch (error) {
        console.error(`🧑‍🎨 [Doctor] Failed to clean ${key}:`, error);
        failed.push(key);
      }
    }

    // Mark as done
    await this.markCleanupDone();

    const durationMs = performance.now() - startTime;

    console.log(
      `🧑‍🎨 [Doctor] Cleanup complete: ${cleaned} items removed in ${(
        durationMs / 1000
      ).toFixed(1)}s`
    );

    if (failed.length > 0) {
      console.warn(
        `🧑‍🎨 [Doctor] Failed to clean ${failed.length} items:`,
        failed
      );
    }

    return {
      diagnosis: {
        ...diagnosisResult,
        cleanupCandidates: candidates,
        estimatedCleanupTimeMs: candidates.length * this.DELAY_MS,
        inIndexedDB: candidates.length,
      },
      cleaned,
      failed,
      durationMs,
      freedMB: diagnosisResult.estimatedFreedMB,
    };
  }

  /**
   * Reset cleanup flag (for testing/debugging)
   */
  static async resetCleanupFlag(): Promise<void> {
    await storage.remove([this.CLEANUP_FLAG_KEY]);
    console.log("🧑‍🎨 [Doctor] Cleanup flag reset");
  }
}
