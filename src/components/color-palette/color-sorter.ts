import { colorpalette } from "../../constants/colors"; // 適切なパスに修正してください
import type { ColorPaletteOptions } from "./index"; // 適切なパスに修正してください

// ColorPaletteから利用する型を定義
type Color = (typeof colorpalette)[0];
export type SortOrder = "default" | "most-missing" | "least-remaining";

// RGBをキーに変換する関数を共通化
const getColorKey = (r: number, g: number, b: number): string =>
  `${r},${g},${b}`;

/**
 * 指定された順序と統計データに基づいて色を並び替えます。
 * @param sortOrder 並び替えの基準
 * @param colorStats 色ごとの統計データ
 * @returns 並び替えられた色の配列
 */
export const sortColors = (
  sortOrder: SortOrder,
  colorStats?: ColorPaletteOptions["colorStats"]
): Color[] => {
  let sortedColors = [...colorpalette];

  if (!colorStats) {
    // 統計データがない場合はデフォルト順（元の配列のコピー）
    return sortedColors;
  }

  if (sortOrder === "most-missing") {
    // 統計あり/なしで分離
    const withStats: Array<{
      color: Color;
      remaining: number;
    }> = [];
    const withoutStats: Color[] = [];

    sortedColors.forEach((color) => {
      const [r, g, b] = color.rgb;
      const key = getColorKey(r, g, b);
      const stats = colorStats[key];

      if (stats) {
        const remaining = stats.total - stats.matched;
        withStats.push({ color, remaining });
      } else {
        withoutStats.push(color);
      }
    });

    // 統計あり色を残り降順ソート
    withStats.sort((a, b) => b.remaining - a.remaining);

    // 統計あり + 統計なし（default順）
    return [...withStats.map((w) => w.color), ...withoutStats];
  }

  if (sortOrder === "least-remaining") {
    sortedColors.sort((a, b) => {
      const [rA, gA, bA] = a.rgb;
      const [rB, gB, bB] = b.rgb;
      const keyA = getColorKey(rA, gA, bA);
      const keyB = getColorKey(rB, gB, bB);

      const statsA = colorStats[keyA];
      const statsB = colorStats[keyB];

      // 統計がない色はInfinity扱いで最後に（元のロジックに従い、0もInfinity扱い）
      const remainingA = statsA ? statsA.total - statsA.matched : Infinity;
      const remainingB = statsB ? statsB.total - statsB.matched : Infinity;

      const sortValueA = remainingA === 0 ? Infinity : remainingA;
      const sortValueB = remainingB === 0 ? Infinity : remainingB;

      return sortValueA - sortValueB; // 昇順
    });
  }

  // sortOrderが"default"の場合、または処理がなかった場合はそのまま返す
  return sortedColors;
};
