import { WplaceCoords } from "./constants";

/**
 * タイル境界をまたぐ画像を複数タイルに分割する標準アルゴリズム。各タイルの処理済みImageBitmapを辞書形式で返却。
 * 補助色モード最適化: x1サイズImageBitmap生成（x3拡大はdrawOverlayLayersOnTileで実施）
 */
export const splitImageOnTiles = async ({
  file,
  coords,
  tileSize,
}: {
  file: File;
  coords: WplaceCoords;
  tileSize: number;
}): Promise<{ preparedOverlayImages: Record<string, ImageBitmap> }> => {
  const bitmap = await createImageBitmap(file);
  const [w, h] = [bitmap.width, bitmap.height];
  const preparedOverlayImages: Record<string, ImageBitmap> = {};

  for (let py = coords[3]; py < h + coords[3]; ) {
    const drawH = Math.min(tileSize - (py % tileSize), h - (py - coords[3]));

    for (let px = coords[2]; px < w + coords[2]; ) {
      const drawW = Math.min(tileSize - (px % tileSize), w - (px - coords[2]));

      // GPU直クロップ版
      const cropped = await createImageBitmap(
        bitmap,
        px - coords[2],
        py - coords[3],
        drawW,
        drawH
      );

      const tx = coords[0] + Math.floor(px / 1000);
      const ty = coords[1] + Math.floor(py / 1000);
      const tileName = `${tx.toString().padStart(4, "0")},${ty
        .toString()
        .padStart(4, "0")},${(px % 1000).toString().padStart(3, "0")},${(
        py % 1000
      )
        .toString()
        .padStart(3, "0")}`;

      preparedOverlayImages[tileName] = cropped;

      px += drawW;
    }
    py += drawH;
  }

  return { preparedOverlayImages };
};
