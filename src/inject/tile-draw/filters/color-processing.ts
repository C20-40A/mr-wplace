import type { RGB } from "../types";
import type { EnhancedMode } from "@/types/image";

/**
 * モードに応じた補助色を計算（純粋関数）
 * @param mode 描画モード
 * @param rgb 元のRGB色
 * @returns 補助色RGB
 */
export const getAuxiliaryColor = (mode: EnhancedMode, rgb: RGB): RGB => {
  const [r, g, b] = rgb;

  switch (mode) {
    case "red-cross":
    case "red-border":
      return [255, 0, 0];
    case "cyan-cross":
      return [0, 255, 255];
    case "dark-cross":
      return [Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40)];
    case "complement-cross":
      return [255 - r, 255 - g, 255 - b];
    default:
      return [r, g, b];
  }
};

/**
 * 2色が同じかを判定（純粋関数）
 * @param rgba1 色1（RGBA）
 * @param rgba2 色2（RGBA）
 * @returns 同色ならtrue
 */
export const isSameColor = (
  rgba1: readonly [number, number, number, number],
  rgba2: readonly [number, number, number, number]
): boolean => {
  return (
    rgba2[3] > 0 &&
    rgba1[0] === rgba2[0] &&
    rgba1[1] === rgba2[1] &&
    rgba1[2] === rgba2[2]
  );
};

/**
 * RGB色を統計用文字列キーに変換（純粋関数）
 * @param rgb RGB色
 * @returns "r,g,b"形式の文字列
 */
export const colorToKey = (rgb: RGB): string => {
  return `${rgb[0]},${rgb[1]},${rgb[2]}`;
};
