import type { BitmapChar } from "./types";

export const kigou: BitmapChar[] = [
  {
    char: "!",
    width: 3,
    height: 4,
    data: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 0],
      [0, 1, 0],
    ],
  },
  {
    char: "?",
    width: 3,
    height: 5,
    data: [
      [0, 1, 1],
      [1, 0, 1],
      [0, 1, 0],
      [0, 0, 0],
      [0, 1, 0],
    ],
  },
  {
    char: "！",
    width: 3,
    height: 5,
    data: [
      [0, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 0],
      [0, 1, 0],
    ],
  },
  {
    char: "？",
    width: 3,
    height: 6,
    data: [
      [0, 1, 1],
      [1, 0, 1],
      [0, 0, 1],
      [0, 1, 0],
      [0, 0, 0],
      [0, 1, 0],
    ],
  },
  {
    char: "ー",
    width: 3,
    height: 3,
    data: [
      [0, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  {
    char: "-",
    width: 2,
    height: 3,
    data: [
      [0, 0],
      [1, 1],
      [0, 0],
    ],
  },
  {
    char: ",",
    width: 2,
    height: 2,
    data: [
      [1, 0],
      [0, 1],
    ],
  },
  {
    char: ".",
    width: 1,
    height: 1,
    data: [[1]],
  },
  {
    char: "。",
    width: 2,
    height: 2,
    data: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    char: "、",
    width: 2,
    height: 2,
    data: [
      [1, 0],
      [0, 1],
    ],
  },
];
