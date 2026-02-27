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

  const { TLX: cx, TLY: cy, PxX: cpx, PxY: cpy } = latLngToTilePixel(currentPos.lat, currentPos.lng);
  const cwx = cx * 1000 + cpx;
  const cwy = cy * 1000 + cpy;

  // ワールドピクセル座標で距離計算 → 最寄り1件を選択
  const nearest = items.reduce(
    (closest, item) => {
      const dx = item.coords.TLX * 1000 + item.coords.PxX - cwx;
      const dy = item.coords.TLY * 1000 + item.coords.PxY - cwy;
      const dist = dx * dx + dy * dy;
      return dist < closest.dist ? { item, dist } : closest;
    },
    { item: items[0], dist: Infinity }
  );

  return nearest.item;
};
