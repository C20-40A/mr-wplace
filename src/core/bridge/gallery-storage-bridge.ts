/**
 * Gallery Storage Bridge
 *
 * Content script から IndexedDB v2 (inject側) にアクセスするための
 * postMessage ベースのブリッジAPI
 *
 * NOTE: このブリッジはcontent script専用。
 * inject側では直接 GalleryRepository を使用する。
 */

import type { GalleryMetadata } from "@/inject/db/schema-v2";

// Re-export for convenience
export type { GalleryMetadata } from "@/inject/db/schema-v2";

/**
 * Gallery item with thumbnail for UI display
 */
export interface GalleryItemUI {
  id: string;
  title?: string;
  coords?: { TLX: number; TLY: number; PxX: number; PxY: number };
  width: number;
  height: number;
  visible: boolean;
  zIndex: number;
  timestamp: number;
  thumbnailDataUrl?: string;
}

// ============================================
// Request/Response Message Types
// ============================================

type MessageSource =
  | "mr-wplace-gallery-v2-get-all"
  | "mr-wplace-gallery-v2-get-all-response"
  | "mr-wplace-gallery-v2-get"
  | "mr-wplace-gallery-v2-get-response"
  | "mr-wplace-gallery-v2-save"
  | "mr-wplace-gallery-v2-save-response"
  | "mr-wplace-gallery-v2-delete"
  | "mr-wplace-gallery-v2-delete-response"
  | "mr-wplace-gallery-v2-get-image"
  | "mr-wplace-gallery-v2-get-image-response"
  | "mr-wplace-gallery-v2-get-thumbnail"
  | "mr-wplace-gallery-v2-get-thumbnail-response"
  | "mr-wplace-gallery-v2-update-metadata"
  | "mr-wplace-gallery-v2-update-metadata-response"
  | "mr-wplace-gallery-v2-update-tiles"
  | "mr-wplace-gallery-v2-update-tiles-response";

let requestId = 0;
const generateRequestId = () => `gallery-v2-${++requestId}-${Date.now()}`;

/**
 * Generic request/response helper
 */
const sendRequest = <T>(
  source: MessageSource,
  responseSource: MessageSource,
  data: Record<string, unknown>,
  timeout = 10000
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const reqId = generateRequestId();

    const handler = (event: MessageEvent) => {
      if (
        event.data.source === responseSource &&
        event.data.requestId === reqId
      ) {
        window.removeEventListener("message", handler);
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result as T);
        }
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source,
        requestId: reqId,
        ...data,
      },
      "*"
    );

    setTimeout(() => {
      window.removeEventListener("message", handler);
      reject(new Error(`Request timeout: ${source}`));
    }, timeout);
  });
};

// ============================================
// Public API
// ============================================

/**
 * Get all gallery metadata
 */
export const getAllGalleryMetadata = async (): Promise<GalleryMetadata[]> => {
  return sendRequest<GalleryMetadata[]>(
    "mr-wplace-gallery-v2-get-all",
    "mr-wplace-gallery-v2-get-all-response",
    {}
  );
};

/**
 * Get single gallery metadata
 */
export const getGalleryMetadata = async (
  id: string
): Promise<GalleryMetadata | null> => {
  return sendRequest<GalleryMetadata | null>(
    "mr-wplace-gallery-v2-get",
    "mr-wplace-gallery-v2-get-response",
    { id }
  );
};

/**
 * Save new gallery item (image + metadata + tiles + thumbnail)
 */
export const saveGalleryItem = async (
  id: string,
  imageDataUrl: string,
  metadata: Omit<GalleryMetadata, "id" | "width" | "height" | "affectedTiles">
): Promise<GalleryMetadata> => {
  return sendRequest<GalleryMetadata>(
    "mr-wplace-gallery-v2-save",
    "mr-wplace-gallery-v2-save-response",
    { id, imageDataUrl, metadata },
    30000 // Longer timeout for large images
  );
};

/**
 * Delete gallery item (all stores)
 */
export const deleteGalleryItem = async (id: string): Promise<void> => {
  return sendRequest<void>(
    "mr-wplace-gallery-v2-delete",
    "mr-wplace-gallery-v2-delete-response",
    { id }
  );
};

/**
 * Get full-size image as dataUrl
 */
export const getGalleryImageDataUrl = async (
  id: string
): Promise<string | null> => {
  return sendRequest<string | null>(
    "mr-wplace-gallery-v2-get-image",
    "mr-wplace-gallery-v2-get-image-response",
    { id }
  );
};

/**
 * Get thumbnail as dataUrl
 */
export const getGalleryThumbnailDataUrl = async (
  id: string
): Promise<string | null> => {
  return sendRequest<string | null>(
    "mr-wplace-gallery-v2-get-thumbnail",
    "mr-wplace-gallery-v2-get-thumbnail-response",
    { id }
  );
};

/**
 * Update metadata only (no image change)
 */
export const updateGalleryMetadata = async (
  id: string,
  updates: Partial<Omit<GalleryMetadata, "id" | "width" | "height">>
): Promise<GalleryMetadata> => {
  return sendRequest<GalleryMetadata>(
    "mr-wplace-gallery-v2-update-metadata",
    "mr-wplace-gallery-v2-update-metadata-response",
    { id, updates }
  );
};

/**
 * Update tiles (when coords change)
 */
export const updateGalleryTiles = async (
  id: string,
  coords: { TLX: number; TLY: number; PxX: number; PxY: number }
): Promise<string[]> => {
  return sendRequest<string[]>(
    "mr-wplace-gallery-v2-update-tiles",
    "mr-wplace-gallery-v2-update-tiles-response",
    { id, coords },
    30000 // Longer timeout for tile regeneration
  );
};

// ============================================
// Convenience Functions
// ============================================

/**
 * Get all items with thumbnails for UI display
 */
export const getAllGalleryItemsForUI = async (): Promise<GalleryItemUI[]> => {
  const metadataList = await getAllGalleryMetadata();
  const items: GalleryItemUI[] = [];

  for (const metadata of metadataList) {
    const thumbnailDataUrl = await getGalleryThumbnailDataUrl(metadata.id);
    items.push({
      id: metadata.id,
      title: metadata.title,
      coords: metadata.coords,
      width: metadata.width,
      height: metadata.height,
      visible: metadata.visible,
      zIndex: metadata.zIndex,
      timestamp: metadata.timestamp,
      thumbnailDataUrl: thumbnailDataUrl || undefined,
    });
  }

  return items.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Toggle visibility
 */
export const toggleGalleryItemVisibility = async (
  id: string
): Promise<boolean> => {
  const metadata = await getGalleryMetadata(id);
  if (!metadata) throw new Error(`Item not found: ${id}`);

  const updated = await updateGalleryMetadata(id, {
    visible: !metadata.visible,
  });
  return updated.visible;
};

/**
 * Move layer order
 */
export const moveGalleryItemLayer = async (
  id: string,
  direction: "up" | "down"
): Promise<void> => {
  const allMetadata = await getAllGalleryMetadata();
  const layerItems = allMetadata
    .filter((m) => m.coords)
    .sort((a, b) => a.zIndex - b.zIndex);

  const index = layerItems.findIndex((m) => m.id === id);
  if (index === -1) return;

  const targetIndex = direction === "up" ? index + 1 : index - 1;
  if (targetIndex < 0 || targetIndex >= layerItems.length) return;

  // Swap zIndex
  const currentZIndex = layerItems[index].zIndex;
  const targetZIndex = layerItems[targetIndex].zIndex;

  await updateGalleryMetadata(id, { zIndex: targetZIndex });
  await updateGalleryMetadata(layerItems[targetIndex].id, {
    zIndex: currentZIndex,
  });
};
