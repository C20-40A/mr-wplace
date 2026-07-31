import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";

const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;

/**
 * Draft pixel store (inject context)
 *
 * 下書きの唯一の真実。wplace 本体のペイント予約とは完全に無関係で、
 * charge も消費しない。
 *
 * データはタイルごとに 2 表現を持つ:
 * - `pixels`: 保存(export)用の厳密なピクセル集合
 * - `canvas`: 表示用の 1000x1000 ラスタ (wplace のタイルのクローン)
 *
 * canvas を持つのは、描画のたびに数十万ピクセルを再構築させないため。
 * 1 pixel の変更は canvas 上の 1 fillRect / clearRect で済み、
 * 表示側はタイルを 1 回 drawImage するだけでよい。
 */

export interface DraftPixel {
  pixelX: number;
  pixelY: number;
  r: number;
  g: number;
  b: number;
}

interface DraftTile {
  pixels: Map<string, DraftPixel>;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** tileKey = "tx,ty" */
const draftTiles = new Map<string, DraftTile>();

/** 変更通知 (表示側の再描画トリガー) */
let onChange: (() => void) | null = null;

export const setDraftStoreChangeListener = (
  listener: (() => void) | null,
): void => {
  onChange = listener;
};

export const toTileKey = (tileX: number, tileY: number): string =>
  `${tileX},${tileY}`;

const toPixelKey = (pixelX: number, pixelY: number): string =>
  `${pixelX},${pixelY}`;

export const getDraftTileKeys = (): string[] => [...draftTiles.keys()];

export const getDraftTileCanvas = (
  tileKey: string,
): HTMLCanvasElement | undefined => draftTiles.get(tileKey)?.canvas;

export const getDraftTilePixels = (
  tileKey: string,
): Map<string, DraftPixel> | undefined => draftTiles.get(tileKey)?.pixels;

/** spoit 用。その座標に下書きピクセルがあれば色を返す */
export const getDraftPixel = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): DraftPixel | undefined =>
  draftTiles.get(toTileKey(tileX, tileY))?.pixels.get(toPixelKey(pixelX, pixelY));

export const getDraftPixelCount = (): number => {
  let total = 0;
  for (const tile of draftTiles.values()) total += tile.pixels.size;
  return total;
};

const getOrCreateTile = (tileKey: string): DraftTile | null => {
  const existing = draftTiles.get(tileKey);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) return null;

  const tile: DraftTile = { pixels: new Map(), canvas, ctx };
  draftTiles.set(tileKey, tile);
  return tile;
};

/**
 * 1 pixel 追加/上書き。
 * 同じ座標に同じ色なら何もしない (ドラッグ中の無駄な再描画を避ける)。
 */
export const setDraftPixel = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
  color: { r: number; g: number; b: number },
  options?: { silent?: boolean },
): boolean => {
  if (pixelX < 0 || pixelY < 0 || pixelX >= TILE_SIZE || pixelY >= TILE_SIZE)
    return false;

  const tile = getOrCreateTile(toTileKey(tileX, tileY));
  if (!tile) return false;

  const pixelKey = toPixelKey(pixelX, pixelY);
  const previous = tile.pixels.get(pixelKey);
  if (
    previous &&
    previous.r === color.r &&
    previous.g === color.g &&
    previous.b === color.b
  )
    return false;

  tile.pixels.set(pixelKey, { pixelX, pixelY, ...color });
  tile.ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
  tile.ctx.fillRect(pixelX, pixelY, 1, 1);

  if (!options?.silent) onChange?.();
  return true;
};

/** 1 pixel 削除 */
export const removeDraftPixel = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): boolean => {
  const tileKey = toTileKey(tileX, tileY);
  const tile = draftTiles.get(tileKey);
  if (!tile?.pixels.delete(toPixelKey(pixelX, pixelY))) return false;

  tile.ctx.clearRect(pixelX, pixelY, 1, 1);
  if (tile.pixels.size === 0) draftTiles.delete(tileKey);

  onChange?.();
  return true;
};

/** 全下書きを破棄 */
export const clearDraft = (): void => {
  draftTiles.clear();
  onChange?.();
};

/**
 * 既存画像を下書きへ読み込む (下書き編集の起点)。
 * world pixel 座標 (原点 origin) を tile/pixel へ分解して蓄積する。
 */
export const seedDraftFromPixels = (
  pixels: Array<{ x: number; y: number; r: number; g: number; b: number }>,
  origin: { TLX: number; TLY: number; PxX: number; PxY: number },
): number => {
  const originX = origin.TLX * TILE_SIZE + origin.PxX;
  const originY = origin.TLY * TILE_SIZE + origin.PxY;

  let seeded = 0;
  for (const pixel of pixels) {
    const worldX = originX + pixel.x;
    const worldY = originY + pixel.y;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);

    // seed は数十万 pixel になりうるので通知は最後に1回だけ
    if (
      setDraftPixel(
        tileX,
        tileY,
        worldX - tileX * TILE_SIZE,
        worldY - tileY * TILE_SIZE,
        { r: pixel.r, g: pixel.g, b: pixel.b },
        { silent: true },
      )
    )
      seeded++;
  }

  onChange?.();
  return seeded;
};
