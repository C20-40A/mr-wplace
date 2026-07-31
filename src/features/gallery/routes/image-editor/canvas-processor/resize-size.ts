export interface TargetSize {
  width: number;
  height: number;
}

/**
 * scale から実際のリサイズ後px数を求める。
 * リサイズを行う全パス（controller/outline/processing）で同じ丸め方式を使うための単一窓口。
 */
export const resolveSizeFromScale = (
  originalWidth: number,
  originalHeight: number,
  scale: number,
): TargetSize => ({
  width: Math.max(1, Math.round(originalWidth * scale)),
  height: Math.max(1, Math.round(originalHeight * scale)),
});

/**
 * 手動入力されたwidthからscale/heightを求める。
 * widthは入力値をそのまま採用し、scaleはUI表示・キャッシュキー用の派生値として逆算する。
 */
export const resolveSizeFromWidth = (
  originalWidth: number,
  originalHeight: number,
  width: number,
): TargetSize & { scale: number } => {
  const targetWidth = Math.max(1, width);
  const height = Math.max(
    1,
    Math.round((targetWidth * originalHeight) / originalWidth),
  );
  return { width: targetWidth, height, scale: targetWidth / originalWidth };
};

/**
 * 手動入力されたheightからscale/widthを求める。
 */
export const resolveSizeFromHeight = (
  originalWidth: number,
  originalHeight: number,
  height: number,
): TargetSize & { scale: number } => {
  const targetHeight = Math.max(1, height);
  const width = Math.max(
    1,
    Math.round((targetHeight * originalWidth) / originalHeight),
  );
  return { width, height: targetHeight, scale: targetHeight / originalHeight };
};
