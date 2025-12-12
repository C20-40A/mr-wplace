/**
 * Gallery Image Bridge Utility
 *
 * Gallery画像アクセスのための抽象化されたユーティリティ
 * 内部的にはIndexedDB v2を使用
 */

import type { GalleryItem } from "@/states/galleryStorage";
import {
  getGalleryImageDataUrl as getImageDataUrlV2,
  getGalleryThumbnailDataUrl as getThumbnailDataUrlV2,
  saveGalleryItem as saveItemV2,
} from "@/core/bridge/gallery-storage-bridge";

// ============================================
// Core API - Use these
// ============================================

/**
 * Get full-size image dataUrl from GalleryItem
 *
 * @param item - Gallery item to get dataUrl from
 * @param options - Options for error handling
 * @returns dataUrl string or null if not found
 */
export const getImageDataUrl = async (
  item: GalleryItem,
  options?: {
    showToastOnError?: boolean;
    logContext?: string;
  }
): Promise<string | null> => {
  // If dataUrl already exists in item, return it
  if (item.dataUrl && item.dataUrl !== "") {
    return item.dataUrl;
  }

  // Fetch from IndexedDB v2
  const dataUrl = await getImageDataUrlV2(item.key);

  if (!dataUrl) {
    const context = options?.logContext || "image";
    console.warn(`🧑‍🎨 : Failed to load ${context} for ${item.key}`);

    if (options?.showToastOnError) {
      const { Toast } = await import("@/components/toast");
      const { t } = await import("@/i18n/manager");
      Toast.error(t`${"failed_to_load_image"}`);
    }

    return null;
  }

  return dataUrl;
};

/**
 * Get thumbnail dataUrl from GalleryItem key
 *
 * @param key - Gallery item key
 * @returns thumbnail dataUrl or null if not found
 */
export const getThumbnailDataUrl = async (
  key: string
): Promise<string | null> => {
  return getThumbnailDataUrlV2(key);
};

/**
 * Save image to gallery storage
 *
 * @param key - Unique key for the item
 * @param imageDataUrl - Full image as dataUrl
 * @param metadata - Item metadata
 */
export const saveImage = async (
  key: string,
  imageDataUrl: string,
  metadata: {
    title?: string;
    coords?: { TLX: number; TLY: number; PxX: number; PxY: number };
    visible?: boolean;
    zIndex?: number;
    timestamp?: number;
  }
): Promise<void> => {
  await saveItemV2(key, imageDataUrl, {
    title: metadata.title,
    coords: metadata.coords,
    visible: metadata.visible ?? false,
    zIndex: metadata.zIndex ?? 0,
    timestamp: metadata.timestamp ?? Date.now(),
  });
};

// ============================================
// Legacy Aliases - Deprecated
// ============================================

/**
 * @deprecated Use getImageDataUrl instead
 */
export const getFullImageDataUrl = getImageDataUrl;

/**
 * @deprecated Use saveImage instead
 */
export const saveImageToIndexedDB = async (
  key: string,
  blob: Blob,
  coords?: { TLX: number; TLY: number; PxX: number; PxY: number }
): Promise<boolean> => {
  // Convert blob to dataUrl
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  await saveImage(key, dataUrl, { coords, visible: !!coords });
  return true;
};

/**
 * @deprecated Use getImageDataUrl instead
 */
export const fetchFullImageFromIndexedDB = async (
  key: string
): Promise<string | null> => {
  return getImageDataUrlV2(key);
};

/**
 * @deprecated Use getThumbnailDataUrl instead
 */
export const generateThumbnailFromIndexedDB = async (
  key: string
): Promise<string | null> => {
  return getThumbnailDataUrlV2(key);
};
