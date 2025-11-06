import { colorToKey } from "./color-processing";

/**
 * 画像から total 統計のみを計算（位置なし、背景との比較なし）
 * 画像追加時点で呼び出される
 */
export const computeTotalStatsFromImage = async (
  dataUrl: string
): Promise<{ total: Record<string, number>; totalPixels: number }> => {
  // 画像を読み込み
  const img = new Image();
  img.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
  });

  // Canvas で画像を描画してピクセルデータを取得
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const pixels = imageData.data;

  // 統計をカウント
  const totalStats = new Map<string, number>();
  let totalPixels = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b, a] = [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];

    // 透明ピクセルをスキップ
    if (a === 0) continue;

    const colorKey = colorToKey([r, g, b]);
    totalStats.set(colorKey, (totalStats.get(colorKey) || 0) + 1);
    totalPixels++;
  }

  return {
    total: Object.fromEntries(totalStats),
    totalPixels,
  };
};
