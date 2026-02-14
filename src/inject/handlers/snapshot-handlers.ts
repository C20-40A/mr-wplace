/**
 * Snapshot Bridge Handlers
 *
 * IndexedDB へのアクセスを処理するハンドラー
 * content script からの postMessage リクエストに応答
 */

import {
  getSnapshotRepository,
  initSnapshotRepository,
  type SnapshotMetadata,
} from "../db/snapshot-repository";
import { isDangerousMessageAuthorized } from "../security/message-auth";

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
 * Convert dataUrl to Blob
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
  window.postMessage({ source, requestId, result, error }, "*");
};

/**
 * Handle get all metadata request
 */
const handleGetAllMetadata = async (requestId: string) => {
  try {
    const repo = await initSnapshotRepository();
    const metadata = await repo.getAllMetadata();
    sendResponse("mr-wplace-snapshot-get-all-metadata-response", requestId, metadata);
  } catch (error) {
    console.error("🧑‍🎨 [Snapshot] Get all metadata failed:", error);
    sendResponse(
      "mr-wplace-snapshot-get-all-metadata-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle get metadata by tile request
 */
const handleGetMetadataByTile = async (
  requestId: string,
  tileX: number,
  tileY: number
) => {
  try {
    const repo = await initSnapshotRepository();
    const metadata = await repo.getMetadataByTile(tileX, tileY);
    sendResponse("mr-wplace-snapshot-get-metadata-by-tile-response", requestId, metadata);
  } catch (error) {
    console.error("🧑‍🎨 [Snapshot] Get metadata by tile failed:", error);
    sendResponse(
      "mr-wplace-snapshot-get-metadata-by-tile-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle get snapshot blob request (returns dataUrl)
 */
const handleGetSnapshot = async (requestId: string, id: string) => {
  try {
    const repo = await initSnapshotRepository();
    const blob = await repo.getSnapshot(id);
    if (!blob) {
      sendResponse("mr-wplace-snapshot-get-response", requestId, null);
      return;
    }
    const dataUrl = await blobToDataUrl(blob);
    sendResponse("mr-wplace-snapshot-get-response", requestId, dataUrl);
  } catch (error) {
    console.error("🧑‍🎨 [Snapshot] Get snapshot failed:", error);
    sendResponse(
      "mr-wplace-snapshot-get-response",
      requestId,
      null,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle save snapshot with metadata request
 */
const handleSaveSnapshot = async (
  requestId: string,
  id: string,
  dataUrl: string,
  metadata: SnapshotMetadata
) => {
  try {
    const repo = await initSnapshotRepository();
    const blob = dataUrlToBlob(dataUrl);
    await repo.saveSnapshotWithMetadata(id, blob, metadata);
    sendResponse("mr-wplace-snapshot-save-response", requestId, true);
    console.log(`🧑‍🎨 [Snapshot] Saved ${id}`);
  } catch (error) {
    console.error("🧑‍🎨 [Snapshot] Save failed:", error);
    sendResponse(
      "mr-wplace-snapshot-save-response",
      requestId,
      false,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Handle delete snapshot with metadata request
 */
const handleDeleteSnapshot = async (requestId: string, id: string) => {
  try {
    const repo = await initSnapshotRepository();
    await repo.deleteSnapshotWithMetadata(id);
    sendResponse("mr-wplace-snapshot-delete-response", requestId, true);
    console.log(`🧑‍🎨 [Snapshot] Deleted ${id}`);
  } catch (error) {
    console.error("🧑‍🎨 [Snapshot] Delete failed:", error);
    sendResponse(
      "mr-wplace-snapshot-delete-response",
      requestId,
      false,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
};

/**
 * Setup snapshot bridge handlers
 */
export const setupSnapshotHandlers = () => {
  window.addEventListener("message", async (event) => {
    const { source, requestId } = event.data;

    switch (source) {
      case "mr-wplace-snapshot-get-all-metadata":
        await handleGetAllMetadata(requestId);
        break;

      case "mr-wplace-snapshot-get-metadata-by-tile":
        await handleGetMetadataByTile(
          requestId,
          event.data.tileX,
          event.data.tileY
        );
        break;

      case "mr-wplace-snapshot-get":
        await handleGetSnapshot(requestId, event.data.id);
        break;

      case "mr-wplace-snapshot-save":
        await handleSaveSnapshot(
          requestId,
          event.data.id,
          event.data.dataUrl,
          event.data.metadata
        );
        break;

      case "mr-wplace-snapshot-delete":
        if (!isDangerousMessageAuthorized(event.data)) {
          sendResponse(
            "mr-wplace-snapshot-delete-response",
            requestId,
            false,
            "Unauthorized request"
          );
          console.warn("🧑‍🎨 [Snapshot] Rejected unauthorized delete request");
          break;
        }
        await handleDeleteSnapshot(requestId, event.data.id);
        break;
    }
  });

  console.log("🧑‍🎨 : Snapshot bridge handlers initialized");
};
