import { ImageStorage, BaseImageItem } from "./image-storage";
import type { ColorStats } from "@/types/image";

export interface DrawPosition {
  TLX: number;
  TLY: number;
  PxX: number;
  PxY: number;
}

export interface GalleryItem extends BaseImageItem {
  title?: string;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  layerOrder?: number;
  // 統計フィールド
  matchedColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
  // タイル別統計（タイルまたぎの画像だと、タイルごとに更新が必要）
  perTileColorStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >;
}

export class GalleryStorage {
  private imageStorage = new ImageStorage<GalleryItem>("gallery");

  /**
   * layerOrderを自動採番（未設定画像がある場合のみ）
   */
  private async ensureLayerOrders(): Promise<void> {
    const items = await this.imageStorage.getAll();
    const itemsWithDrawPosition = items.filter((i) => i.drawPosition);
    const needsUpdate = itemsWithDrawPosition.some(
      (i) => i.layerOrder === undefined
    );

    if (!needsUpdate) return;

    // timestamp順でlayerOrder設定
    const sorted = itemsWithDrawPosition.sort(
      (a, b) => a.timestamp - b.timestamp
    );
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].layerOrder === undefined) {
        await this.imageStorage.save({ ...sorted[i], layerOrder: i });
      }
    }
  }

  async updateTileColorStats(
    imageKey: string,
    perTileStatsMap: Map<string, ColorStats>
  ): Promise<void> {
    const images = await this.getAll();
    const image = images.find((i) => i.key === imageKey);
    if (!image) throw new Error(`Image not found: ${imageKey}`);

    // Map→Record変換
    const perTileRecord: Record<
      string,
      { matched: Record<string, number>; total: Record<string, number> }
    > = {};
    for (const [tileKey, stats] of perTileStatsMap.entries()) {
      perTileRecord[tileKey] = {
        matched: Object.fromEntries(stats.matched),
        total: Object.fromEntries(stats.total),
      };
    }

    // 全タイル合算
    const matchedSum = new Map<string, number>();
    const totalSum = new Map<string, number>();
    for (const stats of perTileStatsMap.values()) {
      for (const [colorKey, count] of stats.matched.entries()) {
        matchedSum.set(colorKey, (matchedSum.get(colorKey) || 0) + count);
      }
      for (const [colorKey, count] of stats.total.entries()) {
        totalSum.set(colorKey, (totalSum.get(colorKey) || 0) + count);
      }
    }

    await this.save({
      ...image,
      perTileColorStats: perTileRecord,
      matchedColorStats: Object.fromEntries(matchedSum),
      totalColorStats: Object.fromEntries(totalSum),
    });
  }

  async get(key: string): Promise<GalleryItem | undefined> {
    const item = await this.imageStorage.get(key);
    if (!item) return undefined;
    return item;
  }

  async getAll(): Promise<GalleryItem[]> {
    await this.ensureLayerOrders();
    const items = await this.imageStorage.getAll();
    return items;
  }

  async save(item: GalleryItem): Promise<void> {
    // 新規描画時にlayerOrderを自動設定
    if (item.drawPosition && item.layerOrder === undefined) {
      const items = await this.imageStorage.getAll();
      const maxOrder = items
        .filter((i) => i.drawPosition && i.layerOrder !== undefined)
        .reduce((max, i) => Math.max(max, i.layerOrder!), -1);
      item.layerOrder = maxOrder + 1;
    }
    return this.imageStorage.save(item);
  }

  async delete(key: string): Promise<void> {
    return this.imageStorage.delete(key);
  }

  /**
   * レイヤー順序変更
   */
  async moveLayer(imageKey: string, direction: "up" | "down"): Promise<void> {
    const items = await this.getAll();
    const layerImages = items
      .filter((i) => i.drawPosition)
      .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0));

    const index = layerImages.findIndex((i) => i.key === imageKey);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= layerImages.length) return;

    // layerOrder入れ替え
    const temp = layerImages[index].layerOrder;
    layerImages[index].layerOrder = layerImages[targetIndex].layerOrder;
    layerImages[targetIndex].layerOrder = temp;

    // 保存
    await this.imageStorage.save(layerImages[index]);
    await this.imageStorage.save(layerImages[targetIndex]);
  }
}
