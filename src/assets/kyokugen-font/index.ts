import type { BitmapChar } from "./types";
import { kigou } from "./kigou";
import { katakana } from "./katakana";
import { katakanaDakuten } from "./katakanaDakuten";
import { hiragana } from "./hiragana";
import { hiraganaDakuten } from "./hiraganaDakuten";

export const kyokugenData: BitmapChar[] = [
  ...katakana,
  ...katakanaDakuten,
  ...kigou,
  ...hiragana,
  ...hiraganaDakuten,
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

あいうえお
かきくけこ
さしすせそ
たちつてと
なにぬねの
はひふへほ
まみむめも
やゆよ
らりるれろ
わをん

がぎぐげご
ざじずぜぞ
だぢづでど
ばびぶべぼ

ぱぴぷぺぽ

ゃゅょ

ー
-
！？
!?
、。

「」
(
)
〜
・
…
↑↓→←

*/
