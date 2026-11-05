import { colorpalette } from "@/constants/colors";
import { distanceLabWplace, rgbToLabWplace } from "@/utils/color-quantize";
import {
  clampByte,
  colorDistPerceptualEuclidean2,
  colorDistRgbEuclidean2,
  colorDistWeightedRgb2,
  isPerceptualQuantizationMethod,
  rgbToPerceptualColor,
} from "./color-utils";
import type {
  DitheringMethod,
  QuantizationMethod,
  RgbColor,
} from "./types";
import { DEFAULT_QUANTIZATION_METHOD } from "./types";

const BAYER_MATRIX_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((value) => value / 16 - 0.5));

const getPaletteColors = (selectedColorIds: number[]): RgbColor[] =>
  colorpalette.filter((color) => selectedColorIds.includes(color.id)).map((color) => color.rgb);

type NearestColorFinder = (r: number, g: number, b: number) => RgbColor;

const createNearestFinderInSpace = <T>(
  rgbList: RgbColor[],
  toSpace: (r: number, g: number, b: number) => T,
  distance: (a: T, b: T) => number
): NearestColorFinder => {
  const palette = rgbList.map(([r, g, b]) => toSpace(r, g, b));

  return (r: number, g: number, b: number): RgbColor => {
    const source = toSpace(r, g, b);
    let minDist = Infinity;
    let nearest = rgbList[0];
    for (let i = 0; i < rgbList.length; i++) {
      const dist = distance(source, palette[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = rgbList[i];
      }
    }
    return nearest;
  };
};

// 入力RGBを丸めて探索結果をキャッシュする
// lab-wplace 専用: rgbToLabWplace は整数indexのLUT参照で、ディザ由来の小数だと NaN になり rgbList[0] 固定になる
// (他方式は小数のまま計算できるので、ディザ結果を変えないよう適用しない)
const withRoundedCache = (find: NearestColorFinder): NearestColorFinder => {
  const cache = new Map<number, RgbColor>();
  return (r: number, g: number, b: number): RgbColor => {
    const ri = Math.round(r);
    const gi = Math.round(g);
    const bi = Math.round(b);
    const key = (ri << 16) | (gi << 8) | bi;
    const cached = cache.get(key);
    if (cached) return cached;
    const nearest = find(ri, gi, bi);
    cache.set(key, nearest);
    return nearest;
  };
};

const toRgbTuple = (r: number, g: number, b: number): RgbColor => [r, g, b];

const createMethodFinder = (
  rgbList: RgbColor[],
  method: QuantizationMethod
): NearestColorFinder => {
  if (method === "lab-wplace") {
    return withRoundedCache(
      createNearestFinderInSpace(
        rgbList,
        (r, g, b) => rgbToLabWplace({ r, g, b }),
        distanceLabWplace
      )
    );
  }
  if (isPerceptualQuantizationMethod(method)) {
    return createNearestFinderInSpace(
      rgbList,
      (r, g, b) => rgbToPerceptualColor(method, r, g, b),
      colorDistPerceptualEuclidean2
    );
  }
  const rgbDist =
    method === "weighted-rgb" ? colorDistWeightedRgb2 : colorDistRgbEuclidean2;
  return createNearestFinderInSpace(rgbList, toRgbTuple, (a, b) =>
    rgbDist(a[0], a[1], a[2], b[0], b[1], b[2])
  );
};

const createNearestColorFinder = (
  selectedColorIds: number[],
  method: QuantizationMethod
): NearestColorFinder | null => {
  const rgbList = getPaletteColors(selectedColorIds);
  if (rgbList.length === 0) return null;
  return createMethodFinder(rgbList, method);
};

export const quantizeToColorPalette = (
  imageData: ImageData,
  selectedColorIds: number[],
  method: QuantizationMethod = DEFAULT_QUANTIZATION_METHOD
): void => {
  const findNearestColor = createNearestColorFinder(selectedColorIds, method);
  if (!findNearestColor) return;

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) {
      data[i + 3] = 0;
      continue;
    }

    const nearest = findNearestColor(data[i], data[i + 1], data[i + 2]);
    data[i] = nearest[0];
    data[i + 1] = nearest[1];
    data[i + 2] = nearest[2];
    data[i + 3] = 255;
  }
};

export const quantizeWithDithering = (
  imageData: ImageData,
  selectedColorIds: number[],
  ditheringThreshold: number,
  method: QuantizationMethod = DEFAULT_QUANTIZATION_METHOD,
  ditheringMethod: DitheringMethod = "ordered"
): void => {
  const findNearestColor = createNearestColorFinder(selectedColorIds, method);
  if (!findNearestColor) return;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  if (ditheringMethod === "floyd-steinberg") {
    const working = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) working[i] = data[i];

    const errorScale = Math.max(0, Math.min(1, ditheringThreshold / 1000));
    const diffuseError = (
      x: number,
      y: number,
      dr: number,
      dg: number,
      db: number,
      weight: number
    ): void => {
      if (x < 0 || x >= width || y < 0 || y >= height) return;

      const idx = (y * width + x) * 4;
      if (working[idx + 3] < 128) return;

      working[idx] = clampByte(working[idx] + dr * weight);
      working[idx + 1] = clampByte(working[idx + 1] + dg * weight);
      working[idx + 2] = clampByte(working[idx + 2] + db * weight);
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = working[idx + 3];
        if (alpha < 128) {
          data[idx + 3] = 0;
          continue;
        }

        const r = clampByte(working[idx]);
        const g = clampByte(working[idx + 1]);
        const b = clampByte(working[idx + 2]);
        const nearest = findNearestColor(r, g, b);

        data[idx] = nearest[0];
        data[idx + 1] = nearest[1];
        data[idx + 2] = nearest[2];
        data[idx + 3] = 255;

        const dr = (r - nearest[0]) * errorScale;
        const dg = (g - nearest[1]) * errorScale;
        const db = (b - nearest[2]) * errorScale;

        diffuseError(x + 1, y, dr, dg, db, 7 / 16);
        diffuseError(x - 1, y + 1, dr, dg, db, 3 / 16);
        diffuseError(x, y + 1, dr, dg, db, 5 / 16);
        diffuseError(x + 1, y + 1, dr, dg, db, 1 / 16);
      }
    }
    return;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      if (alpha < 128) {
        data[idx + 3] = 0;
        continue;
      }

      const ditherAmount = BAYER_MATRIX_4X4[y % 4][x % 4] * (ditheringThreshold / 10);
      const nearest = findNearestColor(
        clampByte(data[idx] + ditherAmount),
        clampByte(data[idx + 1] + ditherAmount),
        clampByte(data[idx + 2] + ditherAmount)
      );

      data[idx] = nearest[0];
      data[idx + 1] = nearest[1];
      data[idx + 2] = nearest[2];
      data[idx + 3] = 255;
    }
  }
};

export const applyTransparentColors = (
  imageData: ImageData,
  transparentColors: Set<string>
): void => {
  if (transparentColors.size === 0) return;

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    if (transparentColors.has(key)) data[i + 3] = 0;
  }
};
