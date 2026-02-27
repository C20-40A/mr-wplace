import type { ColorStats } from "@/types/image";
import { blobToPixels } from "@/utils/pixel-converters";
import { isSameColor, colorToKey } from "../filters/color-processing";
import { processCpuColorFilter } from "../filters/cpu-filter";
import { convertImageBitmapToUint8ClampedArray } from "../image-processing/pixel-processing";

/**
 * 画像の全タイルの統計を事前計算する
 * 背景タイルをfetchして、画像と比較して統計を計算
 */
export const computeStatsForImage = async (
  imageKey: string,
  tiles: Record<string, ImageBitmap>,
  colorFilter?: number[][],
): Promise<Map<string, ColorStats>> => {
  const tileStatsMap = new Map<string, ColorStats>();

  console.log(
    `🧑‍🎨 : Computing stats for image ${imageKey}, ${
      Object.keys(tiles).length
    } tiles`,
  );

  // タイルエントリーを配列化
  const tileEntries = Object.entries(tiles);

  // 各タイルの統計を計算（順次処理して、リソース競合を避ける）
  for (let i = 0; i < tileEntries.length; i++) {
    const [tileKey, tileBitmap] = tileEntries[i];

    // 10タイルごとに100msの待機を入れて、リソース競合を避ける
    if (i > 0 && i % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    try {
      // tileKey format: "0123,0456,100,200" (tileX, tileY, offsetX, offsetY)
      const parts = tileKey.split(",");
      const tileX = parseInt(parts[0]);
      const tileY = parseInt(parts[1]);
      const offsetX = parseInt(parts[2]);
      const offsetY = parseInt(parts[3]);

      const coordStr = `${tileX.toString().padStart(4, "0")},${tileY
        .toString()
        .padStart(4, "0")}`;

      // 背景タイルを fetch
      const bgBlob = await fetchBackgroundTile(tileX, tileY);
      if (!bgBlob) {
        // エラーではなく警告として処理し、このタイルをスキップ
        console.log(`🧑‍🎨 : Skipping stats for tile ${coordStr} (fetch failed)`);
        continue;
      }

      // 背景ピクセルをデコード（エラーハンドリング強化）
      let bgPixels: Uint8Array;
      let bgWidth: number;
      try {
        const result = await blobToPixels(bgBlob);
        bgPixels = result.pixels;
        bgWidth = result.width;
      } catch (decodeError) {
        console.log(
          `🧑‍🎨 : Skipping stats for tile ${coordStr} (decode failed):`,
          decodeError,
        );
        continue;
      }
      // Uint8Array を Uint8ClampedArray に変換
      const bgData = new Uint8ClampedArray(bgPixels);

      // オーバーレイ画像のピクセルを取得（フィルター適用前）
      const originalOverlayData: Uint8ClampedArray =
        convertImageBitmapToUint8ClampedArray(tileBitmap);

      // フィルター適用後のデータ（matched 計算用）
      let filteredOverlayData: Uint8ClampedArray;
      if (colorFilter !== undefined && colorFilter.length > 0) {
        // カラーフィルター適用
        filteredOverlayData = processCpuColorFilter(originalOverlayData, {
          filters: colorFilter as [number, number, number][],
        });
      } else {
        filteredOverlayData = originalOverlayData;
      }

      // 統計初期化
      const stats: ColorStats = {
        matched: new Map(),
        total: new Map(),
      };

      // 各ピクセルを比較
      const width = tileBitmap.width;
      const height = tileBitmap.height;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;

          // 透明ピクセルをスキップ（元画像基準）
          if (originalOverlayData[i + 3] === 0) continue;

          // total: 元画像の色でカウント（カラーフィルター無関係）
          const [origR, origG, origB] = [
            originalOverlayData[i],
            originalOverlayData[i + 1],
            originalOverlayData[i + 2],
          ];
          const totalColorKey = colorToKey([origR, origG, origB]);
          stats.total.set(
            totalColorKey,
            (stats.total.get(totalColorKey) || 0) + 1,
          );

          // matched: フィルター適用後の色でカウント
          // フィルター適用後に透明になったピクセルはスキップ
          if (filteredOverlayData[i + 3] === 0) continue;

          const [filteredR, filteredG, filteredB] = [
            filteredOverlayData[i],
            filteredOverlayData[i + 1],
            filteredOverlayData[i + 2],
          ];

          // 背景ピクセルを取得
          const bgX = offsetX + x;
          const bgY = offsetY + y;
          const bgI = (bgY * bgWidth + bgX) * 4;

          if (bgI + 3 >= bgData.length) continue;

          const [bgR, bgG, bgB, bgA] = [
            bgData[bgI],
            bgData[bgI + 1],
            bgData[bgI + 2],
            bgData[bgI + 3],
          ];

          // 色の一致を判定（フィルター適用後の色で）
          const colorMatches = isSameColor(
            [filteredR, filteredG, filteredB, 255],
            [bgR, bgG, bgB, bgA],
          );

          if (colorMatches) {
            const matchedColorKey = colorToKey([
              filteredR,
              filteredG,
              filteredB,
            ]);
            stats.matched.set(
              matchedColorKey,
              (stats.matched.get(matchedColorKey) || 0) + 1,
            );
          }
        }
      }

      // 統計を保存
      tileStatsMap.set(coordStr, stats);
      console.log(`🧑‍🎨 : Computed stats for tile ${coordStr}`);
    } catch (error) {
      console.error(`🧑‍🎨 : Failed to compute stats for tile ${tileKey}:`, error);
    }
  }

  console.log(
    `🧑‍🎨 : Stats computation complete for image ${imageKey}: ${tileStatsMap.size} tiles`,
  );
  return tileStatsMap;
};

/**
 * 背景タイルをfetchする
 * エラー時は null を返す（エラーをthrowしない）
 */
const fetchBackgroundTile = async (
  tileX: number,
  tileY: number,
): Promise<Blob | null> => {
  // 新旧エンドポイントを両対応にする（公式が切り替え/ロールバックするため）
  const urls = [
    `https://backend.wplace.live/tile/${tileX}/${tileY}.png`,
    `https://backend.wplace.live/tiles/${tileX}/${tileY}.png`,
    `https://backend.wplace.live/files/s0/tiles/${tileX}/${tileY}.png`,
  ];

  for (const url of urls) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) continue;

      const blob = await response.blob();
      if (blob.size === 0) continue;

      return blob;
    } catch (error) {
      // ネットワークエラーやタイムアウトは静かにスキップ
      // エラーログを出さない（大量のログを避けるため）
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
};
