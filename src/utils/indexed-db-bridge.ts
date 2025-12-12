/**
 * IndexedDB Bridge Utility
 *
 * Content context から inject context の IndexedDB にアクセスするための
 * postMessage 経由のブリッジユーティリティ
 */

import type { GalleryItem } from "@/states/galleryStorage";

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

/**
 * Save image blob to IndexedDB via inject context
 *
 * @param key - Gallery item key (e.g., "gallery_1234567890")
 * @param blob - Image blob to save
 * @param coords - Draw position coordinates
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns Promise<boolean> - true if saved successfully, false otherwise
 */
export const saveImageToIndexedDB = async (
  key: string,
  blob: Blob,
  coords?: { TLX: number; TLY: number; PxX: number; PxY: number },
  timeout = 10000
): Promise<boolean> => {
  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-save-image-response" &&
        event.data.key === key
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.success);
      }
    };

    window.addEventListener("message", handler);

    // Convert blob to dataUrl for postMessage
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;

      window.postMessage(
        {
          source: "mr-wplace-save-image-request",
          key,
          dataUrl,
          coords,
        },
        "*"
      );
    };

    reader.onerror = () => {
      window.removeEventListener("message", handler);
      console.error(`🧑‍🎨 : Failed to convert blob to dataUrl for ${key}`);
      resolve(false);
    };

    reader.readAsDataURL(blob);

    // Timeout
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn(`🧑‍🎨 : IndexedDB save timeout for ${key}`);
      resolve(false);
    }, timeout);
  });
};

/**
 * Get full image dataUrl from GalleryItem, with fallback to IndexedDB
 *
 * This is a convenience function that:
 * 1. Returns item.dataUrl if it exists
 * 2. Falls back to fetching from IndexedDB
 * 3. Handles error logging and optional Toast notifications
 *
 * @param item - Gallery item to get dataUrl from
 * @param options - Options for error handling
 * @param options.showToastOnError - Show error Toast when fetch fails (default: false)
 * @param options.logContext - Context string for log messages (default: "image")
 * @returns dataUrl string or null if not found
 *
 * @example
 * ```typescript
 * const dataUrl = await getFullImageDataUrl(item, {
 *   showToastOnError: true,
 *   logContext: "image detail"
 * });
 * if (!dataUrl) return;
 * ```
 */
export const getFullImageDataUrl = async (
  item: GalleryItem,
  options?: {
    showToastOnError?: boolean;
    logContext?: string;
  }
): Promise<string | null> => {
  // If dataUrl already exists, return it
  if (item.dataUrl && item.dataUrl !== "") {
    return item.dataUrl;
  }

  // Try fetching from IndexedDB
  const dataUrl = await fetchFullImageFromIndexedDB(item.key);

  if (!dataUrl) {
    const context = options?.logContext || "image";
    console.warn(
      `🧑‍🎨 : Failed to load ${context} from IndexedDB for ${item.key}`
    );

    if (options?.showToastOnError) {
      const { Toast } = await import("@/components/toast");
      const { t } = await import("@/i18n/manager");
      Toast.error(t`${"failed_to_load_image"}`);
    }

    return null;
  }

  return dataUrl;
};
