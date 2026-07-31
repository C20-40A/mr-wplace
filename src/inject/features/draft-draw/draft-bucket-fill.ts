import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";
import { getDraftPixel } from "./draft-store";

/**
 * Draft bucket fill
 *
 * world pixel 空間の 4 近傍 flood fill。
 *
 * CRITICAL: 下書きは「広大な world map の上に浮いた疎なピクセル集合」なので、
 * 何も無いところをバケツすると理論上は無限に広がる。必ず以下で打ち切る:
 * - 塗ったピクセル数の上限 (MAX_FILL_PIXELS)
 * - 開始点から矩形範囲の上限 (MAX_FILL_EXTENT)
 * 打ち切った場合は「1ピクセルも塗らずに」失敗を返す。
 * (中途半端に塗ると取り消しが面倒なため、all-or-nothing にする)
 */

const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;

/** 塗りつぶし上限。これを超えたら中止する */
const MAX_FILL_PIXELS = 100_000;
/** 開始点からこの範囲を越えて広がったら中止 (暴走の早期検出) */
const MAX_FILL_EXTENT = 2_000;

export type BucketFillResult =
  | { ok: true; pixels: Array<{ x: number; y: number }> }
  | { ok: false; reason: "too-large" };

type Rgb = { r: number; g: number; b: number };

const colorAt = (worldX: number, worldY: number): Rgb | null => {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const pixel = getDraftPixel(
    tileX,
    tileY,
    worldX - tileX * TILE_SIZE,
    worldY - tileY * TILE_SIZE,
  );
  return pixel ? { r: pixel.r, g: pixel.g, b: pixel.b } : null;
};

const sameColor = (a: Rgb | null, b: Rgb | null): boolean => {
  if (a === null || b === null) return a === b;
  return a.r === b.r && a.g === b.g && a.b === b.b;
};

/**
 * 開始点と連結した「同じ色 (または同じく空白)」の領域を返す。
 * 塗る色と対象色が同じなら何もしない (無限ループ防止)。
 */
export const computeBucketFill = (
  startX: number,
  startY: number,
  fillColor: Rgb,
): BucketFillResult => {
  const targetColor = colorAt(startX, startY);
  if (sameColor(targetColor, fillColor)) return { ok: true, pixels: [] };

  const minX = startX - MAX_FILL_EXTENT;
  const maxX = startX + MAX_FILL_EXTENT;
  const minY = startY - MAX_FILL_EXTENT;
  const maxY = startY + MAX_FILL_EXTENT;

  const visited = new Set<string>();
  const pixels: Array<{ x: number; y: number }> = [];
  const stack: Array<[number, number]> = [[startX, startY]];

  while (stack.length > 0) {
    const [x, y] = stack.pop()!;

    // 範囲外へ到達 = 開いた領域を塗ろうとしている。安全側に倒して中止
    if (x < minX || x > maxX || y < minY || y > maxY)
      return { ok: false, reason: "too-large" };

    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (!sameColor(colorAt(x, y), targetColor)) continue;

    pixels.push({ x, y });
    if (pixels.length > MAX_FILL_PIXELS) return { ok: false, reason: "too-large" };

    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return { ok: true, pixels };
};
