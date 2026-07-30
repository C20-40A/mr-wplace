import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";
import { getDraftTile, getDraftTileKeys } from "./draft-store";

/**
 * Draft export
 *
 * 下書き全体をバウンディングボックスで切り出し、gallery へ保存できる
 * dataUrl + 原点座標に変換する。
 */

const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;
/** 巨大化防止 (gallery 保存を現実的なサイズに保つ) */
const MAX_EXPORT_EDGE = 4000;

export interface DraftExportResult {
  dataUrl: string;
  width: number;
  height: number;
  pixelCount: number;
  coords: { TLX: number; TLY: number; PxX: number; PxY: number };
}

const parseTileKey = (tileKey: string): [number, number] | null => {
  const [x, y] = tileKey.split(",");
  const tileX = Number(x);
  const tileY = Number(y);
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;
  return [tileX, tileY];
};

/**
 * 下書きを 1 枚の画像へ。pixel が無ければ null。
 * 座標はタイル跨ぎを考慮した world pixel 基準で算出する。
 */
export const exportDraftAsImage =
  async (): Promise<DraftExportResult | null> => {
    const tileKeys = getDraftTileKeys();
    if (tileKeys.length === 0) return null;

    // world pixel 空間でのバウンディングボックスを求める
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let pixelCount = 0;

    type WorldPixel = { x: number; y: number; r: number; g: number; b: number };
    const worldPixels: WorldPixel[] = [];

    for (const tileKey of tileKeys) {
      const parsed = parseTileKey(tileKey);
      const tile = getDraftTile(tileKey);
      if (!parsed || !tile) continue;

      const [tileX, tileY] = parsed;
      const originX = tileX * TILE_SIZE;
      const originY = tileY * TILE_SIZE;

      for (const pixel of tile.values()) {
        const x = originX + pixel.pixelX;
        const y = originY + pixel.pixelY;

        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;

        worldPixels.push({ x, y, r: pixel.r, g: pixel.g, b: pixel.b });
        pixelCount++;
      }
    }

    if (pixelCount === 0) return null;

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if (width > MAX_EXPORT_EDGE || height > MAX_EXPORT_EDGE) {
      console.warn(
        `🧑‍🎨 : Draft export too large (${width}x${height}), aborted`
      );
      return null;
    }

    const imageData = new ImageData(width, height);
    const data = imageData.data;

    for (const pixel of worldPixels) {
      const offset = ((pixel.y - minY) * width + (pixel.x - minX)) * 4;
      data[offset] = pixel.r;
      data[offset + 1] = pixel.g;
      data[offset + 2] = pixel.b;
      data[offset + 3] = 255;
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.putImageData(imageData, 0, 0);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    return {
      dataUrl,
      width,
      height,
      pixelCount,
      coords: {
        TLX: Math.floor(minX / TILE_SIZE),
        TLY: Math.floor(minY / TILE_SIZE),
        PxX: minX % TILE_SIZE,
        PxY: minY % TILE_SIZE,
      },
    };
  };
