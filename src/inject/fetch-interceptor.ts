/**
 * Setup fetch interceptor to handle tile requests and user data
 */
export const setupFetchInterceptor = async (
  isInitialized: () => boolean
): Promise<void> => {
  const originalFetch = window.fetch;

  window.fetch = async function (...args): Promise<Response> {
    // Wait for initialization
    while (!isInitialized()) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const requestInfo = args[0];
    const url =
      typeof requestInfo === "string"
        ? requestInfo
        : requestInfo instanceof Request
        ? requestInfo.url
        : requestInfo.toString();

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
        console.error("Failed to parse /me response:", error);
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
 * Caching Strategy:
 * 1. data saver OFF / cache key NOT exists -> No caching. Process tile.
 * 2. data saver OFF / cache key exists -> Process tile and cache the processed result.
 * 3. data saver ON / cache key NOT exists -> Fetch, process, and cache the processed result.
 * 4. data saver ON / cache key exists -> Return cached processed tile directly (no fetch/process).
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
  const cacheExists = dataSaver?.tileCache.has(cacheKey) ?? false;

  // Case 4: data saver ON + cache exists -> Return cached processed tile
  if (dataSaver?.enabled && cacheExists) {
    console.log("🧑‍🎨 : Returning cached processed tile:", cacheKey);
    const cachedBlob = dataSaver.tileCache.get(cacheKey)!;
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

  // Determine if we should cache the processed result
  const shouldCacheProcessed =
    dataSaver?.enabled || // Case 3: data saver ON (always cache)
    (dataSaver && cacheExists); // Case 2: data saver OFF but cache key exists

  // Process tile (overlay, snapshot, etc.)
  return new Promise((resolve) => {
    const blobUUID = crypto.randomUUID();

    // Store callback for processed blob
    window.tileProcessingQueue = window.tileProcessingQueue || new Map();
    window.tileProcessingQueue.set(blobUUID, (processedBlob: Blob) => {
      // Cache the processed tile if needed
      if (shouldCacheProcessed && dataSaver) {
        dataSaver.tileCache.set(cacheKey, processedBlob);
        console.log("🧑‍🎨 : Cached processed tile:", cacheKey);
      }

      resolve(
        new Response(processedBlob, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        })
      );
    });

    // Send tile for processing
    window.postMessage(
      {
        source: "wplace-studio-tile",
        blobID: blobUUID,
        tileBlob: originalTileBlob,
        tileX: tileX,
        tileY: tileY,
      },
      "*"
    );
  });
};
