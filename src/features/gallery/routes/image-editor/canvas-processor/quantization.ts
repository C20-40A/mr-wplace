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
  PerceptualQuantizationMethod,
  QuantizationMethod,
  RgbColor,
} from "./types";

const BAYER_MATRIX_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((value) => value / 16 - 0.5));

const getPaletteColors = (selectedColorIds: number[]): RgbColor[] =>
  colorpalette.filter((color) => selectedColorIds.includes(color.id)).map((color) => color.rgb);

const createPerceptualNearestColorFinder = (
  rgbList: RgbColor[],
  method: PerceptualQuantizationMethod
): ((r: number, g: number, b: number) => RgbColor) => {
  const palettePerceptual = rgbList.map(([r, g, b]) =>
    rgbToPerceptualColor(method, r, g, b)
  );

  return (r: number, g: number, b: number): RgbColor => {
    const sourcePerceptual = rgbToPerceptualColor(method, r, g, b);
    let minDist = Infinity;
    let nearest = rgbList[0];

    for (let i = 0; i < rgbList.length; i++) {
      const dist = colorDistPerceptualEuclidean2(
        sourcePerceptual,
        palettePerceptual[i]
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = rgbList[i];
      }
    }

    return nearest;
  };
};

const createLabWplaceNearestColorFinder = (
  rgbList: RgbColor[]
): ((r: number, g: number, b: number) => RgbColor) => {
  const paletteLab = rgbList.map(([r, g, b]) => rgbToLabWplace({ r, g, b }));

  return (r: number, g: number, b: number): RgbColor => {
    const srcLab = rgbToLabWplace({ r, g, b });
    let minDist = Infinity;
    let nearest = rgbList[0];
    for (let i = 0; i < rgbList.length; i++) {
      const dist = distanceLabWplace(srcLab, paletteLab[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = rgbList[i];
      }
    }
    return nearest;
  };
};

const createNearestColorFinder = (
  selectedColorIds: number[],
  method: QuantizationMethod
): ((r: number, g: number, b: number) => RgbColor) | null => {
  const rgbList = getPaletteColors(selectedColorIds);
  if (rgbList.length === 0) return null;
  if (method === "lab-wplace") return createLabWplaceNearestColorFinder(rgbList);
  if (isPerceptualQuantizationMethod(method)) {
    return createPerceptualNearestColorFinder(rgbList, method);
  }

  const colorDistFn =
    method === "weighted-rgb" ? colorDistWeightedRgb2 : colorDistRgbEuclidean2;

  return (r: number, g: number, b: number): RgbColor => {
    let minDist = Infinity;
    let nearest = rgbList[0];

    for (let i = 0; i < rgbList.length; i++) {
      const color = rgbList[i];
      const dist = colorDistFn(r, g, b, color[0], color[1], color[2]);
      if (dist < minDist) {
        minDist = dist;
        nearest = color;
      }
    }

    return nearest;
  };
};

export const quantizeToColorPalette = (
  imageData: ImageData,
  selectedColorIds: number[],
  method: QuantizationMethod = "rgb-euclidean"
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
  method: QuantizationMethod = "rgb-euclidean",
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
