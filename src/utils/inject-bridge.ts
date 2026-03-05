/**
 * Content ↔ Inject Communication Bridge
 *
 * This module provides functions to request data from the inject context (page context).
 * All functions use postMessage for cross-context communication with request/response pattern.
 */
import { withDangerousMessageAuth } from "@/core/bridge/inject-message-auth";

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
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-stats" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-stats",
        imageKeys,
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
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
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-pixel-color" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.color);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-pixel-color",
        lat,
        lng,
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
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
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-tile-stats" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-tile-stats",
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
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
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-image-stats" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-image-stats",
        imageKeys,
        requestId,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
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

/**
 * Toggle tmp tile snapshot capture in inject context
 * Used by: time-travel modal open/close
 */
export const sendSnapshotCaptureToInject = (enabled: boolean): void => {
  window.postMessage(
    {
      source: "mr-wplace-snapshot-capture-update",
      enabled,
    },
    "*"
  );
};

// ============================================
// Snapshot Repository Bridge Functions
// ============================================

export interface SnapshotMetadata {
  id: string;
  timestamp: number;
  tileX: number;
  tileY: number;
  name?: string;
}

/**
 * Get all snapshot metadata from inject side IndexedDB
 */
export const getAllSnapshotMetadata = async (): Promise<SnapshotMetadata[]> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-get-all-metadata-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result || []);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: "mr-wplace-snapshot-get-all-metadata", requestId }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get all snapshot metadata timed out");
      resolve([]);
    }, 5000);
  });
};

/**
 * Get snapshot metadata by tile coordinates
 */
export const getSnapshotMetadataByTile = async (
  tileX: number,
  tileY: number
): Promise<SnapshotMetadata[]> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-get-metadata-by-tile-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result || []);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      { source: "mr-wplace-snapshot-get-metadata-by-tile", requestId, tileX, tileY },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get snapshot metadata by tile timed out");
      resolve([]);
    }, 5000);
  });
};

/**
 * Get snapshot blob as dataUrl
 */
export const getSnapshotDataUrl = async (id: string): Promise<string | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-get-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result || null);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: "mr-wplace-snapshot-get", requestId, id }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get snapshot timed out");
      resolve(null);
    }, 5000);
  });
};

/**
 * Save snapshot with metadata to inject side IndexedDB
 */
export const saveSnapshotToInject = async (
  id: string,
  dataUrl: string,
  metadata: SnapshotMetadata
): Promise<boolean> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-save-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result === true);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      { source: "mr-wplace-snapshot-save", requestId, id, dataUrl, metadata },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Save snapshot timed out");
      resolve(false);
    }, 10000);
  });
};

/**
 * Delete snapshot with metadata from inject side IndexedDB
 */
export const deleteSnapshotFromInject = async (id: string): Promise<boolean> => {
  const requestId = generateRequestId();
  const payload = await withDangerousMessageAuth({
    source: "mr-wplace-snapshot-delete",
    requestId,
    id,
  });

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-snapshot-delete-response" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.result === true);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(payload, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Delete snapshot timed out");
      resolve(false);
    }, 5000);
  });
};

/**
 * Get original tile image as dataUrl from inject side
 * Uses in-memory cache first and backend fetch as fallback
 */
export const getOriginalTileDataUrl = async (
  tileX: number,
  tileY: number
): Promise<string | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-original-tile" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.dataUrl || null);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        source: "mr-wplace-request-original-tile",
        requestId,
        tileX,
        tileY,
      },
      "*"
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Get original tile timed out");
      resolve(null);
    }, 7000);
  });
};

/**
 * Get map center coordinates from inject side
 * Returns null if map instance is not available
 */
export const getMapCenter = async (): Promise<{ lat: number; lng: number } | null> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-map-center" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve(event.data.center);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage({ source: "mr-wplace-request-map-center", requestId }, "*");

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Map center request timed out");
      resolve(null);
    }, 5000);
  });
};

type ScreenPoint = { x: number; y: number };
type MapPixelPoint = { pixelX: number; pixelY: number };

/**
 * Project viewport client points to wplace pixel coordinates via inject map instance
 */
export const projectScreenPointsToMapPixels = async (
  points: ScreenPoint[],
): Promise<MapPixelPoint[]> => {
  if (!points.length) return [];
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-map-pixels-from-screen" &&
        event.data.requestId === requestId
      ) {
        clearTimeout(timeoutId);
        window.removeEventListener("message", handler);
        resolve((event.data.points || []) as MapPixelPoint[]);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      {
        source: "mr-wplace-request-map-pixels-from-screen",
        requestId,
        points,
      },
      "*",
    );

    timeoutId = setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn("🧑‍🎨 : Screen point projection request timed out");
      resolve([]);
    }, 5000);
  });
};
