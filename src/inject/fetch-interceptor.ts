import {
  drawOverlayLayersOnTile,
  checkStateChanged,
  getCachedBlob,
  getOriginalBlob,
  setCachedBlob,
  invalidateTile,
  setOriginalBlob,
  setOriginalLastModified,
  getOriginalLastModified,
} from "./features/tile-draw";
import { invalidateTileCache } from "./cache-storage";
import { handleUserStatusUpdate } from "./handlers/user-status-handler";
import { WplaceUserData } from "./types";
import {
  isFrontLayerTileRequest,
  handleFrontLayerTileRequest,
} from "./features/map-instance/front-tile-layer/fetch-handler";
import {
  isFrontTileLayerOperational,
  notifyFrontTileComparisonReady,
} from "./features/map-instance/front-tile-layer";
import { isDraftModeEnabled } from "./features/draft-draw";

const TILE_URL_REGEX = /\/tiles?\/(\d+)\/(\d+)\.png(?:[?#].*)?$/;
let frontTileXhrInterceptorInstalled = false;

/**
 * Setup fetch interceptor to handle tile requests and user data
 * CRITICAL: Must be called synchronously to catch early /me requests
 */
export const setupFetchInterceptor = (): void => {
  const originalFetch = window.fetch;
  window.mrWplaceOriginalFetch = originalFetch.bind(window);

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
    // URL pattern: https://backend.wplace.live/[s{season}/]pixel/<tileX>/<tileY>?x=<x>&y=<y>
    // Matches both season-prefixed (/s1/pixel/) and direct (/pixel/) variants.
    // /staff/ paths also contain "/pixel/" but are excluded by the "?x=" condition.
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
    // URL pattern: https://backend.wplace.live/[s{season}/]pixel/<tileX>/<tileY>
    // Matches both season-prefixed (/s1/pixel/) and direct (/pixel/) variants.
    // /staff/tools/select-area/clear/.../pixel/ could match, but those are POST only via staff,
    // and the pixelMatch regex /\/pixel\/(\d+)\/(\d+)/ will safely fail on non-tile paths.
    if (url.includes("/pixel/") && !url.includes("?x=") && !url.includes("/staff/")) {
      const requestInfo = args[0];
      const method =
        typeof requestInfo === "string"
          ? args[1]?.method
          : requestInfo instanceof Request
          ? requestInfo.method
          : undefined;

      if (method === "POST") {
        const pixelMatch = url.match(/\/pixel\/(\d+)\/(\d+)/);
        if (pixelMatch) {
          const tileX = parseInt(pixelMatch[1], 10);
          const tileY = parseInt(pixelMatch[2], 10);
          const cacheKey = `${tileX},${tileY}`;

          // Draft mode: never submit paint to the backend.
          // Charge は消費されず、下書きは overlay 側にのみ残る。
          if (isDraftModeEnabled()) {
            console.log("🧑‍🎨: Draft mode - blocked pixel paint POST:", cacheKey);
            return new Response(
              JSON.stringify({ error: "mr-wplace-draft-mode" }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

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

    // Intercept all tile requests.
    // Matches both old (/files/s0/tiles/X/Y.png) and new (/tile/X/Y.png) formats.
    if (TILE_URL_REGEX.test(url)) {
      return handleTileRequest(originalFetch, args, url);
    }

    return originalFetch.apply(this, args);
  };

  setupFrontTileXhrInterceptor();
};

const setupFrontTileXhrInterceptor = (): void => {
  if (frontTileXhrInterceptorInstalled) return;
  frontTileXhrInterceptorInstalled = true;

  const xhrPrototype = window.XMLHttpRequest?.prototype;
  if (!xhrPrototype) return;

  const originalOpen = xhrPrototype.open;
  const originalSend = xhrPrototype.send;
  const originalSetRequestHeader = xhrPrototype.setRequestHeader;

  type FrontTileXhrMeta = {
    method: string;
    url: string;
    isAsync: boolean;
    user?: string | null;
    password?: string | null;
    headers: Array<{ name: string; value: string }>;
    blobUrl?: string;
  };

  const metaMap = new WeakMap<XMLHttpRequest, FrontTileXhrMeta>();

  xhrPrototype.open = function (
    method: string,
    url: string | URL,
    asyncValue?: boolean,
    user?: string | null,
    password?: string | null,
  ): void {
    const isAsync = asyncValue !== false;
    const requestUrl = typeof url === "string" ? url : url.toString();
    if (!isFrontLayerTileRequest(requestUrl)) {
      metaMap.delete(this);
      originalOpen.call(this, method, url, isAsync, user, password);
      return;
    }

    metaMap.set(this, {
      method,
      url: requestUrl,
      isAsync,
      user,
      password,
      headers: [],
    });

    // Keep XHR in OPENED state, then swap URL to Blob URL in send().
    originalOpen.call(this, method, "about:blank", isAsync, user, password);
  };

  xhrPrototype.setRequestHeader = function (name: string, value: string): void {
    const meta = metaMap.get(this);
    if (meta) meta.headers.push({ name, value });
    originalSetRequestHeader.call(this, name, value);
  };

  xhrPrototype.send = function (
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    const meta = metaMap.get(this);
    if (!meta) {
      originalSend.call(this, body);
      return;
    }

    if (!meta.isAsync) {
      console.warn("🧑‍🎨 : Sync XHR is not supported for front layer tiles");
      originalSend.call(this, body);
      return;
    }

    const xhr = this;
    const cleanupBlobUrl = () => {
      if (!meta.blobUrl) return;
      URL.revokeObjectURL(meta.blobUrl);
      meta.blobUrl = undefined;
    };

    void handleFrontLayerTileRequest(meta.url)
      .then((response) => response.blob())
      .then((blob) => {
        cleanupBlobUrl();
        meta.blobUrl = URL.createObjectURL(blob);

        originalOpen.call(
          xhr,
          meta.method,
          meta.blobUrl,
          meta.isAsync,
          meta.user,
          meta.password,
        );
        for (const header of meta.headers) {
          try {
            originalSetRequestHeader.call(xhr, header.name, header.value);
          } catch (error) {
            console.warn("🧑‍🎨 : Failed to reapply XHR header:", error);
          }
        }
        xhr.addEventListener("loadend", cleanupBlobUrl, { once: true });
        originalSend.call(xhr, body);
      })
      .catch((error) => {
        console.error("🧑‍🎨 : Failed to handle front layer XHR tile:", error);
        originalSend.call(xhr, body);
      });
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
  const tileMatch = url.match(TILE_URL_REGEX);
  if (!tileMatch) {
    return originalFetch.apply(window, args);
  }

  const tileX = parseInt(tileMatch[1], 10);
  const tileY = parseInt(tileMatch[2], 10);
  const cacheKey = `${tileX},${tileY}`;
  const dataSaver = window.mrWplaceDataSaver;
  const dataSaverEnabled = dataSaver?.enabled === true;
  const frontOperational = isFrontTileLayerOperational();
  const snapshotCaptureEnabled = window.mrWplaceSnapshotCaptureEnabled === true;
  let reusableProcessedBlob: Blob | null = null;

  const sendTmpSnapshot = (tileBlob: Blob): void => {
    if (!snapshotCaptureEnabled) return;
    window.postMessage(
      {
        source: "wplace-studio-snapshot",
        tileBlob,
        tileX,
        tileY,
      },
      "*"
    );
  };

  // In front-layer mode, background tiles should stay raw (no processed-tile reuse).
  // Skip data-saver cache lookup entirely to avoid unnecessary work.
  let cacheExists = false;
  let cachedBlob: Blob | null = null;

  if (!frontOperational) {
    // Check memory cache first (data saver)
    cacheExists = dataSaver?.tileCache.has(cacheKey) ?? false;

    // If not in memory, check IndexedDB only when data saver is enabled
    if (!cacheExists && dataSaverEnabled && dataSaver?.tileCacheDB) {
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
    // Snapshot capture ON のときは tmp 更新を優先し、
    // original blob が無ければ network fetch まで進んで補完する。
    if (dataSaverEnabled && cacheExists && cachedBlob) {
      if (snapshotCaptureEnabled) {
        const cachedOriginalBlob = getOriginalBlob(cacheKey);
        if (cachedOriginalBlob) {
          sendTmpSnapshot(cachedOriginalBlob);
          return new Response(cachedBlob, {
            status: 200,
            statusText: "OK (Cached Processed)",
            headers: new Headers({ "Content-Type": "image/png" }),
          });
        }

        reusableProcessedBlob = cachedBlob;
      } else {
        return new Response(cachedBlob, {
          status: 200,
          statusText: "OK (Cached Processed)",
          headers: new Headers({ "Content-Type": "image/png" }),
        });
      }
    }
  }

  // Fetch original tile from network
  const response = await originalFetch.apply(window, args);

  // LastModified cache is used only when front layer is OFF.
  // Skip expensive state-version serialization when front layer is ON.
  if (!frontOperational) {
    // Check state change (clears LastModified cache if changed)
    checkStateChanged();
  }

  // LastModified cache check
  const lastModified = response.headers.get("last-modified");
  const prevLastModified = getOriginalLastModified(cacheKey);
  const backgroundChanged = !lastModified || prevLastModified !== lastModified;

  // Fast path for front-layer mode:
  // - Background didn't change (Last-Modified unchanged)
  // - Snapshot capture is off
  // In this case, we can return the original response directly without blob decoding.
  if (frontOperational && !backgroundChanged && !snapshotCaptureEnabled) {
    window.postMessage(
      { source: "wplace-studio-drawing-complete", tileX, tileY },
      "*"
    );
    return response;
  }

  // Use processed blob cache only when front-layer is OFF.
  // When front-layer is ON, we must NOT cache raw tiles here — doing so would
  // pollute the shared cache and cause overlay to disappear after disabling.
  if (!frontOperational && lastModified) {
    const lastModifiedCachedBlob = getCachedBlob(cacheKey, lastModified);
    if (lastModifiedCachedBlob) {
      if (snapshotCaptureEnabled) {
        const cachedOriginalBlob = getOriginalBlob(cacheKey);
        if (cachedOriginalBlob) {
          sendTmpSnapshot(cachedOriginalBlob);
          return new Response(lastModifiedCachedBlob, {
            headers: response.headers,
            status: response.status,
            statusText: response.statusText,
          });
        }

        reusableProcessedBlob = lastModifiedCachedBlob;
      } else {
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
  }

  const originalTileBlob = await response.blob();

  // Cache original tile for background pixel checks (area fill, etc.)
  setOriginalBlob(cacheKey, originalTileBlob);
  setOriginalLastModified(cacheKey, lastModified);

  if (backgroundChanged) {
    notifyFrontTileComparisonReady(tileX, tileY);
  }

  // Save snapshot for time travel feature (when enabled)
  sendTmpSnapshot(originalTileBlob);

  // When front tile layer is enabled, skip overlay compositing on background tiles.
  // Overlays are rendered on the independent front layer instead.
  if (frontOperational) {
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

  // Snapshot capture ON + cache hit で network fetch まで進んだケース:
  // tmp 更新用に original を確保したら、重い再描画は避けて既存processedを返す。
  if (reusableProcessedBlob) {
    window.postMessage(
      { source: "wplace-studio-drawing-complete", tileX, tileY },
      "*"
    );
    return new Response(reusableProcessedBlob, {
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
