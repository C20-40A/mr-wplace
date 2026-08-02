import { expect, test } from "@playwright/test";
import {
  forEachDraftStampPixel,
  getDraftStampColorIdAt,
  normalizeDraftStampPattern,
} from "../src/inject/features/draft-draw/draft-stamp";

test("places a custom stamp around the clicked world pixel", () => {
  const pixels: string[] = [];
  forEachDraftStampPixel(
    10,
    20,
    {
      width: 3,
      height: 3,
      colorIds: [null, 10, null, 10, 10, 10, null, 10, null],
    },
    (x, y) => pixels.push(`${x},${y}`),
  );

  expect(pixels).toEqual(["10,19", "9,20", "10,20", "11,20", "10,21"]);
});

test("repeats the stamp pattern with stable alignment at negative coordinates", () => {
  const checker = {
    width: 2,
    height: 2,
    colorIds: [1, null, null, 2],
  };

  expect(getDraftStampColorIdAt(-3, -3, -2, -2, checker)).toBe(1);
  expect(getDraftStampColorIdAt(-2, -3, -2, -2, checker)).toBeNull();
  expect(getDraftStampColorIdAt(-2, -2, -2, -2, checker)).toBe(2);
});

test("normalizes dimensions and missing colour ids from bridge data", () => {
  const pattern = normalizeDraftStampPattern({
    width: 99,
    height: 0,
    colorIds: [10],
  });

  expect(pattern.width).toBe(24);
  expect(pattern.height).toBe(1);
  expect(pattern.colorIds).toHaveLength(24);
  expect(pattern.colorIds.filter((id) => id !== null)).toHaveLength(1);
});

test("keeps each stamp pixel's chosen palette colour", () => {
  const colors: Array<string> = [];
  forEachDraftStampPixel(
    0,
    0,
    { width: 2, height: 1, colorIds: [9, 10] },
    (x, y, colorId) => colors.push(`${x},${y}:${colorId}`),
  );

  expect(colors).toEqual(["-1,0:9", "0,0:10"]);
});
