import type { BitmapChar } from "./types";
import { kigou } from "./kigou";
import { katakana } from "./katakana";
import { katakanaDakuten } from "./katakanaDakuten";
import { hiragana } from "./hiragana";
import { hiraganaDakuten } from "./hiraganaDakuten";
import { alphabetUpper } from "./alphabetUpper";
import { alphabetlower } from "./alphabetLower";
import { number } from "./number";

export const kyokugenData: BitmapChar[] = [
  ...alphabetUpper,
  ...alphabetlower,
  ...hiragana,
  ...hiraganaDakuten,
  ...katakana,
  ...katakanaDakuten,
  ...number,
  ...kigou,
];
export type { BitmapChar } from "./types";

/** 
 
0123456789

ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz

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

ぁぃぅぇぉ

ゃゅょ

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

ァィゥェォ

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

' "
: ;
,.

*/
