import { expect, test } from "@playwright/test";
import {
  rasterizeDraftLine,
  type DraftLineSettings,
  type DraftLineShape,
} from "../src/inject/features/draft-draw/draft-line";

const white = { r: 255, g: 255, b: 255 };
const yellow = { r: 249, g: 221, b: 59 };

const rasterize = (shape: DraftLineShape, settings: DraftLineSettings) => {
  const pixels = new Map<string, DraftLineSettings["innerColor"]>();
  rasterizeDraftLine(shape, settings, (x, y, color) =>
    pixels.set(`${x},${y}`, color),
  );
  return pixels;
};

test("rasterizes a two-colour outlined straight line", () => {
  const pixels = rasterize(
    {
      start: { x: 0, y: 0 },
      control: { x: 5, y: 0 },
      end: { x: 10, y: 0 },
    },
    {
      innerWidth: 2,
      outlineWidth: 2,
      innerColor: white,
      outlineColor: yellow,
    },
  );

  expect([...pixels.values()]).toContainEqual(white);
  expect([...pixels.values()]).toContainEqual(yellow);
  expect(pixels.get("5,0")).toEqual(white);
  expect(pixels.get("5,2")).toEqual(yellow);
});

test("a moved control point produces a curve", () => {
  const pixels = rasterize(
    {
      start: { x: 0, y: 0 },
      control: { x: 10, y: 12 },
      end: { x: 20, y: 0 },
    },
    {
      innerWidth: 1,
      outlineWidth: 0,
      innerColor: white,
      outlineColor: yellow,
    },
  );

  expect([...pixels.keys()].some((key) => Number(key.split(",")[1]) >= 5)).toBe(
    true,
  );
  expect([...pixels.values()].every((color) => color.r === white.r)).toBe(true);
});
