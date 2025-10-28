import type { TileProcessingCallback } from "./types";

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
      typeof requestInfo === "string" ? requestInfo : requestInfo.url || "";

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

  let tileBlob: Blob;
  let response: Response;

  // Check cache if data saver enabled
  if (dataSaver?.enabled && dataSaver.tileCache.has(cacheKey)) {
    console.log("🧑‍🎨 : Cache hit for tile:", cacheKey);
    tileBlob = dataSaver.tileCache.get(cacheKey)!;
    // Create response for consistency (headers may be used downstream)
    response = new Response(tileBlob, {
      status: 200,
      statusText: "OK (Cached)",
      headers: new Headers({ "Content-Type": "image/png" }),
    });
  } else {
    // Fetch from network
    response = await originalFetch.apply(window, args);
    const clonedResponse = response.clone();
    tileBlob = await clonedResponse.blob();

    // Save to cache if data saver enabled
    if (dataSaver?.enabled) {
      dataSaver.tileCache.set(cacheKey, tileBlob);
      console.log("🧑‍🎨 : Cached tile:", cacheKey);
    }
  }

  // Process tile (overlay, snapshot, etc.)
  return new Promise((resolve) => {
    const blobUUID = crypto.randomUUID();

    // Store callback for processed blob
    window.tileProcessingQueue = window.tileProcessingQueue || new Map();
    window.tileProcessingQueue.set(blobUUID, (processedBlob: Blob) => {
      resolve(
        new Response(processedBlob, {
          headers: response.headers,
          status: response.status,
          statusText: response.statusText,
        })
      );
    });

    // Send original tile for snapshot (tmp save)
    window.postMessage(
      {
        source: "wplace-studio-snapshot-tmp",
        tileBlob: tileBlob,
        tileX: tileX,
        tileY: tileY,
      },
      "*"
    );

    // Send tile for processing
    window.postMessage(
      {
        source: "wplace-studio-tile",
        blobID: blobUUID,
        tileBlob: tileBlob,
        tileX: tileX,
        tileY: tileY,
      },
      "*"
    );
  });
};
