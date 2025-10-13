import { colorpalette } from "../../constants/colors";
import type { SortOrder, ColorStats } from "./types";
import { getColorKey } from "./utils";

type Color = (typeof colorpalette)[0];

/**
 * 指定された順序と統計データに基づいて色を並び替える
 */
export function sortColors(
  sortOrder: SortOrder,
  colorStats?: Record<string, ColorStats>
): Color[] {
  let sortedColors = [...colorpalette];

  if (!colorStats || sortOrder === "default") {
    return sortedColors;
  }

  if (sortOrder === "most-missing") {
    const withStats: Array<{ color: Color; remaining: number }> = [];
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

    withStats.sort((a, b) => b.remaining - a.remaining);
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

      const remainingA = statsA ? statsA.total - statsA.matched : Infinity;
      const remainingB = statsB ? statsB.total - statsB.matched : Infinity;

      const sortValueA = remainingA === 0 ? Infinity : remainingA;
      const sortValueB = remainingB === 0 ? Infinity : remainingB;

      return sortValueA - sortValueB;
    });
  }

  return sortedColors;
}
