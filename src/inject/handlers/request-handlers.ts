import {
  getAggregatedColorStats,
  getStatsPerImage,
  getOverlayPixelColor,
  perTileColorStats,
} from "../tile-draw";
import { computeTotalStatsFromImage } from "../tile-draw/stats/compute-total";

/**
 * Handle aggregated color stats request
 */
export const handleStatsRequest = (data: { imageKeys: string[]; requestId: string }): void => {
  const stats = getAggregatedColorStats(data.imageKeys);

  window.postMessage(
    {
      source: "mr-wplace-response-stats",
      requestId: data.requestId,
      stats,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent stats for ${data.imageKeys.length} images (request: ${data.requestId})`);
};

/**
 * Handle overlay pixel color request
 */
export const handlePixelColorRequest = async (data: {
  lat: number;
  lng: number;
  requestId: string;
}): Promise<void> => {
  const color = await getOverlayPixelColor(data.lat, data.lng);

  window.postMessage(
    {
      source: "mr-wplace-response-pixel-color",
      requestId: data.requestId,
      color,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent pixel color for (${data.lat}, ${data.lng}) (request: ${data.requestId})`);
};

/**
 * Handle per-tile color stats request
 */
export const handleTileStatsRequest = (data: { requestId: string }): void => {
  // Convert Map to serializable object
  const statsObject: Record<string, any> = {};

  for (const [imageKey, tileStatsMap] of perTileColorStats.entries()) {
    const tileStats: Record<string, any> = {};

    for (const [tileKey, stats] of tileStatsMap.entries()) {
      tileStats[tileKey] = {
        matched: Object.fromEntries(stats.matched),
        total: Object.fromEntries(stats.total),
      };
    }

    statsObject[imageKey] = tileStats;
  }

  window.postMessage(
    {
      source: "mr-wplace-response-tile-stats",
      requestId: data.requestId,
      stats: statsObject,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent tile stats (request: ${data.requestId})`);
};

/**
 * Handle image stats request (per-image aggregated stats)
 */
export const handleImageStatsRequest = (data: { imageKeys: string[]; requestId: string }): void => {
  const stats = getStatsPerImage(data.imageKeys);

  window.postMessage(
    {
      source: "mr-wplace-response-image-stats",
      requestId: data.requestId,
      stats,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent image stats for ${data.imageKeys.length} images (request: ${data.requestId})`);
};

/**
 * Handle compute total stats request (position-independent)
 * Compute total stats from image dataUrl without position information
 */
export const handleComputeTotalStats = async (data: {
  imageKey: string;
  dataUrl: string;
}): Promise<void> => {
  try {
    console.log(`🧑‍🎨 : Computing total stats for ${data.imageKey}`);
    const result = await computeTotalStatsFromImage(data.dataUrl);

    // Send result back to content side
    window.postMessage(
      {
        source: "mr-wplace-total-stats-computed",
        imageKey: data.imageKey,
        totalColorStats: result.total,
        totalPixels: result.totalPixels,
      },
      "*"
    );

    console.log(`🧑‍🎨 : Total stats computed for ${data.imageKey}: ${result.totalPixels} pixels`);
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to compute total stats for ${data.imageKey}:`, error);
  }
};
