/**
 * Content ↔ Inject Communication Bridge
 *
 * This module provides functions to request data from the inject context (page context).
 * All functions use postMessage for cross-context communication with request/response pattern.
 */

let requestIdCounter = 0;
const generateRequestId = (): string => `req_${Date.now()}_${++requestIdCounter}`;

/**
 * Request aggregated color stats from inject side
 * Used by: paint-stats, color-filter
 *
 * @param imageKeys - Array of image keys to get stats for
 * @returns Promise resolving to color stats (RGB key → matched/total counts)
 */
export const getAggregatedColorStats = async (
  imageKeys: string[]
): Promise<Record<string, { matched: number; total: number }>> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-stats" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    // Send request to inject
    window.postMessage(
      {
        source: "mr-wplace-request-stats",
        imageKeys,
        requestId,
      },
      "*"
    );

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Stats request timed out");
      resolve({});
    }, 5000);
  });
};

/**
 * Request overlay pixel color from inject side
 * Used by: auto-spoit (pixel color detection)
 *
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns Promise resolving to RGBA color or null if no overlay at position
 */
export const getOverlayPixelColor = async (
  lat: number,
  lng: number
): Promise<{ r: number; g: number; b: number; a: number } | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-pixel-color" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.color);
      }
    };

    window.addEventListener("message", handler);

    // Send request to inject
    window.postMessage(
      {
        source: "mr-wplace-request-pixel-color",
        lat,
        lng,
        requestId,
      },
      "*"
    );

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Pixel color request timed out");
      resolve(null);
    }, 5000);
  });
};

/**
 * Request per-tile color stats from inject side
 * Returns statistics organized by image key and tile key
 *
 * @returns Promise resolving to nested stats structure
 */
export const getPerTileColorStatsAll = async (): Promise<
  Record<string, Record<string, { matched: Record<string, number>; total: Record<string, number> }>>
> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-tile-stats" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    // Send request to inject
    window.postMessage(
      {
        source: "mr-wplace-request-tile-stats",
        requestId,
      },
      "*"
    );

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Tile stats request timed out");
      resolve({});
    }, 5000);
  });
};

/**
 * Request per-image aggregated stats from inject side
 * Used by: gallery list (progress bars)
 *
 * @param imageKeys - Array of image keys to get stats for
 * @returns Promise resolving to stats per image (image key → color stats)
 */
export const getStatsPerImage = async (
  imageKeys: string[]
): Promise<Record<string, { matched: Record<string, number>; total: Record<string, number> }>> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-image-stats" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    // Send request to inject
    window.postMessage(
      {
        source: "mr-wplace-request-image-stats",
        imageKeys,
        requestId,
      },
      "*"
    );

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Image stats request timed out");
      resolve({});
    }, 5000);
  });
};

/**
 * Send active snapshot draw states to inject side for overlay rendering
 * Used by: time-travel feature
 *
 * Note: Only sends draw state info (snapshotId, tileX, tileY).
 * Inject side loads actual snapshot data from IndexedDB.
 */
export const sendSnapshotsToInject = async () => {
  const { TimeTravelStorage } = await import("@/features/time-travel/storage");

  const drawStates = await TimeTravelStorage.getDrawStates();
  const enabledStates = drawStates.filter((s) => s.drawEnabled);

  // Send only draw state info - inject will load from IndexedDB
  const snapshotDrawStates = enabledStates.map((state) => ({
    snapshotId: state.fullKey.replace("tile_snapshot_", ""),
    key: `snapshot_${state.fullKey}`,
    tileX: state.tileX,
    tileY: state.tileY,
  }));

  console.log(
    `🧑‍🎨 : Sending ${snapshotDrawStates.length} snapshot draw states to inject side`
  );

  window.postMessage(
    {
      source: "mr-wplace-snapshots",
      snapshotDrawStates,
    },
    "*"
  );
};
