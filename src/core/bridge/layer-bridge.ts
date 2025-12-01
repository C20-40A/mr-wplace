/**
 * Layer Bridge - Content ↔ Inject communication for IndexedDB layer operations
 */

/**
 * Save layer to IndexedDB via inject context
 * This sends a message to inject side to save layer via LayerRepository
 * and waits for the response
 */
export const saveLayerToIndexedDB = async (
  layer: {
    id: string;
    type: "gallery" | "text" | "snapshot";
    visible: boolean;
    zIndex: number;
    opacity: number;
    coords: { TLX: number; TLY: number; PxX: number; PxY: number };
    bounds: { top: number; left: number; right: number; bottom: number };
    isOptimized: boolean;
    title?: string;
    timestamp: number;
    layerOrder?: number;
    text?: string;
    font?: string;
    snapshotName?: string;
  },
  dataUrl: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-layer-save-response" &&
        event.data.layerId === layer.id
      ) {
        window.removeEventListener("message", handler);

        if (event.data.success) {
          console.log(`🧑‍🎨 : Layer ${layer.id} saved to IndexedDB successfully`);
          resolve();
        } else {
          console.error(
            `🧑‍🎨 : Failed to save layer ${layer.id}:`,
            event.data.error
          );
          reject(new Error(event.data.error || "Unknown error"));
        }
      }
    };

    window.addEventListener("message", handler);

    // Send save request
    window.postMessage(
      {
        source: "mr-wplace-layer-save",
        layer,
        dataUrl,
      },
      "*"
    );

    // Timeout after 30s
    setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error(`Timeout waiting for layer ${layer.id} save response`));
    }, 30000);
  });
};
