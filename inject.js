const originalFetch = window.fetch;

// Listen for processed blobs from content script
window.addEventListener("message", (event) => {
  if (event.data.source === "wplace-studio-processed") {
    const { blobID, processedBlob } = event.data;
    const callback = window.tileProcessingQueue?.get(blobID);

    if (typeof callback === "function") {
      callback(processedBlob);
      window.tileProcessingQueue.delete(blobID);
    }
  }
});

window.fetch = async function (...args) {
  const requestInfo = args[0];
  const url = requestInfo.url || "";

  // Intercept only tile 520,218
  if (
    url.includes("backend.wplace.live") &&
    url.includes("tiles/520/218.png")
  ) {
    console.log("Intercepting target tile:", url);

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

        // Send tile for processing
        window.postMessage(
          {
            source: "wplace-studio-tile",
            blobID: blobUUID,
            tileBlob: blob,
            tileX: 520,
            tileY: 218,
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
