/**
 * Content-side wrappers that communicate with inject-side tile-draw
 *
 * Architecture:
 * - All overlay layer management happens in inject side (page context)
 * - Content side communicates via postMessage for read operations (stats, pixel color)
 * - Gallery changes are synced via sendGalleryImagesToInject()
 */

let requestIdCounter = 0;
const generateRequestId = (): string => `req_${Date.now()}_${++requestIdCounter}`;

/**
 * Legacy stub - no-op
 * Actual removal handled by inject side via sendGalleryImagesToInject()
 */
export const removePreparedOverlayImageByKey = async (_imageKey: string): Promise<void> => {
  // No-op: inject side handles this automatically
};

/**
 * Legacy stub - no-op
 * Actual addition handled by inject side via sendGalleryImagesToInject()
 */
export const addImageToOverlayLayers = async (
  _source: any,
  _coords: any,
  _imageKey: string
): Promise<void> => {
  // No-op: inject side handles this automatically
};

/**
 * Request aggregated color stats from inject side
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
 * Returns matched/total counts per image key
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
 * Legacy stubs - no-op
 * These functions are no longer used but kept for backward compatibility
 */
export const getPerTileColorStats = (_imageKey: string): null => null;
export const setPerTileColorStats = (_imageKey: string, _tileStatsMap: any): void => {
  // No-op: stats are managed by inject side
};
export const toggleDrawEnabled = (_imageKey: string): boolean => {
  // No-op: managed by gallery storage
  return false;
};
