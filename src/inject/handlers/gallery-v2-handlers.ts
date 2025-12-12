/**
 * Gallery V2 Bridge Handlers
 *
 * IndexedDB v2 へのアクセスを処理するハンドラー
 * content script からの postMessage リクエストに応答
 */

import { getGalleryRepository, initGalleryRepository } from "../db/gallery-repository";
import type { GalleryMetadata } from "../db/schema-v2";

/**
 * Convert Blob to dataUrl
 */
const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Convert dataUrl to Blob (without fetch to avoid WASM interference)
 */
const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
};

/**
 * Send response back to content script
 */
const sendResponse = (
  source: string,
  requestId: string,
  result: unknown,
  error?: string
) => {
  window.postMessage(
    {
      source,
      requestId,
      result,
      error,
    },
    "*"
  );
};

/**
 * Handle get all metadata request
 */
const handleGetAll = async (requestId: string) => {
  try {
    const repo = await initGalleryRepository();
    const metadata = await repo.getAllMetadata();
    sendResponse("mr-wplace-gallery-v2-get-all-response", requestId, metadata);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Get all failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-get-all-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle get single metadata request
 */
const handleGet = async (requestId: string, id: string) => {
  try {
    const repo = await initGalleryRepository();
    const metadata = await repo.getMetadata(id);
    sendResponse("mr-wplace-gallery-v2-get-response", requestId, metadata);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Get failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-get-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle save gallery item request
 */
const handleSave = async (
  requestId: string,
  id: string,
  imageDataUrl: string,
  metadata: Omit<GalleryMetadata, "id" | "width" | "height" | "affectedTiles">
) => {
  try {
    const repo = await initGalleryRepository();
    const blob = dataUrlToBlob(imageDataUrl);
    const savedMetadata = await repo.saveGalleryItem(id, blob, metadata);
    sendResponse("mr-wplace-gallery-v2-save-response", requestId, savedMetadata);
    console.log(`🧑‍🎨 [Gallery V2] Saved ${id}`);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Save failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-save-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle delete gallery item request
 */
const handleDelete = async (requestId: string, id: string) => {
  try {
    const repo = await initGalleryRepository();
    await repo.deleteGalleryItem(id);
    sendResponse("mr-wplace-gallery-v2-delete-response", requestId, true);
    console.log(`🧑‍🎨 [Gallery V2] Deleted ${id}`);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Delete failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-delete-response",
      requestId,
      false,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle get image dataUrl request
 */
const handleGetImage = async (requestId: string, id: string) => {
  try {
    const repo = await initGalleryRepository();
    const blob = await repo.getImage(id);
    if (!blob) {
      sendResponse("mr-wplace-gallery-v2-get-image-response", requestId, null);
      return;
    }
    const dataUrl = await blobToDataUrl(blob);
    sendResponse("mr-wplace-gallery-v2-get-image-response", requestId, dataUrl);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Get image failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-get-image-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle get thumbnail dataUrl request
 */
const handleGetThumbnail = async (requestId: string, id: string) => {
  try {
    const repo = await initGalleryRepository();
    const blob = await repo.getThumbnail(id);
    if (!blob) {
      sendResponse("mr-wplace-gallery-v2-get-thumbnail-response", requestId, null);
      return;
    }
    const dataUrl = await blobToDataUrl(blob);
    sendResponse("mr-wplace-gallery-v2-get-thumbnail-response", requestId, dataUrl);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Get thumbnail failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-get-thumbnail-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle update metadata request
 */
const handleUpdateMetadata = async (
  requestId: string,
  id: string,
  updates: Partial<Omit<GalleryMetadata, "id" | "width" | "height">>
) => {
  try {
    const repo = await initGalleryRepository();
    const existing = await repo.getMetadata(id);
    if (!existing) {
      sendResponse(
        "mr-wplace-gallery-v2-update-metadata-response",
        requestId,
        null,
        `Item not found: ${id}`
      );
      return;
    }

    // If coords is being updated, recalculate affectedTiles and regenerate split tiles
    if (updates.coords) {
      const affectedTiles = await repo.updateTiles(id, updates.coords);
      const updated: GalleryMetadata = {
        ...existing,
        ...updates,
        affectedTiles,
      };
      await repo.saveMetadata(updated);
      sendResponse("mr-wplace-gallery-v2-update-metadata-response", requestId, updated);
      console.log(`🧑‍🎨 [Gallery V2] Updated metadata + tiles for ${id} (${affectedTiles.length} tiles)`);
      return;
    }

    const updated: GalleryMetadata = {
      ...existing,
      ...updates,
    };
    await repo.saveMetadata(updated);
    sendResponse("mr-wplace-gallery-v2-update-metadata-response", requestId, updated);
    console.log(`🧑‍🎨 [Gallery V2] Updated metadata for ${id}`);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Update metadata failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-update-metadata-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle update tiles request
 */
const handleUpdateTiles = async (
  requestId: string,
  id: string,
  coords: { TLX: number; TLY: number; PxX: number; PxY: number }
) => {
  try {
    const repo = await initGalleryRepository();
    const affectedTiles = await repo.updateTiles(id, coords);
    sendResponse("mr-wplace-gallery-v2-update-tiles-response", requestId, affectedTiles);
    console.log(`🧑‍🎨 [Gallery V2] Updated tiles for ${id}: ${affectedTiles.length} tiles`);
  } catch (error) {
    console.error("🧑‍🎨 [Gallery V2] Update tiles failed:", error);
    sendResponse(
      "mr-wplace-gallery-v2-update-tiles-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Setup gallery v2 bridge handlers
 */
export const setupGalleryV2Handlers = () => {
  window.addEventListener("message", async (event) => {
    const { source, requestId } = event.data;

    switch (source) {
      case "mr-wplace-gallery-v2-get-all":
        await handleGetAll(requestId);
        break;

      case "mr-wplace-gallery-v2-get":
        await handleGet(requestId, event.data.id);
        break;

      case "mr-wplace-gallery-v2-save":
        await handleSave(
          requestId,
          event.data.id,
          event.data.imageDataUrl,
          event.data.metadata
        );
        break;

      case "mr-wplace-gallery-v2-delete":
        await handleDelete(requestId, event.data.id);
        break;

      case "mr-wplace-gallery-v2-get-image":
        await handleGetImage(requestId, event.data.id);
        break;

      case "mr-wplace-gallery-v2-get-thumbnail":
        await handleGetThumbnail(requestId, event.data.id);
        break;

      case "mr-wplace-gallery-v2-update-metadata":
        await handleUpdateMetadata(requestId, event.data.id, event.data.updates);
        break;

      case "mr-wplace-gallery-v2-update-tiles":
        await handleUpdateTiles(requestId, event.data.id, event.data.coords);
        break;
    }
  });

  console.log("🧑‍🎨 : Gallery V2 bridge handlers initialized");
};
