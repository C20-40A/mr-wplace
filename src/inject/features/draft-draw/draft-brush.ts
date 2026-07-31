/**
 * Draft brush (ブラシ形状 + ディザリングスタイル)
 *
 * ブラシ形状は**常に円**。変えられるのは「サイズ」と「ディザリングスタイル」だけ。
 * ディザは world pixel 座標そのものでマスクするので、
 * 何度なぞっても同じ格子に乗る (ストロークが重なっても模様が崩れない)。
 */

export type DitherStyle =
  | "solid"
  | "checker"
  | "dots25"
  | "sparse"
  | "hline"
  | "diagonal";

export const DITHER_STYLES: readonly DitherStyle[] = [
  "solid",
  "checker",
  "dots25",
  "sparse",
  "hline",
  "diagonal",
] as const;

/**
 * world 座標に対するマスク。true の pixel だけ塗る。
 * ここを座標由来にするのが要点 (乱数だとなぞる度に模様が変わる)。
 */
const DITHER_MASKS: Record<DitherStyle, (x: number, y: number) => boolean> = {
  solid: () => true,
  // 市松 50%
  checker: (x, y) => ((x + y) & 1) === 0,
  // 4分の1の点 (2x2 の左上のみ)
  dots25: (x, y) => (x & 1) === 0 && (y & 1) === 0,
  // 4x4 に1点。かなり薄い
  sparse: (x, y) => (x & 3) === 0 && (y & 3) === 0,
  // 横縞
  hline: (_x, y) => (y & 1) === 0,
  // 斜線 (3px 周期)
  diagonal: (x, y) => (x + y) % 3 === 0,
};

let brushSize = 1;
let ditherStyle: DitherStyle = "solid";

/** 円ブラシのオフセット。サイズが変わった時だけ組み直す */
let stampCache: Array<{ dx: number; dy: number }> = [{ dx: 0, dy: 0 }];

/** 直径 size の円 (size=1 は 1px)。中心からの距離で内外判定する */
const buildStamp = (size: number): Array<{ dx: number; dy: number }> => {
  if (size <= 1) return [{ dx: 0, dy: 0 }];

  const offsets: Array<{ dx: number; dy: number }> = [];
  const radius = size / 2;
  const start = -Math.floor((size - 1) / 2);
  const end = start + size - 1;
  // pixel 中心 (+0.5) で測ると偶数サイズでも歪まない
  const center = (start + end) / 2;

  for (let dy = start; dy <= end; dy++)
    for (let dx = start; dx <= end; dx++) {
      const ox = dx - center;
      const oy = dy - center;
      if (ox * ox + oy * oy <= (radius - 0.35) * (radius - 0.35))
        offsets.push({ dx, dy });
    }

  return offsets.length ? offsets : [{ dx: 0, dy: 0 }];
};

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 32;

export const setDraftBrushSize = (size: number): void => {
  const next = Math.max(MIN_BRUSH_SIZE, Math.min(Math.round(size), MAX_BRUSH_SIZE));
  if (next === brushSize) return;
  brushSize = next;
  stampCache = buildStamp(next);
};

export const setDraftDitherStyle = (style: DitherStyle): void => {
  if (!DITHER_STYLES.includes(style)) return;
  ditherStyle = style;
};

export const getDraftBrushSize = (): number => brushSize;

/**
 * ブラシ1打点が触れる world pixel を列挙する。
 * ディザは「消しゴム」には効かせない (消し残しが出て使いにくいため)。
 */
export const forEachBrushPixel = (
  worldX: number,
  worldY: number,
  applyDither: boolean,
  visit: (x: number, y: number) => void,
): void => {
  const mask = applyDither ? DITHER_MASKS[ditherStyle] : null;

  for (const { dx, dy } of stampCache) {
    const x = worldX + dx;
    const y = worldY + dy;
    if (mask && !mask(x, y)) continue;
    visit(x, y);
  }
};
