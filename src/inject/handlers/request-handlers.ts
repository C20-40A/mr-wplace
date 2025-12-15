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
export const handleStatsRequest = (data: {
  imageKeys: string[];
  requestId: string;
}): void => {
  const stats = getAggregatedColorStats(data.imageKeys);

  window.postMessage(
    {
      source: "mr-wplace-response-stats",
      requestId: data.requestId,
      stats,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent stats for ${data.imageKeys.length} images (request: ${data.requestId})`
  );
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

  console.log(
    `🧑‍🎨 : Sent pixel color for (${data.lat}, ${data.lng}) (request: ${data.requestId})`
  );
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
 * Hybrid: Get from memory (overlayLayers) + IndexedDB (statistics store)
 */
export const handleImageStatsRequest = async (data: {
  imageKeys: string[];
  requestId: string;
}): Promise<void> => {
  // Get stats from memory (overlay layers)
  const memoryStats = getStatsPerImage(data.imageKeys);

  // Get stats from IndexedDB for missing keys
  const missingKeys = data.imageKeys.filter((key) => !memoryStats[key]);

  if (missingKeys.length > 0) {
    console.log(
      `🧑‍🎨 : Fetching stats for ${missingKeys.length} images from IndexedDB...`
    );
    const indexedDBStats = await fetchStatsFromIndexedDB(missingKeys);

    // Merge with memory stats
    for (const [key, stats] of Object.entries(indexedDBStats)) {
      memoryStats[key] = stats;
    }
  }

  window.postMessage(
    {
      source: "mr-wplace-response-image-stats",
      requestId: data.requestId,
      stats: memoryStats,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent image stats for ${data.imageKeys.length} images (request: ${data.requestId})`
  );
};

/**
 * Fetch stats from IndexedDB (GalleryRepository v2)
 */
const fetchStatsFromIndexedDB = async (
  imageKeys: string[]
): Promise<
  Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >
> => {
  const result: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  > = {};

  // Try GalleryRepository v2 first (perTileStats in metadata)
  try {
    const { getGalleryRepository } = await import("../db/gallery-repository");
    const repoV2 = getGalleryRepository();

    for (const key of imageKeys) {
      if (result[key]) continue;

      const metadata = await repoV2.getMetadata(key);
      if (metadata?.perTileStats) {
        // Aggregate perTileStats to get total matched and total stats
        const matched: Record<string, number> = {};
        const total: Record<string, number> = {};

        for (const tileStats of Object.values(metadata.perTileStats)) {
          for (const [color, count] of Object.entries(tileStats.matched)) {
            matched[color] = (matched[color] || 0) + count;
          }
          for (const [color, count] of Object.entries(tileStats.total)) {
            total[color] = (total[color] || 0) + count;
          }
        }

        result[key] = { matched, total };
      }
    }
  } catch (error) {
    console.warn(
      "🧑‍🎨 : GalleryRepository v2 not available for stats fetch:",
      error
    );
  }

  console.log(
    `🧑‍🎨 : Fetched stats for ${Object.keys(result).length}/${
      imageKeys.length
    } images from IndexedDB`
  );

  return result;
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

    console.log(
      `🧑‍🎨 : Total stats computed for ${data.imageKey}: ${result.totalPixels} pixels`
    );
  } catch (error) {
    console.error(
      `🧑‍🎨 : Failed to compute total stats for ${data.imageKey}:`,
      error
    );
  }
};
