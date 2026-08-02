export interface DraftLinePoint {
  x: number;
  y: number;
}

export interface DraftLineShape {
  start: DraftLinePoint;
  control: DraftLinePoint;
  end: DraftLinePoint;
}

export interface DraftLineSettings {
  innerWidth: number;
  outlineWidth: number;
  innerColor: { r: number; g: number; b: number };
  outlineColor: { r: number; g: number; b: number };
}

export type DraftLinePixelVisitor = (
  x: number,
  y: number,
  color: { r: number; g: number; b: number },
) => void;

const pointAt = (shape: DraftLineShape, t: number): DraftLinePoint => {
  const oneMinusT = 1 - t;
  return {
    x:
      oneMinusT * oneMinusT * shape.start.x +
      2 * oneMinusT * t * shape.control.x +
      t * t * shape.end.x,
    y:
      oneMinusT * oneMinusT * shape.start.y +
      2 * oneMinusT * t * shape.control.y +
      t * t * shape.end.y,
  };
};

/**
 * Pixel-art friendly circular stamp. The requested width is treated as the
 * diameter, so even widths stay visually balanced around the curve.
 */
const stampCircle = (
  centerX: number,
  centerY: number,
  width: number,
  color: DraftLineSettings["innerColor"],
  visit: DraftLinePixelVisitor,
): void => {
  const diameter = Math.max(1, Math.round(width));
  const radius = diameter / 2;
  const start = -Math.floor((diameter - 1) / 2);
  const end = start + diameter - 1;
  const center = (start + end) / 2;
  const limit = Math.max(0.25, radius - 0.25) ** 2;

  for (let dy = start; dy <= end; dy++)
    for (let dx = start; dx <= end; dx++) {
      const ox = dx - center;
      const oy = dy - center;
      if (ox * ox + oy * oy > limit) continue;
      visit(Math.round(centerX) + dx, Math.round(centerY) + dy, color);
    }
};

/**
 * Rasterize a quadratic line into WPlace pixels. The outline pass is painted
 * first and the inner pass second, producing a road-like two-colour stroke.
 */
export const rasterizeDraftLine = (
  shape: DraftLineShape,
  settings: DraftLineSettings,
  visit: DraftLinePixelVisitor,
): void => {
  const chord = Math.hypot(
    shape.end.x - shape.start.x,
    shape.end.y - shape.start.y,
  );
  const controlSpan =
    Math.hypot(
      shape.control.x - shape.start.x,
      shape.control.y - shape.start.y,
    ) +
    Math.hypot(
      shape.end.x - shape.control.x,
      shape.end.y - shape.control.y,
    );
  // Oversampling at roughly half-pixel intervals keeps tight curves solid.
  const steps = Math.max(1, Math.ceil(Math.max(chord, controlSpan) * 2));
  const innerWidth = Math.max(1, Math.round(settings.innerWidth));
  const outlineWidth = Math.max(0, Math.round(settings.outlineWidth));

  const paintPass = (
    width: number,
    color: DraftLineSettings["innerColor"],
  ): void => {
    for (let i = 0; i <= steps; i++) {
      const point = pointAt(shape, i / steps);
      stampCircle(point.x, point.y, width, color, visit);
    }
  };

  if (outlineWidth > 0)
    paintPass(innerWidth + outlineWidth * 2, settings.outlineColor);
  paintPass(innerWidth, settings.innerColor);
};

export const getDraftLineMidpoint = (
  start: DraftLinePoint,
  end: DraftLinePoint,
): DraftLinePoint => ({
  x: (start.x + end.x) / 2,
  y: (start.y + end.y) / 2,
});
