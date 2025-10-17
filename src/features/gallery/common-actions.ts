/**
 * ギャラリー画像に対する共通アクション
 */

import { GalleryItem } from "./storage";
import { gotoPosition } from "../../utils/position";
import { tilePixelToLatLng } from "../../utils/coordinate";

/**
 * 描画ON/OFFトグル
 */
export const toggleDrawState = async (key: string): Promise<boolean> => {
  const tileOverlay = window.mrWplace?.tileOverlay;
  if (!tileOverlay) throw new Error("TileOverlay not available");
  return await tileOverlay.toggleImageDrawState(key);
};

/**
 * マップへ移動
 */
export const gotoMapPosition = async (item: GalleryItem): Promise<void> => {
  if (!item.drawPosition) throw new Error("Item has no drawPosition");

  const { lat, lng } = tilePixelToLatLng(
    item.drawPosition.TLX,
    item.drawPosition.TLY,
    item.drawPosition.PxX,
    item.drawPosition.PxY
  );

  await gotoPosition({ lat, lng, zoom: 14 });
};

/**
 * 画像を位置情報ファイル名でダウンロード
 */
export const downloadImage = (item: GalleryItem, canvasId: string): void => {
  if (!item.drawPosition) throw new Error("Item has no drawPosition");

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) throw new Error("Canvas not found");

  canvas.toBlob((blob) => {
    if (!blob) throw new Error("Failed to create blob");

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;

    const { TLX, TLY, PxX, PxY } = item.drawPosition!;
    a.download = `${TLX}-${TLY}-${PxX}-${PxY}.png`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
};
