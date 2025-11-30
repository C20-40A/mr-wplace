import { TILE_DRAW_CONSTANTS, TileCoords } from "./constants";
import { latLngToTilePixel } from "../../utils/coordinate";
import type { TileDrawInstance, ColorStats, EnhancedMode } from "./types";
import {
  getAuxiliaryColor,
  isSameColor,
  colorToKey,
} from "./filters/color-processing";
import {
  convertImageBitmapToUint8ClampedArray,
  getGridPosition,
} from "./image-processing/pixel-processing";
import { processGpuColorFilter } from "./filters/gpu-filter";
import { processCpuColorFilter } from "./filters/cpu-filter";
import { blobToPixels } from "../../utils/pixel-converters";
import { overlayLayers, perTileColorStats } from "./states";

/**
 * Notify content script to save statistics to storage
 * This is called after tile rendering completes and statistics are updated
 */
const notifyStatsUpdate = (
  tempStatsMap: Map<string, ColorStats>,
  tileKey: string
): void => {
  // Convert each image's stats to a serializable format
  for (const [imageKey, stats] of tempStatsMap.entries()) {
    // Get all stats for this image
    const imageStatsMap = perTileColorStats.get(imageKey);
    if (!imageStatsMap) continue;

    // Convert Map to plain object for postMessage
    const tileStatsObject: Record<
      string,
      { matched: Record<string, number>; total: Record<string, number> }
    > = {};

    for (const [tileKey, tileStats] of imageStatsMap.entries()) {
      tileStatsObject[tileKey] = {
        matched: Object.fromEntries(tileStats.matched),
        total: Object.fromEntries(tileStats.total),
      };
    }

    // Send to content script
    window.postMessage(
      {
        source: "mr-wplace-stats-updated",
        imageKey,
        tileStatsMap: tileStatsObject,
      },
      "*"
    );
  }
};

/**
 * Draw solid background for unplaced-only mode
 */
const drawSolidBackground = (
  ctx: OffscreenCanvasRenderingContext2D,
  width: number,
  height: number
): void => {
  ctx.fillStyle = "#e8e8e8"; // rgb(232, 232, 232)
  ctx.fillRect(0, 0, width, height);
};

/**
 * Phase 1: カラーフィルター適用（x1サイズ）
 * GPU/CPUでフィルター処理を行い、フィルター済みピクセルデータを返す
 */
const applyColorFilterToOverlay = async (
  overlayBitmap: ImageBitmap,
  colorFilter: [number, number, number][] | undefined,
  compute_device: "gpu" | "cpu"
): Promise<Uint8ClampedArray> => {
  if (compute_device === "gpu" && colorFilter !== undefined) {
    try {
      return await processGpuColorFilter(overlayBitmap, colorFilter);
    } catch (error) {
      console.log("🧑‍🎨 : GPU processing failed, fallback to CPU", error);
      const rawData = convertImageBitmapToUint8ClampedArray(overlayBitmap);
      return processCpuColorFilter(rawData, { filters: colorFilter });
    }
  } else if (compute_device === "cpu" && colorFilter !== undefined) {
    const rawData = convertImageBitmapToUint8ClampedArray(overlayBitmap);
    return processCpuColorFilter(rawData, { filters: colorFilter });
  } else {
    return convertImageBitmapToUint8ClampedArray(overlayBitmap);
  }
};

/**
 * Phase 2: 背景比較 + 統計計算（x1サイズ）
 * オーバーレイと背景を比較し、色ごとの統計を計算
 * total: 元画像の色でカウント（カラーフィルター無関係）
 * matched: フィルター適用後の色でカウント
 *
 * NOTE: totalは全ピクセルをカウント、matchedは背景範囲内のみ
 */
const computeStatsWithBackground = (
  originalData: Uint8ClampedArray,
  filteredData: Uint8ClampedArray,
  width: number,
  height: number,
  bgData: Uint8ClampedArray,
  bgWidth: number,
  offsetX: number,
  offsetY: number,
  stats: ColorStats
): void => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // 透明ピクセルをスキップ（元画像基準）
      if (originalData[i + 3] === 0) continue;

      // total: 元画像の色でカウント（カラーフィルター無関係）
      const [origR, origG, origB] = [
        originalData[i],
        originalData[i + 1],
        originalData[i + 2],
      ];
      const totalColorKey = colorToKey([origR, origG, origB]);
      stats.total.set(totalColorKey, (stats.total.get(totalColorKey) || 0) + 1);

      // matched: フィルター適用後の色でカウント
      // フィルター適用後に透明になったピクセルはスキップ
      if (filteredData[i + 3] === 0) continue;

      const [filteredR, filteredG, filteredB] = [
        filteredData[i],
        filteredData[i + 1],
        filteredData[i + 2],
      ];

      // 背景位置を計算
      const bgX = offsetX + x;
      const bgY = offsetY + y;
      const bgI = (bgY * bgWidth + bgX) * 4;

      // 背景の範囲外のピクセルはスキップ（matchedのみ）
      if (bgI + 3 >= bgData.length) continue;

      // 背景比較（フィルター適用後の色で）
      const [bgR, bgG, bgB, bgA] = [
        bgData[bgI],
        bgData[bgI + 1],
        bgData[bgI + 2],
        bgData[bgI + 3],
      ];

      const colorMatches = isSameColor(
        [filteredR, filteredG, filteredB, 255],
        [bgR, bgG, bgB, bgA]
      );

      if (colorMatches) {
        const matchedColorKey = colorToKey([filteredR, filteredG, filteredB]);
        stats.matched.set(
          matchedColorKey,
          (stats.matched.get(matchedColorKey) || 0) + 1
        );
      }
    }
  }
};

/**
 * Phase 3: x3拡大 + モード別処理
 * フィルター済みデータをx3にスケールし、描画モード（dot/cross/fill/補助色）を適用
 */
const scaleAndRenderWithMode = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgData: Uint8ClampedArray,
  bgWidth: number,
  offsetX: number,
  offsetY: number,
  mode: EnhancedMode,
  shouldSkipRendering: boolean,
  showUnplacedOnly: boolean = false
): Uint8ClampedArray => {
  const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
  const scaledWidth = width * pixelScale;
  const scaledHeight = height * pixelScale;
  const scaledData = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);

  if (shouldSkipRendering) {
    return scaledData; // 透明データを返す
  }

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
      if (a === 0) continue;

      const i = (y * scaledWidth + x) * 4;

      const { isCenterPixel, isCrossArm } = getGridPosition(x, y);

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

      const colorMatches = isSameColor([r, g, b, 255], [bgR, bgG, bgB, bgA]);

      // Show unplaced only モード: ロジック反転
      if (showUnplacedOnly) {
        // 背景と一致するピクセル (配置済み) は透明化、不一致 (未配置) のみ描画
        if (colorMatches) continue;

        // 中心ピクセルは常に書き込み
        if (isCenterPixel) {
          scaledData[i] = r;
          scaledData[i + 1] = g;
          scaledData[i + 2] = b;
          scaledData[i + 3] = a;
          continue;
        }

        // モード別処理（通常と同じ）
        if (mode === "dot") {
          // 書き込まない
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
            scaledData[i] = 255;
            scaledData[i + 1] = 0;
            scaledData[i + 2] = 0;
            scaledData[i + 3] = 255;
          }
        }
      } else {
        // 通常モード: 背景と一致したら透明化、不一致なら描画
        if (colorMatches) continue;

        // 中心ピクセルは常に書き込み
        if (isCenterPixel) {
          scaledData[i] = r;
          scaledData[i + 1] = g;
          scaledData[i + 2] = b;
          scaledData[i + 3] = a;
          continue;
        }

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

  return scaledData;
};

/**
 * Phase 4: ImageBitmap変換
 * Uint8ClampedArrayをImageBitmapに変換
 */
const convertToImageBitmap = async (
  data: Uint8ClampedArray,
  width: number,
  height: number
): Promise<ImageBitmap> => {
  const imageData = new ImageData(data, width, height);
  return await createImageBitmap(imageData);
};

/**
 * オーバーレイ最終処理（メイン関数）
 * 1. カラーフィルター適用（x1サイズ）
 * 2. 背景比較+統計計算（x1サイズ）
 * 3. x3拡大 + モード別処理
 * 4. ImageBitmap変換
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

  // カラーフィルター取得
  const { isColorFilterActive, getSelectedRGBs } = await import(
    "../states/colorFilterState"
  );
  const colorFilter = isColorFilterActive() ? getSelectedRGBs() : undefined;

  // 元のオーバーレイデータを取得（total統計用）
  const originalData = convertImageBitmapToUint8ClampedArray(overlayBitmap);

  // Phase 1: カラーフィルター適用
  const filteredData = await applyColorFilterToOverlay(
    overlayBitmap,
    colorFilter,
    compute_device
  );

  // 背景データ準備
  const bgData = new Uint8ClampedArray(bgPixels.buffer);

  // 統計初期化
  if (!tempStatsMap.has(imageKey)) {
    tempStatsMap.set(imageKey, {
      matched: new Map(),
      total: new Map(),
    });
  }
  const stats = tempStatsMap.get(imageKey)!;

  // Phase 2: 背景比較 + 統計計算
  computeStatsWithBackground(
    originalData,
    filteredData,
    width,
    height,
    bgData,
    bgWidth,
    offsetX,
    offsetY,
    stats
  );

  // Phase 3: x3拡大 + モード別処理
  const shouldSkipRendering =
    colorFilter !== undefined && colorFilter.length === 0;

  const showUnplacedOnly = window.mrWplaceShowUnplacedOnly ?? false;

  const scaledData = scaleAndRenderWithMode(
    filteredData,
    width,
    height,
    bgData,
    bgWidth,
    offsetX,
    offsetY,
    mode,
    shouldSkipRendering,
    showUnplacedOnly
  );

  // Phase 4: ImageBitmap変換
  return await convertToImageBitmap(
    scaledData,
    width * pixelScale,
    height * pixelScale
  );
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
    if (imageStatsMap?.has(coordStr)) {
      console.log(
        `🧑‍🎨 : Deleting existing stats for tile ${coordStr}, image ${instance.imageKey}`
      );
      imageStatsMap.delete(coordStr);
    }
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
  const tileBitmap = await createImageBitmap(bgImageData);

  // キャンバス作成（実サイズベース）
  const drawSize =
    Math.max(finalBgWidth, finalBgHeight) * TILE_DRAW_CONSTANTS.RENDER_SCALE;
  const canvas = new OffscreenCanvas(drawSize, drawSize);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("tile canvas context not found");
  context.imageSmoothingEnabled = false;

  // Show unplaced only モード時は単色背景を描画
  const showUnplacedOnly = window.mrWplaceShowUnplacedOnly ?? false;
  if (showUnplacedOnly) {
    drawSolidBackground(context, drawSize, drawSize);
  } else {
    // 元タイル画像を下地化（デコード済みImageBitmap）
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);
  }

  // 描画モードを取得
  const { getEnhancedMode } = await import("../states/colorFilterState");
  const mode = getEnhancedMode();

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

  // Notify content script to save statistics to storage
  // Do this asynchronously to avoid blocking tile rendering
  if (tempStatsMap.size > 0) {
    notifyStatsUpdate(tempStatsMap, coordStr);
  }

  const result = await canvas.convertToBlob({ type: "image/png" });
  return result;
};

export const getOverlayPixelColor = async (
  lat: number,
  lng: number
): Promise<{ r: number; g: number; b: number; a: number } | null> => {
  const coords = latLngToTilePixel(lat, lng);
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
