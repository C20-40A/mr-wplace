/**
 * Draft stamp pattern helpers.
 *
 * UI や store に依存しない純粋ロジックにして、単発スタンプと
 * バケツ領域への反復配置で同じ原点・同じパターン判定を共有する。
 */

export type DraftStampMode = "single" | "fill";

export interface DraftStampPattern {
  width: number;
  height: number;
  colorIds: Array<number | null>;
}

export const MIN_STAMP_SIZE = 1;
export const MAX_STAMP_SIZE = 24;

const clampSize = (value: number): number =>
  Number.isFinite(value)
    ? Math.max(MIN_STAMP_SIZE, Math.min(MAX_STAMP_SIZE, Math.round(value)))
    : MIN_STAMP_SIZE;

/** bridge から来た値を安全な矩形パターンへ整形する。 */
export const normalizeDraftStampPattern = (
  pattern: DraftStampPattern,
): DraftStampPattern => {
  const width = clampSize(pattern.width);
  const height = clampSize(pattern.height);
  const sourceColorIds = Array.isArray(pattern.colorIds)
    ? pattern.colorIds
    : [];
  const colorIds = Array.from(
    { length: width * height },
    (_, index) =>
      typeof sourceColorIds[index] === "number" ? sourceColorIds[index] : null,
  );
  return { width, height, colorIds };
};

/** クリック位置をパターンの中央として、ON のピクセルだけ列挙する。 */
export const forEachDraftStampPixel = (
  centerX: number,
  centerY: number,
  pattern: DraftStampPattern,
  visit: (x: number, y: number, colorId: number) => void,
): void => {
  const normalized = normalizeDraftStampPattern(pattern);
  const originX = centerX - Math.floor(normalized.width / 2);
  const originY = centerY - Math.floor(normalized.height / 2);

  for (let y = 0; y < normalized.height; y++)
    for (let x = 0; x < normalized.width; x++)
      {
        const colorId = normalized.colorIds[y * normalized.width + x];
        if (colorId !== null) visit(originX + x, originY + y, colorId);
      }
};

const modulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor;

/**
 * fill 用。クリック位置にパターン中央を合わせた格子を world 全体へ反復し、
 * 指定 world pixel が ON セルに当たるか返す。負の world 座標でもずれない。
 */
export const getDraftStampColorIdAt = (
  worldX: number,
  worldY: number,
  anchorX: number,
  anchorY: number,
  pattern: DraftStampPattern,
): boolean => {
  // fill では最大10万回呼ばれるため、ここで配列を複製しない。
  const width = clampSize(pattern.width);
  const height = clampSize(pattern.height);
  const originX = anchorX - Math.floor(width / 2);
  const originY = anchorY - Math.floor(height / 2);
  const x = modulo(worldX - originX, width);
  const y = modulo(worldY - originY, height);
  return pattern.colorIds[y * width + x] ?? null;
};
