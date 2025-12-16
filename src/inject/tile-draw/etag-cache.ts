/**
 * ETag-based tile cache for polling optimization
 * Skips heavy drawing/stats processing when tile and state haven't changed
 */

import {
  getColorFilterState,
  getEnhancedMode,
} from "../states/colorFilterState";
import { overlayLayers } from "./states";

const MAX_CACHE_SIZE = 24;

// ETag mapping: "tileX,tileY" → etag
const etagMap = new Map<string, string>();

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
    etagMap.clear();
    processedBlobCache.clear();
    return true;
  }
  return false;
};

/**
 * Get cached blob if ETag matches
 * @returns Blob if cache hit, null otherwise
 */
export const getCachedBlob = (cacheKey: string, etag: string): Blob | null => {
  const cached = etagMap.get(cacheKey);
  if (cached === etag) {
    return processedBlobCache.get(cacheKey) ?? null;
  }
  return null;
};

/**
 * Save processed blob to cache with LRU eviction
 */
export const setCachedBlob = (
  cacheKey: string,
  etag: string,
  blob: Blob
): void => {
  // LRU: evict oldest if at capacity
  if (etagMap.size >= MAX_CACHE_SIZE && !etagMap.has(cacheKey)) {
    const oldest = etagMap.keys().next().value;
    if (oldest) {
      etagMap.delete(oldest);
      processedBlobCache.delete(oldest);
    }
  }
  etagMap.set(cacheKey, etag);
  processedBlobCache.set(cacheKey, blob);
};
