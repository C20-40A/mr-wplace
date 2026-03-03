import {
  getAggregatedColorStats,
  getStatsPerImage,
  getOverlayPixelColor,
  perTileColorStats,
  getOriginalBlob,
  setOriginalBlob,
} from "../features/tile-draw";
import { computeTotalStatsFromImage } from "../features/tile-draw";

const TILE_FETCH_TIMEOUT_MS = 5000;

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const fetchOriginalTileBlob = async (
  tileX: number,
  tileY: number,
): Promise<Blob | null> => {
  const urls = [
    `https://backend.wplace.live/tile/${tileX}/${tileY}.png`,
    `https://backend.wplace.live/tiles/${tileX}/${tileY}.png`,
    `https://backend.wplace.live/files/s0/tiles/${tileX}/${tileY}.png`,
  ];

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TILE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) continue;

      const blob = await response.blob();
      if (blob.size === 0) continue;

      return blob;
    } catch {
      // Try next endpoint
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
};

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

/**
 * Handle map center request
 */
export const handleMapCenterRequest = (data: { requestId: string }): void => {
  const { getMapInstanceFromWplace } = require("../features/map-instance/get-map-instance");
  const mapInstance = getMapInstanceFromWplace();

  let center = null;
  if (mapInstance) {
    center = mapInstance.getCenter();
  }

  window.postMessage(
    {
      source: "mr-wplace-response-map-center",
      requestId: data.requestId,
      center,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent map center: ${center ? `${center.lat}, ${center.lng}` : "null"} (request: ${data.requestId})`
  );
};

/**
 * Handle original tile image request
 * Returns original tile image as dataUrl from cache, or fetches from backend as fallback.
 */
export const handleOriginalTileRequest = async (data: {
  tileX: number;
  tileY: number;
  requestId: string;
}): Promise<void> => {
  const { tileX, tileY, requestId } = data;
  const cacheKey = `${tileX},${tileY}`;

  try {
    let blob = getOriginalBlob(cacheKey);
    let fromCache = true;

    if (!blob) {
      fromCache = false;
      blob = await fetchOriginalTileBlob(tileX, tileY);
      if (blob) setOriginalBlob(cacheKey, blob);
    }

    const dataUrl = blob ? await blobToDataUrl(blob) : null;

    window.postMessage(
      {
        source: "mr-wplace-response-original-tile",
        requestId,
        dataUrl,
      },
      "*",
    );

    console.log(
      `🧑‍🎨 : Sent original tile (${tileX}, ${tileY}) ${dataUrl ? (fromCache ? "from cache" : "from fetch") : "not found"} (request: ${requestId})`,
    );
  } catch (error) {
    console.error("🧑‍🎨 : Failed to get original tile image:", error);
    window.postMessage(
      {
        source: "mr-wplace-response-original-tile",
        requestId,
        dataUrl: null,
      },
      "*",
    );
  }
};
