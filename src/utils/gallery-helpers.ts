/**
 * Gallery Helper Utilities
 *
 * 最寄りギャラリーアイテムの検索など、共通的なギャラリー操作
 */

import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";

/**
 * 座標を持つアイテムの共通インターフェース
 */
export interface ItemWithCoords {
  id: string;
  coords: { TLX: number; TLY: number; PxX: number; PxY: number };
}

/**
 * 現在位置から最寄りのギャラリーアイテムを取得
 *
 * @param items - coords を持つアイテムのリスト
 * @returns 最寄りのアイテムID、または null（アイテムが空 or 現在位置が取得できない場合）
 */
export const findNearestGalleryItem = <T extends ItemWithCoords>(
  items: T[]
): T | null => {
  if (items.length === 0) return null;

  const currentPos = getCurrentPosition();
  if (!currentPos) return null;

  const { TLX: cx, TLY: cy } = latLngToTilePixel(currentPos.lat, currentPos.lng);

  // 距離計算 → 最寄り1件を選択
  const nearest = items.reduce(
    (closest, item) => {
      const dist =
        Math.pow(item.coords.TLX - cx, 2) + Math.pow(item.coords.TLY - cy, 2);
      return dist < closest.dist ? { item, dist } : closest;
    },
    { item: items[0], dist: Infinity }
  );

  return nearest.item;
};
