export interface DraftShapePoint {
  x: number;
  y: number;
}

/** 確定前の図形。今は矩形のみ (start/end は対角の2点) */
export interface DraftShapeRect {
  start: DraftShapePoint;
  end: DraftShapePoint;
}

export interface DraftShapeSettings {
  /** 枠線の太さ。0 は「枠なし」(塗りつぶしのみ) */
  strokeWidth: number;
  /** 内側を塗るか。false なら枠だけ残る */
  filled: boolean;
  strokeColor: { r: number; g: number; b: number };
  fillColor: { r: number; g: number; b: number };
}

export type DraftShapePixelVisitor = (
  x: number,
  y: number,
  color: { r: number; g: number; b: number },
) => void;

export interface DraftShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 対角2点を、左上/右下が確定した整数の矩形へ正規化する */
export const getDraftShapeBounds = (shape: DraftShapeRect): DraftShapeBounds => ({
  minX: Math.round(Math.min(shape.start.x, shape.end.x)),
  minY: Math.round(Math.min(shape.start.y, shape.end.y)),
  maxX: Math.round(Math.max(shape.start.x, shape.end.x)),
  maxY: Math.round(Math.max(shape.start.y, shape.end.y)),
});

/**
 * 矩形を WPlace ピクセルへラスタライズする。
 *
 * 塗り→枠の順に打つので、枠は常に内側の塗りより手前に出る。
 * 枠は **内側方向** へ太らせる (外へ膨らむと、掴んだハンドル位置と
 * 実際に置かれる範囲がずれて見えるため)。
 */
export const rasterizeDraftShape = (
  shape: DraftShapeRect,
  settings: DraftShapeSettings,
  visit: DraftShapePixelVisitor,
): void => {
  const { minX, minY, maxX, maxY } = getDraftShapeBounds(shape);
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  // 枠は内向きなので、短辺の半分を超えると意味が無い (全面塗りと同じ)
  const stroke = Math.max(
    0,
    Math.min(Math.round(settings.strokeWidth), Math.ceil(Math.min(width, height) / 2)),
  );

  if (settings.filled)
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) visit(x, y, settings.fillColor);

  if (stroke <= 0) return;

  for (let y = minY; y <= maxY; y++) {
    const onHorizontalBand = y < minY + stroke || y > maxY - stroke;
    for (let x = minX; x <= maxX; x++) {
      // 上下の帯は全幅、それ以外の行は左右の帯だけ
      if (!onHorizontalBand && x >= minX + stroke && x <= maxX - stroke) continue;
      visit(x, y, settings.strokeColor);
    }
  }
};

/** 正方形へのスナップ。anchor を固定して短い方の辺に合わせる */
export const snapDraftShapeToSquare = (
  anchor: DraftShapePoint,
  point: DraftShapePoint,
): DraftShapePoint => {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const size = Math.min(Math.abs(dx), Math.abs(dy));
  return {
    x: anchor.x + (dx < 0 ? -size : size),
    y: anchor.y + (dy < 0 ? -size : size),
  };
};
