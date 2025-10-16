import type { BitmapChar } from "./types";
import { kigou } from "./kigou";
import { katakana } from "./katakana";
import { katakanaDakuten } from "./katakanaDakuten";

export const kyokugenData: BitmapChar[] = [
  ...katakana,
  ...katakanaDakuten,
  ...kigou,
];
export type { BitmapChar } from "./types";

/** 

アイウエオ
カキクケコ
サシスセソ
タチツテト
ナニヌネノ
ハヒフヘホ
マミムメモ
ヤユヨ
ラリルレロ
ワヲン
ガギグゲゴ
ザジズゼゾ
ダヂヅデド
バビブベボ
パピプペポ
ャュョ
ッ
ー
-
！？
!?
、。

*/
