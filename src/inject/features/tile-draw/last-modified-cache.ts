/**
 * last-modified-based tile cache for polling optimization
 * Skips heavy drawing/stats processing when tile and state haven't changed
 */

import {
  getColorFilterState,
  getEnhancedMode,
  getEnhancedColor,
} from "../../states/colorFilterState";
import { overlayLayers } from "./states";

const MAX_CACHE_SIZE = 24;

// LastModified mapping: "tileX,tileY" → lastModified
const lastModifiedMap = new Map<string, string>();

// Processed Blob cache: "tileX,tileY" → Blob
const processedBlobCache = new Map<string, Blob>();

// Original (unprocessed) tile Blob cache: "tileX,tileY" → Blob
const originalBlobCache = new Map<string, Blob>();
// Original tile Last-Modified cache: "tileX,tileY" → Last-Modified
const originalLastModifiedCache = new Map<string, string>();

// State snapshot for change detection
let lastStateVersion = "";

/**
 * Generate state version string from current state
 */
const getStateVersion = (): string => {
  const filter = getColorFilterState();
  const mode = getEnhancedMode();
  const eColor = getEnhancedColor();
  const unplaced = window.mrWplaceShowUnplacedOnly ?? false;
  const unplacedColor = filter.showUnplacedColor;
  const overlayKeys = overlayLayers
    .map((l) => `${l.imageKey}:${l.drawEnabled}:${l.coords.join(",")}`)
    .join("|");
  return `${filter.isFilterActive}-${JSON.stringify(
    filter.selectedRGBs
  )}-${mode}-${eColor.join(",")}-${unplaced}-${unplacedColor.join(",")}-${overlayKeys}`;
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
  originalBlobCache.delete(cacheKey);
  originalLastModifiedCache.delete(cacheKey);
  console.log(`🧑‍🎨 : Invalidated LastModified cache for tile: ${cacheKey}`);
};

/**
 * Get original (unprocessed) tile blob from cache
 */
export const getOriginalBlob = (cacheKey: string): Blob | null =>
  originalBlobCache.get(cacheKey) ?? null;

export const getOriginalBlobKeys = (): string[] => [...originalBlobCache.keys()];

/**
 * Save original tile blob to cache (LRU)
 */
export const setOriginalBlob = (cacheKey: string, blob: Blob): void => {
  if (originalBlobCache.size >= MAX_CACHE_SIZE && !originalBlobCache.has(cacheKey)) {
    const oldest = originalBlobCache.keys().next().value;
    if (oldest) originalBlobCache.delete(oldest);
  }
  originalBlobCache.set(cacheKey, blob);
};

/**
 * Get original tile last-modified from cache
 */
export const getOriginalLastModified = (cacheKey: string): string | null =>
  originalLastModifiedCache.get(cacheKey) ?? null;

/**
 * Save original tile last-modified to cache (LRU)
 */
export const setOriginalLastModified = (
  cacheKey: string,
  lastModified: string | null,
): void => {
  if (!lastModified) {
    originalLastModifiedCache.delete(cacheKey);
    return;
  }

  if (
    originalLastModifiedCache.size >= MAX_CACHE_SIZE &&
    !originalLastModifiedCache.has(cacheKey)
  ) {
    const oldest = originalLastModifiedCache.keys().next().value;
    if (oldest) originalLastModifiedCache.delete(oldest);
  }

  originalLastModifiedCache.set(cacheKey, lastModified);
};
