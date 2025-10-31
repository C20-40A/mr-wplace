import { TILE_DRAW_CONSTANTS, TileCoords } from "./constants";
import { llzToTilePixel } from "../../utils/coordinate";
import type { TileDrawInstance, ColorStats, EnhancedMode } from "./types";
import {
  getAuxiliaryColor,
  isSameColor,
  colorToKey,
} from "./utils/color-processing";
import {
  convertImageBitmapToUint8ClampedArray,
  getGridPosition,
} from "./utils/pixel-processing";
import { processGpuColorFilter } from "./utils/gpu-color-filter";
import { processCpuColorFilter } from "./utils/cpu-color-filter";
import { blobToPixels } from "../../utils/pixel-converters";
// Inject-safe alternatives to WASM-based image-bitmap-compat
const createImageBitmapFromImageData = async (imageData: ImageData): Promise<ImageBitmap> => {
  return await createImageBitmap(imageData);
};

const createImageBitmapFromCanvas = async (canvas: HTMLCanvasElement): Promise<ImageBitmap> => {
  return await createImageBitmap(canvas);
};
import { overlayLayers, perTileColorStats } from "./states-inject";

/**
 * オーバーレイ最終処理
 * 1. カラーフィルター適用（x1サイズ）
 * 2. 背景比較+統計計算（x1サイズ）
 * 3. x3拡大
 * 4. モード別処理（x3サイズ：dot/cross/fill/補助色）
 */
const applyOverlayProcessing = async (
  overlayBitmap: ImageBitmap,
  bgPixels: Uint8Array,
  bgWidth: number,
  offsetX: number,
  offsetY: number,
  mode: EnhancedMode,
  imageKey: string,
  tempStatsMap: Map<string, ColorStats>,
  compute_device: "gpu" | "cpu" = "gpu"
): Promise<ImageBitmap> => {
  const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
  const width = overlayBitmap.width;
  const height = overlayBitmap.height;

  // === Phase 1: x1サイズ処理 ===
  // GPU: カラーフィルター適用
  const colorFilter = window.mrWplace?.colorFilterManager?.isFilterActive()
    ? window.mrWplace.colorFilterManager.selectedRGBs
    : undefined;

  let data: Uint8ClampedArray;
  if (compute_device === "gpu" && colorFilter !== undefined) {
    try {
      // GPUフィルター適用
      data = await processGpuColorFilter(overlayBitmap, colorFilter);
    } catch (error) {
      console.log("🧑‍🎨 : GPU processing failed, fallback to CPU", error);
      // CPU フォールバック
      const rawData = convertImageBitmapToUint8ClampedArray(overlayBitmap);
      data = processCpuColorFilter(rawData, { filters: colorFilter });
    }
  } else if (compute_device === "cpu" && colorFilter !== undefined) {
    // CPUフィルター適用（GPU非対応ブラウザ用フォールバック）
    const rawData = convertImageBitmapToUint8ClampedArray(overlayBitmap);
    data = processCpuColorFilter(rawData, { filters: colorFilter });
  } else {
    // フィルターなしはそのまま取得
    data = convertImageBitmapToUint8ClampedArray(overlayBitmap);
  }

  // 背景ピクセル（事前デコード済み）
  const bgData = new Uint8ClampedArray(bgPixels.buffer);

  // 統計初期化（tempStatsMap使用）
  if (!tempStatsMap.has(imageKey)) {
    tempStatsMap.set(imageKey, {
      matched: new Map(),
      total: new Map(),
    });
  }
  const stats = tempStatsMap.get(imageKey)!;

  // === Phase 1: 背景比較 + 統計計算（x1全ピクセル）===
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // GPU透明化済みピクセルスキップ
      if (data[i + 3] === 0) continue;

      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];

      // 背景比較 + 統計計算
      const bgX = offsetX + x;
      const bgY = offsetY + y;
      const bgI = (bgY * bgWidth + bgX) * 4;
      const [bgR, bgG, bgB, bgA] = [
        bgData[bgI],
        bgData[bgI + 1],
        bgData[bgI + 2],
        bgData[bgI + 3],
      ];

      const colorMatches = isSameColor([r, g, b, 255], [bgR, bgG, bgB, bgA]);

      // 統計計算
      const colorKey = colorToKey([r, g, b]);
      stats.total.set(colorKey, (stats.total.get(colorKey) || 0) + 1);
      if (colorMatches) {
        stats.matched.set(colorKey, (stats.matched.get(colorKey) || 0) + 1);
      }
    }
  }

  // === Phase 2+3統合: x3拡大 + モード別処理 ===
  const scaledWidth = width * pixelScale;
  const scaledHeight = height * pixelScale;
  const scaledData = new Uint8ClampedArray(scaledWidth * scaledHeight * 4); // デフォルト透明

  // カラーフィルター色数0なら描画スキップ（統計は取得済み）
  const shouldSkipRendering =
    colorFilter !== undefined && colorFilter.length === 0;

  // x3全ピクセルループ
  if (!shouldSkipRendering) {
    for (let y = 0; y < scaledHeight; y++) {
      for (let x = 0; x < scaledWidth; x++) {
        // x1座標逆算
        const x1 = Math.floor(x / pixelScale);
        const y1 = Math.floor(y / pixelScale);
        const srcI = (y1 * width + x1) * 4;

        // x1データから取得
        const [r, g, b, a] = [
          data[srcI],
          data[srcI + 1],
          data[srcI + 2],
          data[srcI + 3],
        ];
        if (a === 0) continue; // 透明ならスキップ

        const i = (y * scaledWidth + x) * 4;

        const { isCenterPixel, isCrossArm } = getGridPosition(x, y);
        if (isCenterPixel) {
          // 中心ピクセルは常に書き込み
          scaledData[i] = r;
          scaledData[i + 1] = g;
          scaledData[i + 2] = b;
          scaledData[i + 3] = a;
          continue;
        }

        // 背景色取得
        const bgX1 = offsetX + x1;
        const bgY1 = offsetY + y1;
        const bgI1 = (bgY1 * bgWidth + bgX1) * 4;

        if (bgI1 + 3 >= bgData.length) continue;

        const [bgR, bgG, bgB, bgA] = [
          bgData[bgI1],
          bgData[bgI1 + 1],
          bgData[bgI1 + 2],
          bgData[bgI1 + 3],
        ];

        // 背景と同色なら透明化（書き込まない）
        if (isSameColor([r, g, b, 255], [bgR, bgG, bgB, bgA])) continue;

        // モード別処理
        if (mode === "dot") {
          // 書き込まない（デフォルト透明のまま）
        } else if (mode === "cross") {
          if (isCrossArm) {
            scaledData[i] = r;
            scaledData[i + 1] = g;
            scaledData[i + 2] = b;
            scaledData[i + 3] = a;
          }
        } else if (mode === "fill") {
          scaledData[i] = r;
          scaledData[i + 1] = g;
          scaledData[i + 2] = b;
          scaledData[i + 3] = a;
        } else {
          // 補助色を使うパターン
          if (isCrossArm) {
            const [ar, ag, ab] = getAuxiliaryColor(mode, [r, g, b]);
            scaledData[i] = ar;
            scaledData[i + 1] = ag;
            scaledData[i + 2] = ab;
            scaledData[i + 3] = 255;
          } else if (mode === "red-border") {
            // 赤枠モードは腕以外(4隅)も赤
            scaledData[i] = 255;
            scaledData[i + 1] = 0;
            scaledData[i + 2] = 0;
            scaledData[i + 3] = 255;
          }
        }
      }
    }
  }

  // === 最終キャンバス投影 ===（常に実行）
  const finalCanvas = new OffscreenCanvas(scaledWidth, scaledHeight);
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) throw new Error("Failed to get final context");
  const finalImageData = new ImageData(scaledData, scaledWidth, scaledHeight);
  finalCtx.putImageData(finalImageData, 0, 0);

  return await createImageBitmapFromCanvas(finalCanvas);
};

export const drawOverlayLayersOnTile = async (
  tileBlob: Blob,
  tileCoords: TileCoords,
  computeDevice: "gpu" | "cpu" = "gpu"
): Promise<Blob> => {
  if (overlayLayers.length === 0) return tileBlob;

  const coordStr =
    tileCoords[0].toString().padStart(4, "0") +
    "," +
    tileCoords[1].toString().padStart(4, "0");

  // 現在タイルに重なる全オーバーレイ画像のリストを取得
  const matchingTiles: Array<{
    tileKey: string;
    instance: TileDrawInstance;
  }> = [];
  for (const instance of overlayLayers) {
    if (!instance.drawEnabled || !instance.tiles) continue;
    const tiles = Object.keys(instance.tiles).filter((tile) =>
      tile.startsWith(coordStr)
    );
    for (const tileKey of tiles) matchingTiles.push({ tileKey, instance });
  }
  if (matchingTiles.length === 0) return tileBlob;

  // ポーリング累積防止: 同タイルのみ統計delete
  for (const { instance } of matchingTiles) {
    const imageStatsMap = perTileColorStats.get(instance.imageKey);
    imageStatsMap?.delete(coordStr);
  }

  // 一時統計マップ: 複数タイルまたがり対応
  const tempStatsMap = new Map<string, ColorStats>();

  // 背景タイル1回デコード（高速化: 下地用+背景比較用）
  const {
    pixels: bgPixels,
    width: bgWidth,
    height: bgHeight,
  } = await blobToPixels(tileBlob);

  // 1x1 = 未ロードタイル → 透明1000x1000生成
  // NOTE: 何も描かれていない場所に描画しようとすると、1x1 ピクセルの背景 blob がやってきて、画像が描画されない問題の修正
  let finalBgPixels = bgPixels;
  let finalBgWidth = bgWidth;
  let finalBgHeight = bgHeight;
  if (bgWidth === 1 && bgHeight === 1) {
    console.log("🧑‍🎨 : 1x1 tile detected, generating transparent 1000x1000");
    finalBgPixels = new Uint8Array(
      TILE_DRAW_CONSTANTS.TILE_SIZE * TILE_DRAW_CONSTANTS.TILE_SIZE * 4
    );
    finalBgWidth = TILE_DRAW_CONSTANTS.TILE_SIZE;
    finalBgHeight = TILE_DRAW_CONSTANTS.TILE_SIZE;
  }

  const bgImageData = new ImageData(
    new Uint8ClampedArray(finalBgPixels),
    finalBgWidth,
    finalBgHeight
  );
  const tileBitmap = await createImageBitmapFromImageData(bgImageData);

  // キャンバス作成（実サイズベース）
  const drawSize =
    Math.max(finalBgWidth, finalBgHeight) * TILE_DRAW_CONSTANTS.RENDER_SCALE;
  const canvas = new OffscreenCanvas(drawSize, drawSize);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("tile canvas context not found");
  context.imageSmoothingEnabled = false;

  // 元タイル画像を下地化（デコード済みImageBitmap）
  context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

  // 描画モードを取得
  const colorFilterManager = window.mrWplace?.colorFilterManager;
  const mode = colorFilterManager?.getEnhancedMode() ?? "dot";

  // 透明背景に複数オーバーレイが重なった合成画像を出力
  for (const { tileKey, instance } of matchingTiles) {
    const coords = tileKey.split(",");
    let paintedTilebitmap = instance.tiles?.[tileKey];
    if (!paintedTilebitmap) continue;

    paintedTilebitmap = await applyOverlayProcessing(
      paintedTilebitmap,
      finalBgPixels,
      finalBgWidth,
      Number(coords[2]),
      Number(coords[3]),
      mode,
      instance.imageKey,
      tempStatsMap,
      computeDevice
    );

    context.drawImage(
      paintedTilebitmap,
      Number(coords[2]) * TILE_DRAW_CONSTANTS.RENDER_SCALE,
      Number(coords[3]) * TILE_DRAW_CONSTANTS.RENDER_SCALE
    );
  }

  // 一時統計をperTile統計に保存
  for (const [imageKey, stats] of tempStatsMap.entries()) {
    if (!perTileColorStats.has(imageKey)) {
      perTileColorStats.set(imageKey, new Map());
    }
    perTileColorStats.get(imageKey)!.set(coordStr, stats);
  }

  const result = await canvas.convertToBlob({ type: "image/png" });
  return result;
};

export const getOverlayPixelColor = async (
  lat: number,
  lng: number
): Promise<{ r: number; g: number; b: number; a: number } | null> => {
  const coords = llzToTilePixel(lat, lng);
  const coordPrefix = `${coords.TLX.toString().padStart(
    4,
    "0"
  )},${coords.TLY.toString().padStart(4, "0")}`;

  // 後ろから検索（上位レイヤー優先）
  for (let i = overlayLayers.length - 1; i >= 0; i--) {
    const instance = overlayLayers[i];
    if (!instance.drawEnabled || !instance.tiles) continue;

    // 該当タイルのキー探す
    for (const [key, bitmap] of Object.entries(instance.tiles)) {
      if (!key.startsWith(coordPrefix)) continue;

      const parts = key.split(",");
      const offsetX = parseInt(parts[2]);
      const offsetY = parseInt(parts[3]);

      // 範囲チェック
      const relX = coords.PxX - offsetX;
      const relY = coords.PxY - offsetY;
      const drawW = bitmap.width;
      const drawH = bitmap.height;

      if (relX < 0 || relX >= drawW || relY < 0 || relY >= drawH) continue;

      // ピクセル取得（x1サイズbitmapから直接取得）
      const canvas = new OffscreenCanvas(1, 1);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, relX, relY, 1, 1, 0, 0, 1, 1);
      const imageData = ctx.getImageData(0, 0, 1, 1);

      return {
        r: imageData.data[0],
        g: imageData.data[1],
        b: imageData.data[2],
        a: imageData.data[3],
      };
    }
  }

  return null;
};
