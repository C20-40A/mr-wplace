import { expect, test } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";
import {
  hasOnlyBinaryAlpha,
  renderSimpleOverlayAt1x,
  type SimpleOverlayMode,
} from "../src/inject/features/tile-draw/image-processing/render-dot-cross";

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

const renderLegacyDotCrossAt3x = (options: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  bgData: Uint8ClampedArray;
  bgWidth: number;
  offsetX: number;
  offsetY: number;
  skipBackgroundComparison: boolean;
  mode: SimpleOverlayMode;
}): Uint8ClampedArray => {
  const {
    data, width, height, bgData, bgWidth, offsetX, offsetY,
    skipBackgroundComparison, mode,
  } = options;
  const scaledWidth = width * SCALE;
  const output = new Uint8ClampedArray(scaledWidth * height * SCALE * 4);
  const write = (x: number, y: number, srcI: number): void => {
    const dstI = (y * scaledWidth + x) * 4;
    output[dstI] = data[srcI];
    output[dstI + 1] = data[srcI + 1];
    output[dstI + 2] = data[srcI + 2];
    output[dstI + 3] = data[srcI + 3];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcI = (y * width + x) * 4;
      if (data[srcI + 3] === 0) continue;
      if (!skipBackgroundComparison) {
        const bgI = ((offsetY + y) * bgWidth + offsetX + x) * 4;
        if (bgI + 3 >= bgData.length) continue;
        const matches =
          bgData[bgI + 3] > 0 &&
          data[srcI] === bgData[bgI] &&
          data[srcI + 1] === bgData[bgI + 1] &&
          data[srcI + 2] === bgData[bgI + 2];
        if (matches) continue;
      }

      const centerX = x * SCALE + 1;
      const centerY = y * SCALE + 1;
      write(centerX, centerY, srcI);
      if (mode === "cross") {
        write(centerX, centerY - 1, srcI);
        write(centerX - 1, centerY, srcI);
        write(centerX + 1, centerY, srcI);
        write(centerX, centerY + 1, srcI);
      }
    }
  }
  return output;
};

const expandSimpleAt3x = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mode: SimpleOverlayMode,
): Uint8ClampedArray => renderLegacyDotCrossAt3x({
  data,
  width,
  height,
  bgData: new Uint8ClampedArray(0),
  bgWidth: 0,
  offsetX: 0,
  offsetY: 0,
  skipBackgroundComparison: true,
  mode,
});

test("binary-alpha gate preserves semi-transparent tiles on the legacy path", () => {
  expect(hasOnlyBinaryAlpha(new Uint8ClampedArray([1, 2, 3, 0, 4, 5, 6, 255])))
    .toBe(true);
  expect(hasOnlyBinaryAlpha(new Uint8ClampedArray([1, 2, 3, 127])))
    .toBe(false);
});

test("dot/cross x1 masking matches every legacy x3 RGBA byte", () => {
  const width = 11;
  const height = 7;
  const bgWidth = 15;
  const bgHeight = 12;
  for (let seed = 1; seed <= 40; seed++) {
    const data = createBytes(width * height * 4, seed);
    const bgData = createBytes(bgWidth * bgHeight * 4, seed * 31);
    for (let p = 0; p < width * height; p += 5) {
      const srcI = p * 4;
      const x = p % width;
      const y = Math.floor(p / width);
      const bgI = ((y + 1) * bgWidth + x + 2) * 4;
      bgData.set(data.subarray(srcI, srcI + 4), bgI);
      bgData[bgI + 3] = 255;
      if (p % 10 === 0) data[srcI + 3] = 0;
    }

    for (const mode of ["dot", "cross"] as const) {
      for (const [offsetX, offsetY] of [[2, 1], [-1, 0], [13, 10]]) {
        for (const skipBackgroundComparison of [false, true]) {
          const options = {
            data, width, height, bgData, bgWidth, offsetX, offsetY,
            skipBackgroundComparison,
          };
          const legacy = renderLegacyDotCrossAt3x({ ...options, mode });
          const fast = expandSimpleAt3x(
            renderSimpleOverlayAt1x(options), width, height, mode,
          );
          expect(fast).toEqual(legacy);
        }
      }
    }
  }
});

test("GPU dot/cross expansion matches legacy composited RGBA bytes", async ({ page }) => {
  const bundle = await build({
    entryPoints: [path.resolve("src/inject/features/tile-draw/image-processing/render-dot-cross.ts")],
    bundle: true,
    format: "iife",
    globalName: "DotCrossRenderer",
    write: false,
  });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });

  const mismatch = await page.evaluate(async () => {
    type Renderer = {
      renderDotCrossBitmap: (
        data: Uint8ClampedArray,
        width: number,
        height: number,
        mode: "dot" | "cross",
      ) => ImageBitmap;
    };
    const renderer = (window as typeof window & { DotCrossRenderer: Renderer })
      .DotCrossRenderer;
    let state = 0x5eed1234;
    const randomByte = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state >>> 24;
    };
    const createRandom = (length: number): Uint8ClampedArray => {
      const data = new Uint8ClampedArray(length);
      for (let i = 0; i < length; i++) data[i] = randomByte();
      return data;
    };
    const expand = (
      source: Uint8ClampedArray,
      width: number,
      height: number,
      mode: "dot" | "cross",
    ): Uint8ClampedArray => {
      const scaledWidth = width * 3;
      const output = new Uint8ClampedArray(scaledWidth * height * 3 * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcI = (y * width + x) * 4;
          if (source[srcI + 3] === 0) continue;
          for (let dy = 0; dy < 3; dy++) {
            for (let dx = 0; dx < 3; dx++) {
              const visible = mode === "dot"
                ? dx === 1 && dy === 1
                : dx === 1 || dy === 1;
              if (!visible) continue;
              const dstI = ((y * 3 + dy) * scaledWidth + x * 3 + dx) * 4;
              output.set(source.subarray(srcI, srcI + 4), dstI);
            }
          }
        }
      }
      return output;
    };

    for (const [width, height] of [[17, 13], [9, 21], [17, 13]]) {
      for (const mode of ["dot", "cross"] as const) {
        for (let caseIndex = 0; caseIndex < 12; caseIndex++) {
          const source = createRandom(width * height * 4);
          for (let p = 0; p < width * height; p++) {
            source[p * 4 + 3] = source[p * 4 + 3] < 128 ? 0 : 255;
          }
          for (let p = caseIndex; p < width * height; p += 9) {
            source[p * 4 + 3] = p % 2 === 0 ? 0 : 255;
          }
          const scaledWidth = width * 3;
          const scaledHeight = height * 3;
          const oldCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
          const newCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
          const oldContext = oldCanvas.getContext("2d")!;
          const newContext = newCanvas.getContext("2d")!;
          const background = createRandom(scaledWidth * scaledHeight * 4);
          oldContext.putImageData(
            new ImageData(background.slice(), scaledWidth, scaledHeight), 0, 0,
          );
          newContext.putImageData(
            new ImageData(background.slice(), scaledWidth, scaledHeight), 0, 0,
          );
          const legacyBitmap = await createImageBitmap(
            new ImageData(expand(source, width, height, mode), scaledWidth, scaledHeight),
          );
          const fastBitmap = renderer.renderDotCrossBitmap(source, width, height, mode);
          oldContext.drawImage(legacyBitmap, 0, 0);
          newContext.drawImage(fastBitmap, 0, 0);
          legacyBitmap.close();
          fastBitmap.close();
          const oldData = oldContext.getImageData(0, 0, scaledWidth, scaledHeight).data;
          const newData = newContext.getImageData(0, 0, scaledWidth, scaledHeight).data;
          for (let i = 0; i < oldData.length; i++) {
            if (oldData[i] !== newData[i]) {
              return {
                width, height, mode, caseIndex, byteIndex: i,
                oldValue: oldData[i], newValue: newData[i],
              };
            }
          }
        }
      }
    }
    return null;
  });
  expect(mismatch).toBeNull();
});
