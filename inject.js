const originalFetch = window.fetch;

// Listen for processed blobs from content script
window.addEventListener("message", (event) => {
  if (event.data.source === "mr-wplace-processed") {
    const { blobID, processedBlob } = event.data;
    const callback = window.tileProcessingQueue?.get(blobID);

    if (typeof callback === "function") {
      callback(processedBlob);
      window.tileProcessingQueue.delete(blobID);
    }
  }

  // Listen for flyTo requests from content script
  if (event.data.source === "wplace-studio-flyto") {
    const { lat, lng, zoom } = event.data;
    window.wplaceMap?.flyTo?.({ center: [lng, lat], zoom });
  }
});

// Map instance observer
const mapObserver = new MutationObserver(() => {
  try {
    const mapElement = document.querySelector(
      "div.absolute.bottom-3.right-3.z-30"
    );
    if (
      mapElement &&
      mapElement.childNodes[0] &&
      mapElement.childNodes[0].__click
    ) {
      const map = mapElement.childNodes[0].__click[3].v;
      if (map && typeof map.version === "string") {
        window.wplaceMap = map;
        mapObserver.disconnect();
        console.log("WPlace map instance captured", map);
      }
    }
  } catch (e) {
    // Continue observing
  }
});

mapObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

window.fetch = async function (...args) {
  console.log("🧑‍🎨: Fetch called with args:", args);
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
    // Extract tileX, tileY from URL
    const tileMatch = url.match(/tiles\/(\d+)\/(\d+)\.png/);
    if (!tileMatch) {
      return originalFetch.apply(this, args);
    }

    const tileX = parseInt(tileMatch[1]);
    const tileY = parseInt(tileMatch[2]);

    // console.log(`Intercepting tile: ${tileX},${tileY} - ${url}`);

    const response = await originalFetch.apply(this, args);
    const clonedResponse = response.clone();

    try {
      const blob = await clonedResponse.blob();

      return new Promise((resolve) => {
        const blobUUID = crypto.randomUUID();

        // Store callback for processed blob
        window.tileProcessingQueue = window.tileProcessingQueue || new Map();
        window.tileProcessingQueue.set(blobUUID, (processedBlob) => {
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
            tileBlob: blob,
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
            tileBlob: blob,
            tileX: tileX,
            tileY: tileY,
          },
          "*"
        );
      });
    } catch (error) {
      console.error("Failed to process tile blob:", error);
      return response;
    }
  }

  return originalFetch.apply(this, args);
};
