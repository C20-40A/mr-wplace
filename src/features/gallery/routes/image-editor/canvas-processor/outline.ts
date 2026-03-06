import { createResizedImageBitmap } from "@/utils/image-bitmap-compat";
import type { OutlinePreserveOptions } from "./types";

const parseHexColor = (hex: string): [number, number, number] | null => {
  const normalized = hex.trim().toLowerCase();
  const match = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return null;
  const value = match[1];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
};

const removeIsolatedMaskPixels = (
  sourceMask: Uint8Array,
  width: number,
  height: number,
  minNeighbors = 2
): Uint8Array => {
  const cleaned = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (!sourceMask[idx]) continue;

      let neighbors = 0;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          if (nx === x && ny === y) continue;
          if (sourceMask[ny * width + nx]) neighbors++;
        }
      }

      if (neighbors >= minNeighbors) cleaned[idx] = 1;
    }
  }
  return cleaned;
};

const filterSmallMaskComponents = (
  sourceMask: Uint8Array,
  width: number,
  height: number,
  minArea: number
): Uint8Array => {
  if (minArea <= 1) return sourceMask;

  const result = new Uint8Array(sourceMask);
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);

  for (let i = 0; i < sourceMask.length; i++) {
    if (!sourceMask[i] || visited[i]) continue;

    let head = 0;
    let tail = 0;
    const members: number[] = [];
    queue[tail++] = i;
    visited[i] = 1;

    while (head < tail) {
      const idx = queue[head++];
      members.push(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);

      if (x > 0) {
        const left = idx - 1;
        if (sourceMask[left] && !visited[left]) {
          visited[left] = 1;
          queue[tail++] = left;
        }
      }
      if (x + 1 < width) {
        const right = idx + 1;
        if (sourceMask[right] && !visited[right]) {
          visited[right] = 1;
          queue[tail++] = right;
        }
      }
      if (y > 0) {
        const up = idx - width;
        if (sourceMask[up] && !visited[up]) {
          visited[up] = 1;
          queue[tail++] = up;
        }
      }
      if (y + 1 < height) {
        const down = idx + width;
        if (sourceMask[down] && !visited[down]) {
          visited[down] = 1;
          queue[tail++] = down;
        }
      }
    }

    if (members.length < minArea) {
      for (let j = 0; j < members.length; j++) {
        result[members[j]] = 0;
      }
    }
  }

  return result;
};

const createInkLineMask = (
  sourceData: Uint8ClampedArray,
  width: number,
  height: number,
  sensitivity: number
): Uint8Array => {
  const pixelCount = width * height;
  const luma = new Float32Array(pixelCount);
  const chroma = new Float32Array(pixelCount);
  const valid = new Uint8Array(pixelCount);
  const rawMask = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    if (sourceData[offset + 3] < 128) continue;
    const r = sourceData[offset];
    const g = sourceData[offset + 1];
    const b = sourceData[offset + 2];
    luma[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    chroma[i] = Math.max(r, g, b) - Math.min(r, g, b);
    valid[i] = 1;
  }

  const s = Math.max(0, Math.min(200, sensitivity)) / 100;
  const darkLumaMax = Math.min(255, 72 + s * 120);
  const gradientMin = Math.max(0, 70 - s * 62);
  const contrastMin = Math.max(0, 36 - s * 30);
  const localSlack = Math.max(0, 10 - s * 6);
  const axisContrastMin = Math.max(3, contrastMin * 0.55);
  const chromaMax = Math.max(24, 72 - s * 18);
  const minComponentArea = s >= 1.4 ? 2 : 3;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      if (!valid[idx]) continue;

      const center = luma[idx];
      if (center > darkLumaMax) continue;
      if (center > 32 && chroma[idx] > chromaMax) continue;

      const leftIdx = x > 0 ? idx - 1 : idx;
      const rightIdx = x + 1 < width ? idx + 1 : idx;
      const upIdx = y > 0 ? idx - width : idx;
      const downIdx = y + 1 < height ? idx + width : idx;

      const left = valid[leftIdx] ? luma[leftIdx] : center;
      const right = valid[rightIdx] ? luma[rightIdx] : center;
      const up = valid[upIdx] ? luma[upIdx] : center;
      const down = valid[downIdx] ? luma[downIdx] : center;
      const gradient = Math.abs(right - left) + Math.abs(down - up);

      let neighborCount = 0;
      let neighborSum = 0;
      let minNeighbor = Infinity;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        const nyOffset = ny * width;
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          if (nx === x && ny === y) continue;
          const nIdx = nyOffset + nx;
          if (!valid[nIdx]) continue;
          const nLuma = luma[nIdx];
          neighborCount++;
          neighborSum += nLuma;
          if (nLuma < minNeighbor) minNeighbor = nLuma;
        }
      }

      if (neighborCount === 0) continue;
      const neighborMean = neighborSum / neighborCount;
      const hasContrast = neighborMean - center >= contrastMin;
      const isLocalMinimum = center <= minNeighbor + localSlack;
      const axisSupported =
        (left - center >= axisContrastMin && right - center >= axisContrastMin) ||
        (up - center >= axisContrastMin && down - center >= axisContrastMin);

      if (isLocalMinimum && (axisSupported || (hasContrast && gradient >= gradientMin))) {
        rawMask[idx] = 1;
      }
    }
  }

  const isolatedRemoved = removeIsolatedMaskPixels(rawMask, width, height);
  const componentFiltered = filterSmallMaskComponents(
    isolatedRemoved,
    width,
    height,
    minComponentArea
  );

  return removeIsolatedMaskPixels(componentFiltered, width, height, 1);
};

const dilateMask = (
  sourceMask: Uint8Array,
  width: number,
  height: number,
  iterations: number
): Uint8Array => {
  if (iterations <= 0) return sourceMask;

  let current: Uint8Array<ArrayBufferLike> = sourceMask;
  let next: Uint8Array<ArrayBufferLike> = new Uint8Array(width * height);

  for (let step = 0; step < iterations; step++) {
    next.fill(0);
    for (let y = 0; y < height; y++) {
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        if (!current[idx]) continue;
        next[idx] = 1;
        if (x > 0) next[idx - 1] = 1;
        if (x + 1 < width) next[idx + 1] = 1;
        if (y > 0) next[idx - width] = 1;
        if (y + 1 < height) next[idx + width] = 1;
      }
    }

    const temp = current;
    current = next;
    next = temp;
  }

  return current;
};

export const createOutlinePreservedBitmap = async (
  source: HTMLImageElement,
  scale: number,
  options: OutlinePreserveOptions
): Promise<ImageBitmap> => {
  const sourceWidth = source.naturalWidth;
  const sourceHeight = source.naturalHeight;
  const targetWidth = Math.max(1, Math.floor(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.floor(sourceHeight * scale));

  const resizedBitmap = await createResizedImageBitmap(source, {
    width: targetWidth,
    height: targetHeight,
    quality: "pixelated",
  });

  if (!options.enabled || scale >= 1 || sourceWidth < 2 || sourceHeight < 2) {
    return resizedBitmap;
  }

  const sourceCanvas = new OffscreenCanvas(sourceWidth, sourceHeight);
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return resizedBitmap;

  sourceCtx.drawImage(source, 0, 0);
  const sourceImage = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight);
  const sourcePixels = sourceImage.data;

  const sensitivity = Math.max(0, Math.min(200, options.threshold));
  const baseMask = createInkLineMask(sourcePixels, sourceWidth, sourceHeight, sensitivity);
  const dilatedMask = dilateMask(
    baseMask,
    sourceWidth,
    sourceHeight,
    Math.max(0, Math.round(options.width) - 1)
  );
  const fixedColor = options.useFixedColor ? parseHexColor(options.fixedColor) : null;

  const composedCanvas = new OffscreenCanvas(targetWidth, targetHeight);
  const composedCtx = composedCanvas.getContext("2d");
  if (!composedCtx) return resizedBitmap;

  composedCtx.drawImage(resizedBitmap, 0, 0);
  const targetImage = composedCtx.getImageData(0, 0, targetWidth, targetHeight);
  const targetPixels = targetImage.data;

  for (let y = 0; y < targetHeight; y++) {
    const sy = Math.min(sourceHeight - 1, Math.floor((y * sourceHeight) / targetHeight));
    for (let x = 0; x < targetWidth; x++) {
      const sx = Math.min(sourceWidth - 1, Math.floor((x * sourceWidth) / targetWidth));
      const sourceIdx = sy * sourceWidth + sx;
      if (!dilatedMask[sourceIdx]) continue;

      const sourceOffset = sourceIdx * 4;
      if (sourcePixels[sourceOffset + 3] < 128) continue;

      const targetOffset = (y * targetWidth + x) * 4;
      if (fixedColor) {
        targetPixels[targetOffset] = fixedColor[0];
        targetPixels[targetOffset + 1] = fixedColor[1];
        targetPixels[targetOffset + 2] = fixedColor[2];
      } else {
        targetPixels[targetOffset] = sourcePixels[sourceOffset];
        targetPixels[targetOffset + 1] = sourcePixels[sourceOffset + 1];
        targetPixels[targetOffset + 2] = sourcePixels[sourceOffset + 2];
      }
      targetPixels[targetOffset + 3] = 255;
    }
  }

  composedCtx.putImageData(targetImage, 0, 0);
  resizedBitmap.close();
  return createImageBitmap(composedCanvas, { premultiplyAlpha: "none" });
};
