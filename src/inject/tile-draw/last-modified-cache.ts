/**
 * last-modified-based tile cache for polling optimization
 * Skips heavy drawing/stats processing when tile and state haven't changed
 */

import {
  getColorFilterState,
  getEnhancedMode,
} from "../states/colorFilterState";
import { overlayLayers } from "./states";

const MAX_CACHE_SIZE = 24;

// LastModified mapping: "tileX,tileY" → lastModified
const lastModifiedMap = new Map<string, string>();

// Processed Blob cache: "tileX,tileY" → Blob
const processedBlobCache = new Map<string, Blob>();

// State snapshot for change detection
let lastStateVersion = "";

/**
 * Generate state version string from current state
 */
const getStateVersion = (): string => {
  const filter = getColorFilterState();
  const mode = getEnhancedMode();
  const unplaced = window.mrWplaceShowUnplacedOnly ?? false;
  const overlayKeys = overlayLayers
    .map((l) => `${l.imageKey}:${l.drawEnabled}`)
    .join(",");
  return `${filter.isFilterActive}-${JSON.stringify(
    filter.selectedRGBs
  )}-${mode}-${unplaced}-${overlayKeys}`;
};

/**
 * Check if state has changed. Clears cache if changed.
 * @returns true if state changed
 */
export const checkStateChanged = (): boolean => {
  const current = getStateVersion();
  if (current !== lastStateVersion) {
    lastStateVersion = current;
    lastModifiedMap.clear();
    processedBlobCache.clear();
    return true;
  }
  return false;
};

/**
 * Get cached blob if LastModified matches
 * @returns Blob if cache hit, null otherwise
 */
export const getCachedBlob = (
  cacheKey: string,
  lastModified: string
): Blob | null => {
  const cached = lastModifiedMap.get(cacheKey);
  if (cached === lastModified) {
    return processedBlobCache.get(cacheKey) ?? null;
  }
  return null;
};

/**
 * Save processed blob to cache with LRU eviction
 */
export const setCachedBlob = (
  cacheKey: string,
  lastModified: string,
  blob: Blob
): void => {
  // LRU: evict oldest if at capacity
  if (
    lastModifiedMap.size >= MAX_CACHE_SIZE &&
    !lastModifiedMap.has(cacheKey)
  ) {
    const oldest = lastModifiedMap.keys().next().value;
    if (oldest) {
      lastModifiedMap.delete(oldest);
      processedBlobCache.delete(oldest);
    }
  }
  lastModifiedMap.set(cacheKey, lastModified);
  processedBlobCache.set(cacheKey, blob);
};

/**
 * Invalidate cache for a specific tile
 * Used when pixel is painted to force re-processing
 */
export const invalidateTile = (cacheKey: string): void => {
  lastModifiedMap.delete(cacheKey);
  processedBlobCache.delete(cacheKey);
  console.log(`🧑‍🎨 : Invalidated LastModified cache for tile: ${cacheKey}`);
};
