import type { CapturedPaintedCoordinate } from "@/inject/types";

/**
 * Draft pixel store (inject context)
 *
 * ペイント予約を charge を消費せずに蓄積する。
 * tile 単位の Map を source of truth とし、bitmap は描画時に焼く。
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

/** 変更のあった tileKey。再描画対象の絞り込みに使う */
const dirtyTiles = new Set<string>();

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

export const takeDirtyTiles = (): string[] => {
  const keys = [...dirtyTiles];
  dirtyTiles.clear();
  return keys;
};

export const markDirty = (tileKey: string): void => {
  dirtyTiles.add(tileKey);
};

/**
 * 捕捉したペイントを下書きへ追加。
 * 色が取れない場合は描画できないので無視する。
 */
export const addDraftPixel = (coord: CapturedPaintedCoordinate): boolean => {
  const { color } = coord;
  if (!color) return false;

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

  dirtyTiles.add(tileKey);
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
  dirtyTiles.add(tileKey);
  return true;
};

/** 全下書きを破棄。破棄前に存在した tileKey を返す(再描画用) */
export const clearDraft = (): string[] => {
  const keys = [...draftTiles.keys()];
  draftTiles.clear();
  for (const key of keys) dirtyTiles.add(key);
  return keys;
};
