import { storage } from "@/utils/browser-api";
import type { DiagnosisResult } from "./types";

/**
 * Storage Doctor - Diagnostic Utility
 * Analyzes Chrome storage and IndexedDB to find cleanup candidates
 *
 * SAFETY:
 * - Read-only operations (does not delete anything)
 * - Only checks gallery_* keys
 * - Minimal memory usage (loads keys only, not full data)
 */
export class StorageDoctor {
  /**
   * Get all gallery_* keys from Chrome storage (from gallery_index)
   */
  private static async getAllGalleryKeys(): Promise<string[]> {
    const result = await storage.get(["gallery_index"]);
    const index = result["gallery_index"];

    if (!index || !index.items) {
      return [];
    }

    // Return all keys
    return index.items.map((item: { key: string }) => item.key);
  }

  /**
   * Get gallery_* keys that need cleanup from Chrome storage (from gallery_index)
   * This is ultra-lightweight - only loads the index and checks cleaned flag
   */
  private static async getGalleryKeysNeedingCleanup(): Promise<string[]> {
    const result = await storage.get(["gallery_index"]);
    const index = result["gallery_index"];

    if (!index || !index.items) {
      return [];
    }

    // Return only keys that haven't been cleaned yet (cleaned !== true)
    return index.items
      .filter((item: { key: string; cleaned?: boolean }) => !item.cleaned)
      .map((item: { key: string }) => item.key);
  }

  /**
   * Get detailed gallery information (including drawEnabled status)
   */
  private static async getGalleryDetails(): Promise<{
    total: number;
    drawEnabled: number;
    drawDisabled: number;
  }> {
    const keys = await this.getAllGalleryKeys();

    if (keys.length === 0) {
      return { total: 0, drawEnabled: 0, drawDisabled: 0 };
    }

    // Get all gallery items
    const result = await storage.get(keys);

    let drawEnabled = 0;
    let drawDisabled = 0;

    for (const key of keys) {
      const item = result[key];
      if (item?.drawEnabled && item?.drawPosition) {
        drawEnabled++;
      } else {
        drawDisabled++;
      }
    }

    return {
      total: keys.length,
      drawEnabled,
      drawDisabled,
    };
  }

  /**
   * Check if a gallery item exists in IndexedDB
   * Sends message to inject context to check IndexedDB
   */
  private static async checkIndexedDB(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      const handler = (event: MessageEvent) => {
        if (
          event.data.source === "mr-wplace-doctor-check-idb-response" &&
          event.data.key === key
        ) {
          window.removeEventListener("message", handler);
          resolve(event.data.exists);
        }
      };

      window.addEventListener("message", handler);

      // Send check request to inject
      window.postMessage(
        {
          source: "mr-wplace-doctor-check-idb",
          key,
        },
        "*"
      );

      // Timeout after 5s
      setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(false); // Assume not exists on timeout
      }, 5000);
    });
  }

  /**
   * Find cleanup candidates (items with cleaned !== true in index)
   * Ultra-lightweight - only reads index, no IndexedDB checks needed
   */
  private static async findCleanupCandidates(): Promise<string[]> {
    const candidates = await this.getGalleryKeysNeedingCleanup();

    console.log(
      `🧑‍🎨 [Doctor] Found ${candidates.length} items needing cleanup (checked index only)`
    );

    return candidates;
  }

  /**
   * Estimate storage size to be freed
   * This is approximate based on average item size
   */
  private static async estimateFreedStorage(
    candidates: string[]
  ): Promise<number> {
    if (candidates.length === 0) return 0;

    // Sample first candidate to estimate average size
    const sampleKey = candidates[0];
    const sampleResult = await storage.get([sampleKey]);
    const sampleSize = JSON.stringify(sampleResult[sampleKey]).length;

    // Estimate total size (sample size * count)
    const estimatedBytes = sampleSize * candidates.length;

    return estimatedBytes / 1024 / 1024; // Convert to MB
  }

  /**
   * Perform full diagnosis
   * Returns diagnostic result without deleting anything
   */
  static async diagnose(): Promise<DiagnosisResult> {
    console.log("🧑‍🎨 [Doctor] Starting diagnosis...");

    const startTime = performance.now();

    // Get gallery details
    const details = await this.getGalleryDetails();
    console.log(`🧑‍🎨 [Doctor] Gallery items: ${details.total} total, ${details.drawEnabled} enabled, ${details.drawDisabled} disabled`);

    // Find cleanup candidates
    const candidates = await this.findCleanupCandidates();

    // Estimate freed storage
    const estimatedFreedMB = await this.estimateFreedStorage(candidates);

    // Estimate cleanup time (500ms per item)
    const estimatedCleanupTimeMs = candidates.length * 500;

    const diagnosisTime = performance.now() - startTime;

    console.log(
      `🧑‍🎨 [Doctor] Diagnosis complete in ${(diagnosisTime / 1000).toFixed(
        1
      )}s`
    );
    console.log(
      `🧑‍🎨 [Doctor] Cleanup candidates: ${
        candidates.length
      } items (~${estimatedFreedMB.toFixed(2)}MB)`
    );
    console.log(
      `🧑‍🎨 [Doctor] Estimated cleanup time: ${(
        estimatedCleanupTimeMs / 1000
      ).toFixed(1)}s`
    );

    return {
      totalGalleryItems: candidates.length,
      inIndexedDB: candidates.length,
      cleanupCandidates: candidates,
      estimatedCleanupTimeMs,
      estimatedFreedMB,
    };
  }
}
