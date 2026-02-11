import {
  drawOverlayLayersOnTile,
  checkStateChanged,
  getCachedBlob,
  setCachedBlob,
  invalidateTile,
  setOriginalBlob,
} from "./features/tile-draw";
import { invalidateTileCache } from "./cache-storage";
import { handleUserStatusUpdate } from "./handlers/user-status-handler";
import { WplaceUserData } from "./types";
import {
  isFrontLayerTileRequest,
  handleFrontLayerTileRequest,
} from "./features/map-instance/front-tile-layer/fetch-handler";

/**
 * Setup fetch interceptor to handle tile requests and user data
 * CRITICAL: Must be called synchronously to catch early /me requests
 */
export const setupFetchInterceptor = (): void => {
  const originalFetch = window.fetch;

  window.fetch = async function (...args): Promise<Response> {
    const requestInfo = args[0];
    const url =
      typeof requestInfo === "string"
        ? requestInfo
        : requestInfo instanceof Request
        ? requestInfo.url
        : requestInfo.toString();

    // Intercept custom protocol tile requests for front layer
    if (url && isFrontLayerTileRequest(url)) {
      return handleFrontLayerTileRequest(url);
    }

    // Block Sentry requests to avoid sending extension bugs to WPlace's Sentry
    if (url && (url.includes("sentry.io") || url.includes("sentry"))) {
      console.log("🧑‍🎨: Blocked Sentry request:", url);
      // Return empty successful response to avoid errors
      return new Response(null, {
        status: 200,
        statusText: "OK (Blocked by Mr. Wplace)",
        headers: new Headers({ "Content-Type": "application/json" }),
      });
    }

    if (!url || !url.includes("backend.wplace.live")) {
      return originalFetch.apply(this, args);
    }

    // Intercept /me endpoint for user data
    // IMPORTANT: Match only "/me" or "/me?" to avoid catching "/me/frames" etc.
    if (url.match(/\/me(\?|$)/)) {
      console.log("🧑‍🎨: Intercepting /me endpoint:", url);
      const response = await originalFetch.apply(this, args);
      const clonedResponse = response.clone();

      try {
        const jsonData: WplaceUserData = await clonedResponse.json();
        // console.log("🧑‍🎨: Parsed json:", jsonData);

        // Handle user status directly in inject context
        handleUserStatusUpdate(jsonData);
      } catch (error) {
        console.error("🧑‍🎨: Failed to parse /me response:", error);
      }

      return response;
    }

    // Intercept pixel info GET requests (for "Painted by" data)
    // URL pattern: https://backend.wplace.live/s0/pixel/<tileX>/<tileY>?x=<x>&y=<y>
    if (url.includes("/pixel/") && url.includes("?x=") && url.includes("&y=")) {
      console.log("🧑‍🎨: Intercepting pixel info GET:", url);
      const response = await originalFetch.apply(this, args);
      const clonedResponse = response.clone();

      try {
        const jsonData = await clonedResponse.json();
        console.log("🧑‍🎨: Pixel info data:", jsonData);

        // Send painted by user data to content script
        if (jsonData.paintedBy) {
          const userData = {
            id: jsonData.paintedBy.id,
            name: jsonData.paintedBy.name,
            allianceId: jsonData.paintedBy.allianceId,
            allianceName: jsonData.paintedBy.allianceName,
            equippedFlag: jsonData.paintedBy.equippedFlag,
            picture: jsonData.paintedBy.picture,
          };
          window.postMessage(
            {
              source: "mr-wplace-painted-by-user",
              userData,
            },
            "*"
          );
          console.log(
            "🧑‍🎨: Sent paintedBy user data to content script:",
            userData
          );
        }
      } catch (error) {
        console.error("🧑‍🎨: Failed to parse pixel info response:", error);
      }

      return response;
    }

    // Intercept pixel paint POST to invalidate cache
    // URL pattern: https://backend.wplace.live/s0/pixel/<tileX>/<tileY>
    if (url.includes("/s0/pixel/")) {
      const requestInfo = args[0];
      const method =
        typeof requestInfo === "string"
          ? args[1]?.method
          : requestInfo instanceof Request
          ? requestInfo.method
          : undefined;

      if (method === "POST") {
        const pixelMatch = url.match(/\/s0\/pixel\/(\d+)\/(\d+)/);
        if (pixelMatch) {
          const tileX = parseInt(pixelMatch[1], 10);
          const tileY = parseInt(pixelMatch[2], 10);
          const cacheKey = `${tileX},${tileY}`;

          console.log("🧑‍🎨: Detected pixel paint POST:", cacheKey);

          // Execute the original fetch first
          const response = await originalFetch.apply(this, args);

          // Invalidate both LastModified cache and IndexedDB cache
          invalidateTile(cacheKey);
          invalidateTileCache(cacheKey).catch((error) => {
            console.warn("🧑‍🎨: Failed to invalidate tile cache:", error);
          });

          return response;
        }
      }
    }

    // Intercept all tile requests
    if (url.includes("tiles/") && url.endsWith(".png")) {
      return handleTileRequest(originalFetch, args, url);
    }

    return originalFetch.apply(this, args);
  };
};

/**
 * Handle tile request interception
 *
 * NEW APPROACH (Firefox-compatible):
 * Process tiles directly in inject (page context) using Canvas API
 * This avoids Firefox extension context ImageBitmap security issues
 *
 * Caching Strategy:
 * 1. LastModified cache (memory): Skip processing if LastModified and state unchanged
 * 2. data saver cache (IndexedDB): Persistent cache for processed tiles
 */
const handleTileRequest = async (
  originalFetch: typeof fetch,
  args: Parameters<typeof fetch>,
  url: string
): Promise<Response> => {
  // Extract tileX, tileY from URL
  const tileMatch = url.match(/tiles\/(\d+)\/(\d+)\.png/);
  if (!tileMatch) {
    return originalFetch.apply(window, args);
  }

  const tileX = parseInt(tileMatch[1], 10);
  const tileY = parseInt(tileMatch[2], 10);
  const cacheKey = `${tileX},${tileY}`;
  const dataSaver = window.mrWplaceDataSaver;

  // Check memory cache first (data saver)
  let cacheExists = dataSaver?.tileCache.has(cacheKey) ?? false;
  let cachedBlob: Blob | null = null;

  // If not in memory, check IndexedDB
  if (!cacheExists && dataSaver?.tileCacheDB) {
    try {
      cachedBlob = await dataSaver.tileCacheDB.getCachedTile(cacheKey);
      if (cachedBlob) {
        // Load into memory cache for faster access
        dataSaver.tileCache.set(cacheKey, cachedBlob);
        cacheExists = true;
      }
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to load from IndexedDB:", error);
    }
  } else if (cacheExists) {
    cachedBlob = dataSaver!.tileCache.get(cacheKey)!;
  }

  // data saver ON + cache exists -> Return cached processed tile
  if (dataSaver?.enabled && cacheExists && cachedBlob) {
    return new Response(cachedBlob, {
      status: 200,
      statusText: "OK (Cached Processed)",
      headers: new Headers({ "Content-Type": "image/png" }),
    });
  }

  // Fetch original tile from network
  const response = await originalFetch.apply(window, args);

  // Check state change (clears LastModified cache if changed)
  checkStateChanged();

  // LastModified cache check
  const lastModified = response.headers.get("last-modified");
  if (lastModified) {
    const lastModifiedCachedBlob = getCachedBlob(cacheKey, lastModified);
    if (lastModifiedCachedBlob) {
      console.log(
        `🧑‍🎨 : LastModified cache hit for tile (${tileX},${tileY}), skipping processing`
      );
      return new Response(lastModifiedCachedBlob, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });
    }
  }

  const clonedResponse = response.clone();
  const originalTileBlob = await clonedResponse.blob();

  // Cache original tile for background pixel checks (area fill, etc.)
  setOriginalBlob(cacheKey, originalTileBlob);

  // Save snapshot for time travel feature
  window.postMessage(
    {
      source: "wplace-studio-snapshot",
      tileBlob: originalTileBlob,
      tileX: tileX,
      tileY: tileY,
    },
    "*"
  );

  // When front tile layer is enabled, skip overlay compositing on background tiles.
  // Overlays are rendered on the independent front layer instead.
  if (window.mrWplaceFrontTileLayerEnabled) {
    window.postMessage(
      { source: "wplace-studio-drawing-complete", tileX, tileY },
      "*"
    );
    return new Response(originalTileBlob, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  // Determine if we should cache the processed result
  const shouldCacheProcessed =
    dataSaver?.enabled || // Case 3: data saver ON (always cache)
    (dataSaver && cacheExists); // Case 2: data saver OFF but cache key exists

  // Process tile with overlays in inject (page context)
  let processedBlob: Blob;

  const computeDevice = window.mrWplaceComputeDevice || "gpu";

  try {
    processedBlob = await drawOverlayLayersOnTile(
      originalTileBlob,
      [tileX, tileY],
      computeDevice
    );
  } catch (error) {
    console.error(
      `🧑‍🎨 : Tile processing failed for (${tileX},${tileY}), returning original tile:`,
      error
    );
    // Fallback: return original tile
    processedBlob = originalTileBlob;
  }

  // Cache the processed tile if needed
  if (shouldCacheProcessed && dataSaver) {
    // Save to memory cache
    dataSaver.tileCache.set(cacheKey, processedBlob);

    // Save to IndexedDB for persistence
    if (dataSaver.tileCacheDB) {
      try {
        await dataSaver.tileCacheDB.setCachedTile(
          cacheKey,
          processedBlob,
          dataSaver.maxCacheSize
        );
        console.log("🧑‍🎨 : Cached processed tile to IndexedDB:", cacheKey);
      } catch (error) {
        console.warn("🧑‍🎨 : Failed to cache to IndexedDB:", error);
      }
    }
  }

  // Notify that tile fetch is complete (hide drawing loader)
  window.postMessage(
    {
      source: "wplace-studio-drawing-complete",
      tileX,
      tileY,
    },
    "*"
  );

  // Save to LastModified cache
  if (lastModified) {
    setCachedBlob(cacheKey, lastModified, processedBlob);
  }

  return new Response(processedBlob, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
};
