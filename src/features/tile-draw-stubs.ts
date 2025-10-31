/**
 * Stubs for tile-draw functions that are now handled by inject side
 * These functions are kept for backward compatibility but do nothing
 * as the actual processing happens in inject context
 */

import type { ColorStats } from "./tile-draw/types";

export const removePreparedOverlayImageByKey = async (imageKey: string): Promise<void> => {
  console.log(`🧑‍🎨 : removePreparedOverlayImageByKey stub called for ${imageKey}`);
  // Actual removal handled by inject side via sendGalleryImagesToInject
};

export const addImageToOverlayLayers = async (
  source: any,
  coords: any,
  imageKey: string
): Promise<void> => {
  console.log(`🧑‍🎨 : addImageToOverlayLayers stub called for ${imageKey}`);
  // Actual addition handled by inject side via sendGalleryImagesToInject
};

export const getAggregatedColorStats = (
  imageKeys: string[]
): Record<string, { matched: number; total: number }> => {
  console.log(`🧑‍🎨 : getAggregatedColorStats stub called for ${imageKeys.length} images`);
  // TODO: Implement inject-side communication for color stats
  return {};
};

export const getPerTileColorStats = (
  imageKey: string
): Map<string, ColorStats> | null => {
  console.log(`🧑‍🎨 : getPerTileColorStats stub called for ${imageKey}`);
  return null;
};

export const setPerTileColorStats = (
  imageKey: string,
  tileStatsMap: Map<string, ColorStats>
): void => {
  console.log(`🧑‍🎨 : setPerTileColorStats stub called for ${imageKey}`);
  // No-op: stats are handled by inject side
};

export const toggleDrawEnabled = (imageKey: string): boolean => {
  console.log(`🧑‍🎨 : toggleDrawEnabled stub called for ${imageKey}`);
  return false;
};

export const getOverlayPixelColor = async (
  lat: number,
  lng: number
): Promise<{ r: number; g: number; b: number; a: number } | null> => {
  console.log("🧑‍🎨 : getOverlayPixelColor stub called - feature temporarily disabled");
  // TODO: Implement inject-side communication for overlay pixel color
  return null;
};
