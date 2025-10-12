import { WplaceCoords } from "./constants";
import { CanvasPool } from "./canvas-pool";

/**
 * タイル境界をまたぐ画像を複数タイルに分割する標準アルゴリズム。各タイルの処理済みImageBitmapを辞書形式で返却。
 * 補助色モード最適化: x1サイズImageBitmap生成（x3拡大はdrawOverlayLayersOnTileで実施）
 */
export const drawImageOnTiles = async ({
  file,
  coords,
  tileSize,
}: {
  file: File;
  coords: WplaceCoords;
  tileSize: number;
}): Promise<{ preparedOverlayImage: Record<string, ImageBitmap> }> => {
  const bitmap = await createImageBitmap(file);
  const [w, h] = [bitmap.width, bitmap.height];

  // タイル処理（x1サイズ生成、x3拡大はapplyAuxiliaryColorPatternで実施）
  const preparedOverlayImages: Record<string, ImageBitmap> = {};

  for (let py = coords[3]; py < h + coords[3]; ) {
    const drawH = Math.min(tileSize - (py % tileSize), h - (py - coords[3]));

    for (let px = coords[2]; px < w + coords[2]; ) {
      const drawW = Math.min(tileSize - (px % tileSize), w - (px - coords[2]));

      console.log(`🧑‍🎨: drawImageOnTiles at ${coords} size ${tileSize}`);
      const result = await processTile(bitmap, coords, px, py, drawW, drawH);

      preparedOverlayImages[result.tileName] = result.bitmap;

      px += drawW;
    }

    py += drawH;
  }

  return { preparedOverlayImage: preparedOverlayImages };
};

/** 単一タイル処理: x1サイズImageBitmap生成（x3拡大なし） */
const processTile = async (
  bitmap: ImageBitmap,
  coords: WplaceCoords,
  px: number,
  py: number,
  drawW: number,
  drawH: number
) => {
  const canvas = CanvasPool.acquire(drawW, drawH);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    CanvasPool.release(canvas);
    throw new Error("Failed to get 2D context");
  }

  // x1サイズで描画（x3拡大なし）
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    bitmap,
    px - coords[2],
    py - coords[3],
    drawW,
    drawH,
    0,
    0,
    drawW,
    drawH
  );

  // タイル名生成
  const tx = coords[0] + Math.floor(px / 1000);
  const ty = coords[1] + Math.floor(py / 1000);
  const tileName = `${tx.toString().padStart(4, "0")},${ty
    .toString()
    .padStart(4, "0")},${(px % 1000).toString().padStart(3, "0")},${(py % 1000)
    .toString()
    .padStart(3, "0")}`;

  const resultBitmap = await createImageBitmap(canvas);

  // Canvas cleanup
  CanvasPool.release(canvas);

  return {
    bitmap: resultBitmap,
    tileName,
  };
};
