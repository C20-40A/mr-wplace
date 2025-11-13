import { drawOverlayLayersOnTile } from "./tile-draw";

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
    if (url.includes("/me")) {
      console.log("🧑‍🎨: Intercepting /me endpoint:", url);
      const response = await originalFetch.apply(this, args);
      const clonedResponse = response.clone();

      try {
        const jsonData = await clonedResponse.json();
        console.log("🧑‍🎨: Parsed json:", jsonData);
        window.postMessage(
          {
            source: "mr-wplace-me",
            userData: jsonData,
          },
          "*"
        );
      } catch (error) {
        console.error("🧑‍🎨: Failed to parse /me response:", error);
      }

      return response;
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
 * Caching Strategy with IndexedDB:
 * 1. data saver OFF / cache key NOT exists -> No caching. Process tile.
 * 2. data saver OFF / cache key exists -> Process tile and cache the processed result.
 * 3. data saver ON / cache key NOT exists -> Fetch, process, and cache the processed result.
 * 4. data saver ON / cache key exists -> Return cached processed tile directly (no fetch/process).
 *
 * Cache storage:
 * - Memory Map: for fast access during session
 * - IndexedDB: for persistent cache across reloads
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

  // Check memory cache first
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

  // Case 4: data saver ON + cache exists -> Return cached processed tile
  if (dataSaver?.enabled && cacheExists && cachedBlob) {
    console.log("🧑‍🎨 : Returning cached processed tile:", cacheKey);
    return new Response(cachedBlob, {
      status: 200,
      statusText: "OK (Cached Processed)",
      headers: new Headers({ "Content-Type": "image/png" }),
    });
  }

  // Fetch original tile from network
  const response = await originalFetch.apply(window, args);
  const clonedResponse = response.clone();
  const originalTileBlob = await clonedResponse.blob();

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

  return new Response(processedBlob, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
};
