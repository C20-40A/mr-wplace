import { TILE_DRAW_CONSTANTS } from "../constants";
import type { ColorStats } from "../types";
import { blobToPixels } from "../../../utils/pixel-converters";
import {
  isSameColor,
  colorToKey,
} from "./color-processing";
import { processCpuColorFilter } from "./cpu-color-filter";
import { convertImageBitmapToUint8ClampedArray } from "./pixel-processing";

/**
 * 画像の全タイルの統計を事前計算する
 * 背景タイルをfetchして、画像と比較して統計を計算
 */
export const computeStatsForImage = async (
  imageKey: string,
  tiles: Record<string, ImageBitmap>,
  colorFilter?: number[][]
): Promise<Map<string, ColorStats>> => {
  const tileStatsMap = new Map<string, ColorStats>();

  console.log(`🧑‍🎨 : Computing stats for image ${imageKey}, ${Object.keys(tiles).length} tiles`);

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

      const coordStr = `${tileX.toString().padStart(4, "0")},${tileY.toString().padStart(4, "0")}`;

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
        console.log(`🧑‍🎨 : Skipping stats for tile ${coordStr} (decode failed):`, decodeError);
        continue;
      }
      // Uint8Array を Uint8ClampedArray に変換
      const bgData = new Uint8ClampedArray(bgPixels);

      // オーバーレイ画像のピクセルを取得
      let overlayData: Uint8ClampedArray = convertImageBitmapToUint8ClampedArray(tileBitmap);

      // カラーフィルター適用（必要な場合）
      if (colorFilter !== undefined && colorFilter.length > 0) {
        // 型アサーション: colorFilter は [number, number, number][] として扱う
        overlayData = processCpuColorFilter(overlayData, {
          filters: colorFilter as [number, number, number][]
        });
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

          // 透明ピクセルをスキップ
          if (overlayData[i + 3] === 0) continue;

          const [r, g, b] = [overlayData[i], overlayData[i + 1], overlayData[i + 2]];

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

          // 色の一致を判定
          const colorMatches = isSameColor([r, g, b, 255], [bgR, bgG, bgB, bgA]);

          // 統計を更新
          const colorKey = colorToKey([r, g, b]);
          stats.total.set(colorKey, (stats.total.get(colorKey) || 0) + 1);
          if (colorMatches) {
            stats.matched.set(colorKey, (stats.matched.get(colorKey) || 0) + 1);
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

  console.log(`🧑‍🎨 : Stats computation complete for image ${imageKey}: ${tileStatsMap.size} tiles`);
  return tileStatsMap;
};

/**
 * 背景タイルをfetchする
 * エラー時は null を返す（エラーをthrowしない）
 */
const fetchBackgroundTile = async (tileX: number, tileY: number): Promise<Blob | null> => {
  // タイムアウト用のAbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // WPlace API から背景タイルを取得
    const url = `https://backend.wplace.live/tiles/${tileX}/${tileY}.png`;
    const response = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 404やその他のエラーは静かにスキップ
      return null;
    }

    const blob = await response.blob();

    // blobのサイズチェック
    if (blob.size === 0) {
      return null;
    }

    return blob;
  } catch (error) {
    clearTimeout(timeoutId);
    // ネットワークエラーやタイムアウトは静かにスキップ
    // エラーログを出さない（大量のログを避けるため）
    return null;
  }
};
