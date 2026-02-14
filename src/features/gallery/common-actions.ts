/**
 * ギャラリー画像に対する共通アクション
 */

import { GalleryItem, GalleryStorage } from "../../states/galleryStorage";
import { gotoPosition } from "../../utils/position";
import { tilePixelToLatLng } from "../../utils/coordinate";
import { sendGalleryImagesToInject } from "@/content";
import { downloadBlob } from "./routes/image-editor/file-handler";

/**
 * ファイル名のサニタイズ
 * ファイルシステムで使えない文字を削除または置換
 */
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
};

/**
 * 描画ON/OFFトグル
 */
export const toggleDrawState = async (key: string): Promise<boolean> => {
  const tileOverlay = window.mrWplace?.tileOverlay;
  if (!tileOverlay) throw new Error("TileOverlay not available");
  // toggleImageDrawState内で既にsendGalleryImagesToInjectを呼んでいる
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
 * 位置情報がない場合はタイトルのみでダウンロード
 */
export const downloadImage = (item: GalleryItem, canvasId: string): void => {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) throw new Error("Canvas not found");

  let filename: string;

  if (item.drawPosition) {
    // 位置情報がある場合: タイトル_座標.png または 座標.png
    const { TLX, TLY, PxX, PxY } = item.drawPosition;
    const coords = `${TLX}-${TLY}-${PxX}-${PxY}`;
    const baseFilename = item.title ? `${item.title}_${coords}` : coords;
    filename = sanitizeFilename(baseFilename) + ".png";
  } else {
    // 位置情報がない場合: タイトル.png または image.png
    const baseFilename = item.title || "image";
    filename = sanitizeFilename(baseFilename) + ".png";
  }

  console.log("🧑‍🎨 : Downloading image with filename:", filename);

  canvas.toBlob((blob) => {
    if (!blob) throw new Error("Failed to create blob");
    downloadBlob(blob, filename);
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

  // Notify inject side to update overlay layers
  await sendGalleryImagesToInject();

  console.log("🧑‍🎨 : Image moved", direction, newCoords);
};

/**
 * マップ中央に画像を配置（画像中心をマップ中心に）
 */
export const drawImageAtMapCenter = async (
  item: GalleryItem
): Promise<void> => {
  if (!item.width || !item.height) {
    throw new Error("Image dimensions not available");
  }

  // inject側からマップ中心座標を取得
  const { getMapCenter } = await import("@/utils/inject-bridge");
  const center = await getMapCenter();

  if (!center) {
    throw new Error("Map instance not available");
  }

  const { latLngToTilePixel } = await import("@/utils/coordinate");
  const centerCoords = latLngToTilePixel(center.lat, center.lng);

  // 画像中心をマップ中心に配置するため、画像の半分のサイズだけオフセット
  const halfWidth = Math.floor(item.width / 2);
  const halfHeight = Math.floor(item.height / 2);

  // 中心座標から画像の半分を引いて左上座標を計算
  let tlx = centerCoords.TLX;
  let tly = centerCoords.TLY;
  let pxx = centerCoords.PxX - halfWidth;
  let pxy = centerCoords.PxY - halfHeight;

  // ピクセル座標がマイナスの場合、タイル座標を調整
  while (pxx < 0) {
    tlx -= 1;
    pxx += 1000;
  }
  while (pxy < 0) {
    tly -= 1;
    pxy += 1000;
  }

  // ピクセル座標が1000を超える場合も調整
  while (pxx >= 1000) {
    tlx += 1;
    pxx -= 1000;
  }
  while (pxy >= 1000) {
    tly += 1;
    pxy -= 1000;
  }

  const tileOverlay = window.mrWplace?.tileOverlay;
  if (!tileOverlay) throw new Error("TileOverlay not available");

  await tileOverlay.drawImageWithCoords(
    { TLX: tlx, TLY: tly, PxX: pxx, PxY: pxy },
    item
  );

  console.log("🧑‍🎨 : Image drawn at map center", { TLX: tlx, TLY: tly, PxX: pxx, PxY: pxy });
};
