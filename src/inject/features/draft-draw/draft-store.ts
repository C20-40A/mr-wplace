import type { CapturedPaintedCoordinate } from "@/inject/types";
import { colorpalette } from "@/constants/colors";
import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";

const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;

/**
 * Draft pixel store (inject context)
 *
 * ペイント予約を charge を消費せずに蓄積する。
 * 描画は行わない (wplace 本体が予約中のピクセルを表示するため)。
 * 蓄積データは「下書きを保存」時の画像化にのみ使う。
 */

/** 1 pixel 分の下書きデータ */
export interface DraftPixel {
  pixelX: number;
  pixelY: number;
  r: number;
  g: number;
  b: number;
}

/** tileKey = "tx,ty" -> (pixelKey = "px,py") -> DraftPixel */
const draftTiles = new Map<string, Map<string, DraftPixel>>();

export const toTileKey = (tileX: number, tileY: number): string =>
  `${tileX},${tileY}`;

const toPixelKey = (pixelX: number, pixelY: number): string =>
  `${pixelX},${pixelY}`;

export const getDraftTileKeys = (): string[] => [...draftTiles.keys()];

export const getDraftTile = (
  tileKey: string
): Map<string, DraftPixel> | undefined => draftTiles.get(tileKey);

export const getDraftPixelCount = (): number => {
  let total = 0;
  for (const tile of draftTiles.values()) total += tile.size;
  return total;
};

/** colorIdx -> RGB。wplace の値が color を持たない場合の復元用 */
const paletteByIdx = new Map(
  colorpalette.map((entry) => [entry.id, entry.rgb]),
);

const resolveColorFromIdx = (
  colorIdx: number | undefined,
): { r: number; g: number; b: number } | null => {
  if (typeof colorIdx !== "number") return null;
  const rgb = paletteByIdx.get(colorIdx);
  if (!rgb) return null;
  return { r: rgb[0], g: rgb[1], b: rgb[2] };
};

/**
 * 捕捉したペイントを下書きへ追加。
 * 色が取れない場合は描画できないので無視する。
 */
export const addDraftPixel = (coord: CapturedPaintedCoordinate): boolean => {
  // wplace の Map 値が color を持たず colorIdx だけの場合があるため、
  // パレットから解決する。両方無ければ描けないので捨てる。
  const color = coord.color ?? resolveColorFromIdx(coord.colorIdx);
  if (!color) {
    console.warn(
      "🧑‍🎨 : Draft pixel dropped (no color)",
      coord.colorIdx,
      coord.key,
    );
    return false;
  }

  const tileKey = toTileKey(coord.tileX, coord.tileY);
  let tile = draftTiles.get(tileKey);
  if (!tile) {
    tile = new Map<string, DraftPixel>();
    draftTiles.set(tileKey, tile);
  }

  tile.set(toPixelKey(coord.pixelX, coord.pixelY), {
    pixelX: coord.pixelX,
    pixelY: coord.pixelY,
    r: color.r,
    g: color.g,
    b: color.b,
  });

  return true;
};

/** 下書きから 1 pixel 削除 */
export const removeDraftPixel = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number
): boolean => {
  const tileKey = toTileKey(tileX, tileY);
  const tile = draftTiles.get(tileKey);
  if (!tile?.delete(toPixelKey(pixelX, pixelY))) return false;

  if (tile.size === 0) draftTiles.delete(tileKey);
  return true;
};

/** 全下書きを破棄 */
export const clearDraft = (): void => {
  draftTiles.clear();
};

/**
 * 既存画像を下書きへ読み込む (下書き編集の起点用)。
 * world pixel 座標 (原点 origin) を tile/pixel へ分解して蓄積する。
 */
export const seedDraftFromPixels = (
  pixels: Array<{ x: number; y: number; r: number; g: number; b: number }>,
  origin: { TLX: number; TLY: number; PxX: number; PxY: number },
): number => {
  let seeded = 0;
  for (const pixel of pixels) {
    const worldX = origin.TLX * TILE_SIZE + origin.PxX + pixel.x;
    const worldY = origin.TLY * TILE_SIZE + origin.PxY + pixel.y;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    const pixelX = worldX - tileX * TILE_SIZE;
    const pixelY = worldY - tileY * TILE_SIZE;

    const tileKey = toTileKey(tileX, tileY);
    let tile = draftTiles.get(tileKey);
    if (!tile) {
      tile = new Map<string, DraftPixel>();
      draftTiles.set(tileKey, tile);
    }

    tile.set(toPixelKey(pixelX, pixelY), {
      pixelX,
      pixelY,
      r: pixel.r,
      g: pixel.g,
      b: pixel.b,
    });
    seeded++;
  }
  return seeded;
};
