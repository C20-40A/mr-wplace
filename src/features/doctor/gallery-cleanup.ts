import { storage } from "@/utils/browser-api";
import type { CleanupResult, CleanupProgress } from "./types";

/**
 * Gallery Cleanup Utility
 * Safely removes gallery_* keys from Chrome storage after IndexedDB migration
 *
 * SAFETY:
 * - Only deletes gallery_* keys
 * - One key at a time (500ms delay between deletions)
 * - Safe to run multiple times (runs every startup, lightweight diagnosis)
 */
export class GalleryCleanup {
  private static readonly DELAY_MS = 500; // Wait 500ms between deletions

  /**
   * Remove dataUrl from gallery item and generate thumbnail
   * This implements hybrid storage: metadata + thumbnail in Chrome, blob in IndexedDB
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

    // Generate thumbnail if not exists
    if (!item.thumbnail) {
      const thumbnail = await this.generateThumbnail(key);
      if (thumbnail) {
        item.thumbnail = thumbnail;
        console.log(
          `🧑‍🎨 [Doctor] Generated thumbnail for ${index + 1}/${total}: ${key.substring(0, 30)}...`
        );
      }
    }

    // Remove only dataUrl (keep metadata, stats, and thumbnail)
    const { dataUrl, ...metadata } = item;

    // Save metadata back (without dataUrl)
    await storage.set({ [key]: metadata });

    // Mark as cleaned in index
    await this.markAsCleaned(key);

    console.log(
      `🧑‍🎨 [Doctor] Cleaned dataUrl from ${index + 1}/${total}: ${key.substring(0, 30)}...`
    );

    // Wait before next deletion to avoid Chrome freeze
    await new Promise((resolve) => setTimeout(resolve, this.DELAY_MS));
  }

  /**
   * Mark item as cleaned in gallery_index
   */
  private static async markAsCleaned(key: string): Promise<void> {
    const result = await storage.get(["gallery_index"]);
    const index = result["gallery_index"];

    if (!index || !index.items) {
      console.warn(`🧑‍🎨 [Doctor] Index not found, cannot mark as cleaned`);
      return;
    }

    const item = index.items.find((i: { key: string }) => i.key === key);
    if (item) {
      item.cleaned = true;
      index.lastUpdated = Date.now();
      await storage.set({ gallery_index: index });
    }
  }

  /**
   * Generate thumbnail via inject context
   */
  private static async generateThumbnail(key: string): Promise<string | null> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data.source === "mr-wplace-thumbnail-response" &&
          event.data.key === key
        ) {
          window.removeEventListener("message", handler);
          resolve(event.data.thumbnail);
        }
      };

      window.addEventListener("message", handler);

      // Send thumbnail request to inject
      window.postMessage(
        {
          source: "mr-wplace-thumbnail-request",
          key,
        },
        "*"
      );

      // Timeout after 5s
      setTimeout(() => {
        window.removeEventListener("message", handler);
        console.warn(`🧑‍🎨 [Doctor] Thumbnail generation timeout for ${key}`);
        resolve(null);
      }, 5000);
    });
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
}
