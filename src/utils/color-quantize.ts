/**
 * Color quantization utilities ported from wplace source.
 * Algorithms are kept bit-for-bit identical to the original.
 *
 * b.colors from DbY1VRJD.js — index = colorId (0 = Transparent)
 */

export type ColorMetric = "lab" | "compuphase" | "ciede2000";

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Lab {
  l: number;
  a: number;
  b: number;
}

// b.colors[index] — index 0 is Transparent, index = colorId
const PALETTE_COLORS: { name: string; rgb: [number, number, number] }[] = [
  { name: "Transparent", rgb: [0, 0, 0] },
  { name: "Black", rgb: [0, 0, 0] },
  { name: "Dark Gray", rgb: [60, 60, 60] },
  { name: "Gray", rgb: [120, 120, 120] },
  { name: "Light Gray", rgb: [210, 210, 210] },
  { name: "White", rgb: [255, 255, 255] },
  { name: "Deep Red", rgb: [96, 0, 24] },
  { name: "Red", rgb: [237, 28, 36] },
  { name: "Orange", rgb: [255, 127, 39] },
  { name: "Gold", rgb: [246, 170, 9] },
  { name: "Yellow", rgb: [249, 221, 59] },
  { name: "Light Yellow", rgb: [255, 250, 188] },
  { name: "Dark Green", rgb: [14, 185, 104] },
  { name: "Green", rgb: [19, 230, 123] },
  { name: "Light Green", rgb: [135, 255, 94] },
  { name: "Dark Teal", rgb: [12, 129, 110] },
  { name: "Teal", rgb: [16, 174, 166] },
  { name: "Light Teal", rgb: [19, 225, 190] },
  { name: "Dark Blue", rgb: [40, 80, 158] },
  { name: "Blue", rgb: [64, 147, 228] },
  { name: "Cyan", rgb: [96, 247, 242] },
  { name: "Indigo", rgb: [107, 80, 246] },
  { name: "Light Indigo", rgb: [153, 177, 251] },
  { name: "Dark Purple", rgb: [120, 12, 153] },
  { name: "Purple", rgb: [170, 56, 185] },
  { name: "Light Purple", rgb: [224, 159, 249] },
  { name: "Dark Pink", rgb: [203, 0, 122] },
  { name: "Pink", rgb: [236, 31, 128] },
  { name: "Light Pink", rgb: [243, 141, 169] },
  { name: "Dark Brown", rgb: [104, 70, 52] },
  { name: "Brown", rgb: [149, 104, 42] },
  { name: "Beige", rgb: [248, 178, 119] },
  { name: "Medium Gray", rgb: [170, 170, 170] },
  { name: "Dark Red", rgb: [165, 14, 30] },
  { name: "Light Red", rgb: [250, 128, 114] },
  { name: "Dark Orange", rgb: [228, 92, 26] },
  { name: "Light Tan", rgb: [214, 181, 148] },
  { name: "Dark Goldenrod", rgb: [156, 132, 49] },
  { name: "Goldenrod", rgb: [197, 173, 49] },
  { name: "Light Goldenrod", rgb: [232, 212, 95] },
  { name: "Dark Olive", rgb: [74, 107, 58] },
  { name: "Olive", rgb: [90, 148, 74] },
  { name: "Light Olive", rgb: [132, 197, 115] },
  { name: "Dark Cyan", rgb: [15, 121, 159] },
  { name: "Light Cyan", rgb: [187, 250, 242] },
  { name: "Light Blue", rgb: [125, 199, 255] },
  { name: "Dark Indigo", rgb: [77, 49, 184] },
  { name: "Dark Slate Blue", rgb: [74, 66, 132] },
  { name: "Slate Blue", rgb: [122, 113, 196] },
  { name: "Light Slate Blue", rgb: [181, 174, 241] },
  { name: "Light Brown", rgb: [219, 164, 99] },
  { name: "Dark Beige", rgb: [209, 128, 81] },
  { name: "Light Beige", rgb: [255, 197, 165] },
  { name: "Dark Peach", rgb: [155, 82, 73] },
  { name: "Peach", rgb: [209, 128, 120] },
  { name: "Light Peach", rgb: [250, 182, 164] },
  { name: "Dark Tan", rgb: [123, 99, 82] },
  { name: "Tan", rgb: [156, 132, 107] },
  { name: "Dark Slate", rgb: [51, 57, 65] },
  { name: "Slate", rgb: [109, 117, 141] },
  { name: "Light Slate", rgb: [179, 185, 209] },
  { name: "Dark Stone", rgb: [109, 100, 63] },
  { name: "Stone", rgb: [148, 140, 107] },
  { name: "Light Stone", rgb: [205, 197, 158] },
];

// --- CIEDE2000 constants ---
const TWO_PI = 2 * Math.PI;
const CIEDE2000_POW7 = 6103515625; // 25^7
const CIEDE2000_C1 = 0.5235987755982988; // 30° in rad
const CIEDE2000_C2 = 0.10471975511965977; // 6° in rad
const CIEDE2000_C3 = 1.0995574287564276; // 63° in rad
const CIEDE2000_C4 = 4.799655442984406; // 275° in rad
const CIEDE2000_C5 = 0.4363323129985824; // 25° in rad

// h^6 * h (= h^7 via h^6 = (h^2)^3)
const _pow7 = (x: number): number => {
  const x2 = x * x;
  return x2 * x2 * x2 * x;
};

// atan2 normalized to [0, 2π)
const _atan2pos = (y: number, x: number): number => {
  const a = Math.atan2(y, x);
  return a < 0 ? a + TWO_PI : a;
};

// sRGB gamma to linear LUT (precomputed, same as original)
const SRGB_LUT = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const n = i / 255;
  SRGB_LUT[i] = n > 0.04045 ? Math.pow((n + 0.055) / 1.055, 2.4) : n / 12.92;
}

// RGB → CIE Lab (D65)
export const rgbToLabWplace = (rgb: RGB): Lab => {
  const r = SRGB_LUT[rgb.r];
  const g = SRGB_LUT[rgb.g];
  const b = SRGB_LUT[rgb.b];
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  x = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
};

// --- Precomputed palette tables (index = colorId) ---

// Lab values for each palette color (index 0 = Transparent, excluded from search)
const PALETTE_LAB: Array<{ idx: number; lab: Lab }> = PALETTE_COLORS.map(
  (c, i) => ({
    idx: i,
    lab: rgbToLabWplace({ r: c.rgb[0], g: c.rgb[1], b: c.rgb[2] }),
  }),
).filter((e) => e.idx !== 0);

// RGB entries for compuphase search
const PALETTE_RGB: Array<{ idx: number; rgb: RGB }> = PALETTE_COLORS.map(
  (c, i) => ({
    idx: i,
    rgb: { r: c.rgb[0], g: c.rgb[1], b: c.rgb[2] },
  }),
).filter((e) => e.idx !== 0);

// Direct-index lookup tables (sparse array by colorId)
const LAB_BY_IDX: Array<{ idx: number; lab: Lab } | undefined> = new Array(
  PALETTE_COLORS.length,
);
for (const e of PALETTE_LAB) LAB_BY_IDX[e.idx] = e;

const RGB_BY_IDX: Array<{ idx: number; rgb: RGB } | undefined> = new Array(
  PALETTE_COLORS.length,
);
for (const e of PALETTE_RGB) RGB_BY_IDX[e.idx] = e;

// --- Color distance functions ---

// CIE94-like (lab metric) distance
export const distanceLabWplace = (a: Lab, b: Lab): number => {
  const dL = a.l - b.l;
  const da = a.a - b.a;
  const db = a.b - b.b;
  const C1 = Math.sqrt(a.a * a.a + a.b * a.b);
  const C2 = Math.sqrt(b.a * b.a + b.b * b.b);
  const dC = C1 - C2;
  let dH = da * da + db * db - dC * dC;
  dH = dH < 0 ? 0 : Math.sqrt(dH);
  const SC = 1 + 0.045 * C1;
  const SH = 1 + 0.015 * C1;
  const u = dC / SC;
  const v = dH / SH;
  const M = dL * dL + u * u + v * v;
  return M < 0 ? 0 : Math.sqrt(M);
};

// CIEDE2000 distance
const distanceCiede2000 = (a: Lab, b: Lab): number => {
  const C1 = Math.sqrt(a.a * a.a + a.b * a.b);
  const C2 = Math.sqrt(b.a * b.a + b.b * b.b);
  const Cavg = (C1 + C2) * 0.5;
  const Cpow7 = _pow7(Cavg);
  const G = 0.5 * (1 - Math.sqrt(Cpow7 / (Cpow7 + CIEDE2000_POW7)));
  const a1p = (1 + G) * a.a;
  const a2p = (1 + G) * b.a;
  const C1p = Math.sqrt(a1p * a1p + a.b * a.b);
  const C2p = Math.sqrt(a2p * a2p + b.b * b.b);
  const C1pC2p = C1p * C2p;
  const h1p = C1p === 0 ? 0 : _atan2pos(a.b, a1p);
  const h2p = C2p === 0 ? 0 : _atan2pos(b.b, a2p);
  const dLp = b.l - a.l;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1pC2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > Math.PI) dhp -= TWO_PI;
    else if (dhp < -Math.PI) dhp += TWO_PI;
  }
  const dHp =
    C1pC2p === 0 ? 0 : 2 * Math.sqrt(C1pC2p) * Math.sin(dhp * 0.5);
  const Lp = (a.l + b.l) * 0.5;
  const Cp = (C1p + C2p) * 0.5;
  let hp = h1p + h2p;
  if (C1pC2p !== 0) {
    if (Math.abs(h1p - h2p) > Math.PI)
      hp = hp < TWO_PI ? (hp + TWO_PI) * 0.5 : (hp - TWO_PI) * 0.5;
    else hp *= 0.5;
  }
  const T =
    1 -
    0.17 * Math.cos(hp - CIEDE2000_C1) +
    0.24 * Math.cos(2 * hp) +
    0.32 * Math.cos(3 * hp + CIEDE2000_C2) -
    0.2 * Math.cos(4 * hp - CIEDE2000_C3);
  const q = (hp - CIEDE2000_C4) / CIEDE2000_C5;
  const d0 = CIEDE2000_C1 * Math.exp(-(q * q));
  const Cp7 = _pow7(Cp);
  const RC = 2 * Math.sqrt(Cp7 / (Cp7 + CIEDE2000_POW7));
  const Lp50 = Lp - 50;
  const SL = 1 + (0.015 * Lp50 * Lp50) / Math.sqrt(20 + Lp50 * Lp50);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;
  const RT = -Math.sin(2 * d0) * RC;
  const I =
    (dLp / SL) * (dLp / SL) +
    (dCp / SC) * (dCp / SC) +
    (dHp / SH) * (dHp / SH) +
    RT * (dCp / SC) * (dHp / SH);
  return I > 0 ? I : 0;
};

// CompuPhase weighted RGB distance
const distanceCompuphase = (a: RGB, b: RGB): number => {
  const rMean = (a.r + b.r) / 2;
  const dR = a.r - b.r;
  const dG = a.g - b.g;
  const dB = a.b - b.b;
  const wR = 2 + rMean / 256;
  const wB = 2 + (255 - rMean) / 256;
  return wR * dR * dR + 4 * dG * dG + wB * dB * dB;
};

// --- Nearest palette color search ---

const findNearestLab = (
  lab: Lab,
  distFn: (a: Lab, b: Lab) => number,
  allowedColorIdxs: number[] | undefined,
): number => {
  let bestIdx = PALETTE_LAB[0].idx;
  let bestDist = Number.MAX_VALUE;
  const useAllowed = allowedColorIdxs != null && allowedColorIdxs.length > 0;
  const count = useAllowed ? allowedColorIdxs!.length : PALETTE_LAB.length;
  for (let i = 0; i < count; i++) {
    const entry = useAllowed ? LAB_BY_IDX[allowedColorIdxs![i]] : PALETTE_LAB[i];
    if (!entry) continue;
    const d = distFn(lab, entry.lab);
    if (d < bestDist || (d === bestDist && entry.idx < bestIdx)) {
      bestIdx = entry.idx;
      bestDist = d;
    }
  }
  return bestIdx;
};

const findNearestCompuphase = (
  rgb: RGB,
  allowedColorIdxs: number[] | undefined,
): number => {
  let bestIdx = PALETTE_RGB[0].idx;
  let bestDist = Number.MAX_VALUE;
  const useAllowed = allowedColorIdxs != null && allowedColorIdxs.length > 0;
  const count = useAllowed ? allowedColorIdxs!.length : PALETTE_RGB.length;
  for (let i = 0; i < count; i++) {
    const entry = useAllowed ? RGB_BY_IDX[allowedColorIdxs![i]] : PALETTE_RGB[i];
    if (!entry) continue;
    const d = distanceCompuphase(rgb, entry.rgb);
    if (d < bestDist || (d === bestDist && entry.idx < bestIdx)) {
      bestIdx = entry.idx;
      bestDist = d;
    }
  }
  return bestIdx;
};

/**
 * Find nearest palette colorId for an RGB input.
 * Returns colorId (= index into PALETTE_COLORS).
 */
export const findNearestColorId = (
  rgb: RGB,
  metric: ColorMetric = "lab",
  allowedColorIdxs?: number[],
): number => {
  if (metric === "compuphase") return findNearestCompuphase(rgb, allowedColorIdxs);
  const lab = rgbToLabWplace(rgb);
  return findNearestLab(
    lab,
    metric === "ciede2000" ? distanceCiede2000 : distanceLabWplace,
    allowedColorIdxs,
  );
};

/**
 * Get RGBA for a colorId.
 * colorId 0 (Transparent) returns alpha=0.
 */
export const colorIdToRgba = (colorId: number): { r: number; g: number; b: number; a: number } => {
  const idx = Math.min(colorId, PALETTE_COLORS.length - 1);
  const [r, g, b] = PALETTE_COLORS[idx].rgb;
  return { r, g, b, a: idx === 0 ? 0 : 255 };
};

/**
 * Nearest-neighbor resize of ImageData (integer pixel mapping).
 * Equivalent to imageSmoothingEnabled=false drawImage.
 */
export const resizeImageDataNearest = (
  src: ImageData,
  dstWidth: number,
  dstHeight: number,
): ImageData => {
  const srcW = src.width;
  const srcH = src.height;
  const dst = new ImageData(dstWidth, dstHeight);
  const srcData = src.data;
  const dstData = dst.data;
  for (let dy = 0; dy < dstHeight; dy++) {
    const sy = Math.min(Math.floor((dy * srcH) / dstHeight), srcH - 1);
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = Math.min(Math.floor((dx * srcW) / dstWidth), srcW - 1);
      const si = (sy * srcW + sx) * 4;
      const di = (dy * dstWidth + dx) * 4;
      dstData[di] = srcData[si];
      dstData[di + 1] = srcData[si + 1];
      dstData[di + 2] = srcData[si + 2];
      dstData[di + 3] = srcData[si + 3];
    }
  }
  return dst;
};

/**
 * Apply palette quantization with optional Floyd-Steinberg dithering.
 * Mutates pixels in-place (same as original).
 *
 * @param pixels - ImageData.data (Uint8ClampedArray), mutated in-place
 * @param width
 * @param height
 * @param metric - color distance metric
 * @param dithering - enable Floyd-Steinberg dithering
 * @param allowedColorIdxs - restrict palette to these colorIds (undefined = all)
 * @param onYield - optional async yield callback for chunked processing
 */
export const quantizePixels = async (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  metric: ColorMetric,
  dithering: boolean,
  allowedColorIdxs: number[] | undefined,
  onYield?: () => Promise<void>,
  yieldIntervalMs = 16,
): Promise<void> => {
  const cache = new Map<number, number>();
  const rgb: RGB = { r: 0, g: 0, b: 0 };

  if (dithering) {
    const rowLen = width * 3;
    let errCur = new Float32Array(rowLen);
    let errNext = new Float32Array(rowLen);
    let lastYield = performance.now();

    for (let y = 0; y < height; y++) {
      const tmp = errCur;
      errCur = errNext;
      errNext = tmp;
      errNext.fill(0);

      for (let x = 0; x < width; x++) {
        const pi = (y * width + x) * 4;
        if (pixels[pi + 3] < 16) {
          pixels[pi + 3] = 0;
          continue;
        }
        const ei = x * 3;
        const qr = Math.min(Math.max(Math.round(pixels[pi] + errCur[ei]), 0), 255);
        const qg = Math.min(Math.max(Math.round(pixels[pi + 1] + errCur[ei + 1]), 0), 255);
        const qb = Math.min(Math.max(Math.round(pixels[pi + 2] + errCur[ei + 2]), 0), 255);
        const key = (qr << 16) | (qg << 8) | qb;
        let colorId = cache.get(key);
        if (colorId === undefined) {
          rgb.r = qr;
          rgb.g = qg;
          rgb.b = qb;
          colorId = findNearestColorId(rgb, metric, allowedColorIdxs);
          cache.set(key, colorId);
        }
        const mapped = colorIdToRgba(colorId);
        pixels[pi] = mapped.r;
        pixels[pi + 1] = mapped.g;
        pixels[pi + 2] = mapped.b;
        pixels[pi + 3] = mapped.a;
        const er = qr - mapped.r;
        const eg = qg - mapped.g;
        const eb = qb - mapped.b;
        if (x + 1 < width) {
          const ni = (x + 1) * 3;
          errCur[ni] += er * (7 / 16);
          errCur[ni + 1] += eg * (7 / 16);
          errCur[ni + 2] += eb * (7 / 16);
        }
        if (y + 1 < height) {
          if (x > 0) {
            const pi2 = (x - 1) * 3;
            errNext[pi2] += er * (3 / 16);
            errNext[pi2 + 1] += eg * (3 / 16);
            errNext[pi2 + 2] += eb * (3 / 16);
          }
          errNext[ei] += er * (5 / 16);
          errNext[ei + 1] += eg * (5 / 16);
          errNext[ei + 2] += eb * (5 / 16);
          if (x + 1 < width) {
            const ni = (x + 1) * 3;
            errNext[ni] += er * (1 / 16);
            errNext[ni + 1] += eg * (1 / 16);
            errNext[ni + 2] += eb * (1 / 16);
          }
        }
      }

      if (onYield && performance.now() - lastYield >= yieldIntervalMs) {
        await onYield();
        lastYield = performance.now();
      }
    }
  } else {
    let lastYield = performance.now();

    for (let y = 0; y < height; y++) {
      const rowOff = y * width * 4;
      for (let x = 0; x < width; x++) {
        const pi = rowOff + x * 4;
        if (pixels[pi + 3] < 16) {
          pixels[pi + 3] = 0;
          continue;
        }
        const key = (pixels[pi] << 16) | (pixels[pi + 1] << 8) | pixels[pi + 2];
        let colorId = cache.get(key);
        if (colorId === undefined) {
          rgb.r = pixels[pi];
          rgb.g = pixels[pi + 1];
          rgb.b = pixels[pi + 2];
          colorId = findNearestColorId(rgb, metric, allowedColorIdxs);
          cache.set(key, colorId);
        }
        const mapped = colorIdToRgba(colorId);
        pixels[pi] = mapped.r;
        pixels[pi + 1] = mapped.g;
        pixels[pi + 2] = mapped.b;
        pixels[pi + 3] = mapped.a;
      }

      if (onYield && performance.now() - lastYield >= yieldIntervalMs) {
        await onYield();
        lastYield = performance.now();
      }
    }
  }
};
