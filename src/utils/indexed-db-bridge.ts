/**
 * IndexedDB Bridge Utility
 * 
 * Content context から inject context の IndexedDB にアクセスするための
 * postMessage 経由のブリッジユーティリティ
 */

/**
 * Fetch full image dataUrl from IndexedDB via inject context
 * 
 * @param key - Gallery item key (e.g., "gallery_1234567890")
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Promise<string | null> - Full image dataUrl or null if failed
 */
export const fetchFullImageFromIndexedDB = async (
  key: string,
  timeout = 10000
): Promise<string | null> => {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-gallery-dataurl-response" &&
        event.data.key === key
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.dataUrl);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-gallery-dataurl-request",
        key,
      },
      "*"
    );

    // Timeout
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn(`🧑‍🎨 : IndexedDB full image fetch timeout for ${key}`);
      resolve(null);
    }, timeout);
  });
};

/**
 * Generate thumbnail from IndexedDB blob via inject context
 * 
 * @param key - Gallery item key
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns Promise<string | null> - Thumbnail dataUrl or null if failed
 */
export const generateThumbnailFromIndexedDB = async (
  key: string,
  timeout = 5000
): Promise<string | null> => {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-thumbnail-response" &&
        event.data.key === key
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.thumbnail);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-thumbnail-request",
        key,
      },
      "*"
    );

    // Timeout
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn(`🧑‍🎨 : Thumbnail generation timeout for ${key}`);
      resolve(null);
    }, timeout);
  });
};
