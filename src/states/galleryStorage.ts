/**
 * Gallery Storage - IndexedDB v2 Wrapper
 *
 * 既存コードとの互換性を維持するため、新しいIndexedDB v2 APIのラッパーとして機能
 * Migration完了後は全てIndexedDB v2を使用
 */

import type { ColorStats } from "@/types/image";
import {
  getAllGalleryMetadata,
  getGalleryMetadata,
  saveGalleryItem as saveGalleryItemV2,
  deleteGalleryItem,
  getGalleryImageDataUrl,
  getGalleryThumbnailDataUrl,
  updateGalleryMetadata,
  moveGalleryItemLayer,
  type GalleryMetadata,
} from "@/core/bridge/gallery-storage-bridge";

export interface DrawPosition {
  TLX: number;
  TLY: number;
  PxX: number;
  PxY: number;
}

/**
 * GalleryItem - 旧形式との互換性を維持
 * 内部的にはGalleryMetadataにマッピング
 */
export interface GalleryItem {
  key: string;
  timestamp: number;
  dataUrl?: string;
  thumbnail?: string;
  title?: string;
  drawPosition?: DrawPosition;
  drawEnabled?: boolean;
  layerOrder?: number;
  // サイズ情報 (v2から追加)
  width?: number;
  height?: number;
  // 統計フィールド
  matchedColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
  perTileColorStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >;
}

/**
 * Convert GalleryMetadata to GalleryItem (for backward compatibility)
 */
const metadataToItem = (
  metadata: GalleryMetadata,
  thumbnailDataUrl?: string
): GalleryItem => ({
  key: metadata.id,
  timestamp: metadata.timestamp,
  dataUrl: "", // Loaded on demand
  thumbnail: thumbnailDataUrl,
  title: metadata.title,
  drawPosition: metadata.coords,
  drawEnabled: metadata.visible,
  layerOrder: metadata.zIndex,
  width: metadata.width,
  height: metadata.height,
  perTileColorStats: metadata.perTileStats,
});

/**
 * GalleryStorage - IndexedDB v2へのブリッジ
 */
export class GalleryStorage {
  /**
   * Get single item by key
   */
  async get(key: string): Promise<GalleryItem | undefined> {
    const metadata = await getGalleryMetadata(key);
    if (!metadata) return undefined;

    const thumbnailDataUrl =
      (await getGalleryThumbnailDataUrl(key)) || undefined;
    return metadataToItem(metadata, thumbnailDataUrl);
  }

  /**
   * Get all items
   */
  async getAll(options?: { fullImage?: boolean }): Promise<GalleryItem[]> {
    const metadataList = await getAllGalleryMetadata();
    const items: GalleryItem[] = [];

    for (const metadata of metadataList) {
      let thumbnailDataUrl: string | undefined;
      let dataUrl: string | undefined;

      // Get thumbnail for UI display
      thumbnailDataUrl =
        (await getGalleryThumbnailDataUrl(metadata.id)) || undefined;

      // Get full image if requested
      if (options?.fullImage) {
        dataUrl = (await getGalleryImageDataUrl(metadata.id)) || undefined;
      }

      const item = metadataToItem(metadata, thumbnailDataUrl);
      if (dataUrl) item.dataUrl = dataUrl;

      items.push(item);
    }

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Save item (new or update)
   */
  async save(item: GalleryItem): Promise<void> {
    // For new items with dataUrl, save full image
    if (item.dataUrl && item.dataUrl !== "") {
      await saveGalleryItemV2(item.key, item.dataUrl, {
        title: item.title,
        coords: item.drawPosition,
        visible: item.drawEnabled !== false,
        zIndex: item.layerOrder ?? 0,
        timestamp: item.timestamp,
        perTileStats: item.perTileColorStats,
      });
    } else {
      // Update metadata only
      await updateGalleryMetadata(item.key, {
        title: item.title,
        coords: item.drawPosition,
        visible: item.drawEnabled !== false,
        zIndex: item.layerOrder ?? 0,
        perTileStats: item.perTileColorStats,
      });
    }
  }

  /**
   * Delete item
   */
  async delete(key: string): Promise<void> {
    await deleteGalleryItem(key);
  }

  /**
   * Update tile color stats
   */
  async updateTileColorStats(
    imageKey: string,
    perTileStatsMap: Map<string, ColorStats>
  ): Promise<void> {
    const metadata = await getGalleryMetadata(imageKey);
    if (!metadata) return;

    // Merge current stats with incoming delta/full payload
    const mergedPerTileStats: Record<
      string,
      { matched: Record<string, number>; total: Record<string, number> }
    > = {
      ...(metadata.perTileStats || {}),
    };

    for (const [tileKey, stats] of perTileStatsMap.entries()) {
      mergedPerTileStats[tileKey] = {
        matched: Object.fromEntries(stats.matched),
        total: Object.fromEntries(stats.total),
      };
    }

    await updateGalleryMetadata(imageKey, {
      perTileStats: mergedPerTileStats,
    });
  }

  /**
   * Move layer order
   */
  async moveLayer(imageKey: string, direction: "up" | "down"): Promise<void> {
    await moveGalleryItemLayer(imageKey, direction);
  }
}
