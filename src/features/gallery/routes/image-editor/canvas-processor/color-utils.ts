import type {
  PerceptualQuantizationMethod,
  QuantizationMethod,
  RgbColor,
} from "./types";

export const clampByte = (value: number): number =>
  Math.max(0, Math.min(255, value));

const toLinearRgb = (channel: number): number =>
  channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);

export const rgbToLab = (r: number, g: number, b: number): RgbColor => {
  const rNorm = toLinearRgb(r / 255);
  const gNorm = toLinearRgb(g / 255);
  const bNorm = toLinearRgb(b / 255);

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

export const rgbToOklab = (r: number, g: number, b: number): RgbColor => {
  const rLinear = toLinearRgb(r / 255);
  const gLinear = toLinearRgb(g / 255);
  const bLinear = toLinearRgb(b / 255);

  const l = 0.4122214708 * rLinear + 0.5363325363 * gLinear + 0.0514459929 * bLinear;
  const m = 0.2119034982 * rLinear + 0.6806995451 * gLinear + 0.1073969566 * bLinear;
  const s = 0.0883024619 * rLinear + 0.2817188376 * gLinear + 0.6299787005 * bLinear;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return [
    0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  ];
};

export const isPerceptualQuantizationMethod = (
  method: QuantizationMethod
): method is PerceptualQuantizationMethod =>
  method === "lab" || method === "oklab" || method === "delta-e-2000";

export const rgbToPerceptualColor = (
  method: PerceptualQuantizationMethod,
  r: number,
  g: number,
  b: number
): RgbColor => {
  if (method === "oklab") return rgbToOklab(r, g, b);
  return rgbToLab(r, g, b);
};

export const colorDistPerceptualEuclidean2 = (
  color1: RgbColor,
  color2: RgbColor
): number => {
  const d0 = color1[0] - color2[0];
  const d1 = color1[1] - color2[1];
  const d2 = color1[2] - color2[2];
  return d0 * d0 + d1 * d1 + d2 * d2;
};

export const colorDistDeltaE2000 = (lab1: RgbColor, lab2: RgbColor): number => {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;

  const c1 = Math.sqrt(a1 * a1 + b1 * b1);
  const c2 = Math.sqrt(a2 * a2 + b2 * b2);
  const cAvg = (c1 + c2) / 2;

  const cAvg7 = cAvg ** 7;
  const g = 0.5 * (1 - Math.sqrt(cAvg7 / (cAvg7 + 25 ** 7)));

  const a1Prime = (1 + g) * a1;
  const a2Prime = (1 + g) * a2;
  const c1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const c2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  const hPrime = (aPrime: number, bValue: number): number => {
    if (aPrime === 0 && bValue === 0) return 0;
    const angle = (Math.atan2(bValue, aPrime) * 180) / Math.PI;
    return angle >= 0 ? angle : angle + 360;
  };

  const h1Prime = hPrime(a1Prime, b1);
  const h2Prime = hPrime(a2Prime, b2);

  const deltaLPrime = l2 - l1;
  const deltaCPrime = c2Prime - c1Prime;

  let deltaHPrime = 0;
  if (c1Prime !== 0 && c2Prime !== 0) {
    if (Math.abs(h2Prime - h1Prime) <= 180) deltaHPrime = h2Prime - h1Prime;
    else if (h2Prime <= h1Prime) deltaHPrime = h2Prime - h1Prime + 360;
    else deltaHPrime = h2Prime - h1Prime - 360;
  }

  const deltaBigHPrime =
    2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(((deltaHPrime / 2) * Math.PI) / 180);

  const lBarPrime = (l1 + l2) / 2;
  const cBarPrime = (c1Prime + c2Prime) / 2;

  let hBarPrime = h1Prime + h2Prime;
  if (c1Prime !== 0 && c2Prime !== 0) {
    if (Math.abs(h1Prime - h2Prime) > 180) {
      hBarPrime = h1Prime + h2Prime < 360 ? hBarPrime + 360 : hBarPrime - 360;
    }
    hBarPrime /= 2;
  } else {
    hBarPrime /= 2;
  }

  const t =
    1 -
    0.17 * Math.cos(((hBarPrime - 30) * Math.PI) / 180) +
    0.24 * Math.cos(((2 * hBarPrime) * Math.PI) / 180) +
    0.32 * Math.cos(((3 * hBarPrime + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * hBarPrime - 63) * Math.PI) / 180);

  const lBarPrimeMinus50Sq = (lBarPrime - 50) * (lBarPrime - 50);
  const sL = 1 + (0.015 * lBarPrimeMinus50Sq) / Math.sqrt(20 + lBarPrimeMinus50Sq);
  const sC = 1 + 0.045 * cBarPrime;

  const sH = 1 + 0.015 * cBarPrime * t;
  const deltaTheta = 30 * Math.exp(-Math.pow((hBarPrime - 275) / 25, 2));
  const rC = 2 * Math.sqrt((cBarPrime ** 7) / (cBarPrime ** 7 + 25 ** 7));
  const rT = -rC * Math.sin((2 * deltaTheta * Math.PI) / 180);

  const lTerm = deltaLPrime / sL;
  const cTerm = deltaCPrime / sC;
  const hTerm = deltaBigHPrime / sH;

  return Math.sqrt(
    lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + rT * cTerm * hTerm
  );
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
