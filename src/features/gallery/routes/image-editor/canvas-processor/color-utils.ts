import type { RgbColor } from "./types";

export const clampByte = (value: number): number =>
  Math.max(0, Math.min(255, value));

export const rgbToLab = (r: number, g: number, b: number): RgbColor => {
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  const toLinear = (channel: number): number =>
    channel <= 0.04045
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);

  rNorm = toLinear(rNorm);
  gNorm = toLinear(gNorm);
  bNorm = toLinear(bNorm);

  const x = rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375;
  const y = rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.072175;
  const z = rNorm * 0.0193339 + gNorm * 0.119192 + bNorm * 0.9503041;

  const xn = 0.95047;
  const yn = 1.0;
  const zn = 1.08883;

  const fx = x / xn;
  const fy = y / yn;
  const fz = z / zn;

  const delta = 6 / 29;
  const t0 = delta * delta * delta;
  const m = (1 / 3) * delta * delta;
  const f = (t: number): number =>
    t > t0 ? Math.pow(t, 1 / 3) : t / (3 * m) + 4 / 29;

  const l = 116 * f(fy) - 16;
  const a = 500 * (f(fx) - f(fy));
  const bLab = 200 * (f(fy) - f(fz));

  return [l, a, bLab];
};

export const colorDistRgbEuclidean2 = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number => {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return dr * dr + dg * dg + db * db;
};

export const colorDistWeightedRgb2 = (
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number => {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;

  return 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
};
