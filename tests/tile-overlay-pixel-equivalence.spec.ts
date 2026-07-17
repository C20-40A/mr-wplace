import { expect, test } from "@playwright/test";
import { renderFillAt1x } from "../src/inject/features/tile-draw/image-processing/render-fill";

const SCALE = 3;

const createBytes = (length: number, seed: number): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(length);
  let state = seed >>> 0;
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = state >>> 24;
  }
  return data;
};

const renderLegacyFillAt3x = (options: {
  data: Uint8ClampedArray;
  comparisonData: Uint8ClampedArray | null;
  width: number;
  height: number;
  bgData: Uint8ClampedArray;
  bgWidth: number;
  offsetX: number;
  offsetY: number;
  skipBackgroundComparison: boolean;
  showUnplacedOnly: boolean;
  showUnplacedColor: readonly [number, number, number];
}): Uint8ClampedArray => {
  const {
    data,
    comparisonData,
    width,
    height,
    bgData,
    bgWidth,
    offsetX,
    offsetY,
    skipBackgroundComparison,
    showUnplacedOnly,
    showUnplacedColor,
  } = options;
  const scaledWidth = width * SCALE;
  const output = new Uint8ClampedArray(
    scaledWidth * height * SCALE * 4,
  );
  const useOriginalComparison = showUnplacedOnly && comparisonData !== null;

  const writeCell = (
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void => {
    for (let cellY = 0; cellY < SCALE; cellY++) {
      for (let cellX = 0; cellX < SCALE; cellX++) {
        const i = (((y * SCALE + cellY) * scaledWidth) + x * SCALE + cellX) * 4;
        output[i] = r;
        output[i + 1] = g;
        output[i + 2] = b;
        output[i + 3] = a;
      }
    }
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcI = (y * width + x) * 4;
      const r = data[srcI];
      const g = data[srcI + 1];
      const b = data[srcI + 2];
      const a = data[srcI + 3];
      if (!useOriginalComparison && a === 0) continue;

      const cmpR = useOriginalComparison ? comparisonData[srcI] : r;
      const cmpG = useOriginalComparison ? comparisonData[srcI + 1] : g;
      const cmpB = useOriginalComparison ? comparisonData[srcI + 2] : b;
      const cmpA = useOriginalComparison ? comparisonData[srcI + 3] : a;
      if (cmpA === 0) continue;

      let colorMatches = false;
      if (!skipBackgroundComparison) {
        const bgI = ((offsetY + y) * bgWidth + offsetX + x) * 4;
        if (bgI + 3 >= bgData.length) continue;
        colorMatches =
          bgData[bgI + 3] > 0 &&
          cmpR === bgData[bgI] &&
          cmpG === bgData[bgI + 1] &&
          cmpB === bgData[bgI + 2];
      }

      if (colorMatches && !showUnplacedOnly) continue;
      if (showUnplacedOnly && colorMatches) {
        writeCell(
          x,
          y,
          (showUnplacedColor[0] * 224 + cmpR * 32) >> 8,
          (showUnplacedColor[1] * 224 + cmpG * 32) >> 8,
          (showUnplacedColor[2] * 224 + cmpB * 32) >> 8,
          255,
        );
        continue;
      }

      if (a === 0) continue;
      writeCell(x, y, r, g, b, a);
    }
  }

  return output;
};

const expandAt3x = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray => {
  const output = new Uint8ClampedArray(width * height * SCALE * SCALE * 4);
  const scaledWidth = width * SCALE;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcI = (y * width + x) * 4;
      for (let cellY = 0; cellY < SCALE; cellY++) {
        for (let cellX = 0; cellX < SCALE; cellX++) {
          const dstI = (((y * SCALE + cellY) * scaledWidth) + x * SCALE + cellX) * 4;
          output.set(data.subarray(srcI, srcI + 4), dstI);
        }
      }
    }
  }
  return output;
};

test("fill x1 renderer matches the legacy x3 RGBA output", () => {
  const width = 7;
  const height = 5;
  const bgWidth = 10;
  const bgHeight = 9;

  for (let seed = 1; seed <= 40; seed++) {
    const data = createBytes(width * height * 4, seed);
    const comparisonData = createBytes(width * height * 4, seed * 17);
    const bgData = createBytes(bgWidth * bgHeight * 4, seed * 31);

    // 一致画素と完全透明画素を必ず含める。
    for (let p = 0; p < width * height; p += 5) {
      const srcI = p * 4;
      const x = p % width;
      const y = Math.floor(p / width);
      const bgI = ((y + 1) * bgWidth + x + 1) * 4;
      bgData.set(comparisonData.subarray(srcI, srcI + 4), bgI);
      bgData[bgI + 3] = 255;
      if (p % 10 === 0) data[srcI + 3] = 0;
    }

    for (const [offsetX, offsetY] of [[1, 1], [-1, 0], [8, 7]]) {
      for (const showUnplacedOnly of [false, true]) {
        for (const skipBackgroundComparison of [false, true]) {
          const options = {
            data,
            comparisonData: showUnplacedOnly ? comparisonData : null,
            width,
            height,
            bgData,
            bgWidth,
            offsetX,
            offsetY,
            skipBackgroundComparison,
            showUnplacedOnly,
            showUnplacedColor: [37, 149, 231] as const,
          };
          const legacy = renderLegacyFillAt3x(options);
          const fast = expandAt3x(renderFillAt1x(options), width, height);
          expect(fast).toEqual(legacy);
        }
      }
    }
  }
});

test("nearest-neighbor scaling preserves every composited RGBA byte", async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const width = 17;
    const height = 13;
    const scale = 3;
    const canvasWidth = 72;
    const canvasHeight = 60;
    let state = 0x12345678;
    const randomByte = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state >>> 24;
    };
    const createRandom = (length: number): Uint8ClampedArray => {
      const data = new Uint8ClampedArray(length);
      for (let i = 0; i < length; i++) data[i] = randomByte();
      return data;
    };
    const expand = (source: Uint8ClampedArray): Uint8ClampedArray => {
      const output = new Uint8ClampedArray(width * height * scale * scale * 4);
      const scaledWidth = width * scale;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcI = (y * width + x) * 4;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const dstI = (((y * scale + dy) * scaledWidth) + x * scale + dx) * 4;
              output.set(source.subarray(srcI, srcI + 4), dstI);
            }
          }
        }
      }
      return output;
    };

    for (let caseIndex = 0; caseIndex < 20; caseIndex++) {
      const oldCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const newCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const oldCtx = oldCanvas.getContext("2d")!;
      const newCtx = newCanvas.getContext("2d")!;
      oldCtx.imageSmoothingEnabled = false;
      newCtx.imageSmoothingEnabled = false;
      const background = createRandom(canvasWidth * canvasHeight * 4);
      oldCtx.putImageData(new ImageData(background.slice(), canvasWidth, canvasHeight), 0, 0);
      newCtx.putImageData(new ImageData(background.slice(), canvasWidth, canvasHeight), 0, 0);

      for (let layer = 0; layer < 3; layer++) {
        const source = createRandom(width * height * 4);
        for (let p = layer; p < width * height; p += 11)
          source[p * 4 + 3] = p % 2 === 0 ? 0 : 255;
        const oldBitmap = await createImageBitmap(
          new ImageData(expand(source), width * scale, height * scale),
        );
        const newBitmap = await createImageBitmap(
          new ImageData(source, width, height),
        );
        const x = layer * 6;
        const y = layer * 3;
        oldCtx.drawImage(oldBitmap, x, y);
        newCtx.drawImage(newBitmap, x, y, width * scale, height * scale);
        oldBitmap.close();
        newBitmap.close();
      }

      const oldData = oldCtx.getImageData(0, 0, canvasWidth, canvasHeight).data;
      const newData = newCtx.getImageData(0, 0, canvasWidth, canvasHeight).data;
      for (let i = 0; i < oldData.length; i++) {
        if (oldData[i] !== newData[i]) {
          return {
            caseIndex,
            byteIndex: i,
            oldValue: oldData[i],
            newValue: newData[i],
          };
        }
      }
    }

    return null;
  });

  expect(result).toBeNull();
});
