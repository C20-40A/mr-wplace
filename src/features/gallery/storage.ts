import { ImageStorage, BaseImageItem } from "../../utils/image-storage";
import type { ColorStats } from "../tile-draw/types";

export interface DrawPosition {
  TLX: number;
  TLY: number;
  PxX: number;
  PxY: number;
}

export interface GalleryItem extends BaseImageItem {
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
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

  async getAll(): Promise<GalleryItem[]> {
    const items = await this.imageStorage.getAll();

    // hasDrawPositionを計算して追加
    return items.map((item) => ({
      ...item,
      hasDrawPosition: !!item.drawPosition,
    }));
  }

  async save(item: GalleryItem): Promise<void> {
    return this.imageStorage.save(item);
  }

  async delete(key: string): Promise<void> {
    return this.imageStorage.delete(key);
  }
}
