/**
 * Content-side wrappers that communicate with inject-side tile-draw
 * These functions send requests to inject and wait for responses via postMessage
 */

let requestIdCounter = 0;
const generateRequestId = (): string => `req_${Date.now()}_${++requestIdCounter}`;

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

// Legacy stubs (not used but kept for compatibility)
export const getPerTileColorStats = (imageKey: string): null => null;
export const setPerTileColorStats = (imageKey: string, tileStatsMap: any): void => {};
export const toggleDrawEnabled = (imageKey: string): boolean => false;
