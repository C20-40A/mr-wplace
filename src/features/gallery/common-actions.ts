/**
 * ギャラリー画像に対する共通アクション
 */

import { GalleryItem, GalleryStorage } from "./storage";
import { gotoPosition } from "../../utils/position";
import { tilePixelToLatLng } from "../../utils/coordinate";
import {
  addImageToOverlayLayers,
  removePreparedOverlayImageByKey,
} from "@/features/tile-draw-stubs";

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

/**
 * 画像をピクセル単位で移動
 */
export const moveImage = async (
  item: GalleryItem,
  direction: "up" | "down" | "left" | "right"
): Promise<void> => {
  if (!item.drawPosition) throw new Error("Item has no drawPosition");

  const deltaMap = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const delta = deltaMap[direction];
  const newCoords = {
    TLX: item.drawPosition.TLX,
    TLY: item.drawPosition.TLY,
    PxX: item.drawPosition.PxX + delta.x,
    PxY: item.drawPosition.PxY + delta.y,
  };

  const galleryStorage = new GalleryStorage();
  await galleryStorage.save({
    ...item,
    drawPosition: newCoords,
  });

  const response = await fetch(item.dataUrl);
  const blob = await response.blob();

  removePreparedOverlayImageByKey(item.key);
  await addImageToOverlayLayers(
    blob,
    [newCoords.TLX, newCoords.TLY, newCoords.PxX, newCoords.PxY],
    item.key
  );

  console.log("🧑‍🎨 : Image moved", direction, newCoords);
};
