import { TILE_DRAW_CONSTANTS, TileCoords } from "./constants";
import { latLngToTilePixel } from "../../../utils/coordinate";
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
import { blobToPixels } from "../../../utils/pixel-converters";
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
 *
 * huge-red-cross モード:
 * - 1st pass: 中心ピクセルのみ描画 + 未配置中心座標を収集
 * - 2nd pass: 収集した座標に10x10の赤十字を上書き
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

  // huge-red-cross/diamond用: 未配置ピクセルの中心座標を収集
  const unplacedCenters: Array<{ x: number; y: number }> = [];
  const isHugeRedCross = mode === "huge-red-cross";
  const isHugeRedCrossBold = mode === "huge-red-cross-bold";
  const isHugeRedDiamond = mode === "huge-red-diamond";
  const isHugeRedRing = mode === "huge-red-ring";
  const needsHugeMarker =
    isHugeRedCross || isHugeRedCrossBold || isHugeRedDiamond || isHugeRedRing;

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
          // huge marker: 中心座標を収集
          if (needsHugeMarker) unplacedCenters.push({ x, y });
          continue;
        }

        // huge marker は 2nd pass で処理するので、1st pass では中心+crossのみ
        if (needsHugeMarker) {
          if (isCrossArm) {
            scaledData[i] = r;
            scaledData[i + 1] = g;
            scaledData[i + 2] = b;
            scaledData[i + 3] = a;
          }
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
          // huge marker: 中心座標を収集
          if (needsHugeMarker) unplacedCenters.push({ x, y });
          continue;
        }

        // huge marker は 2nd pass で処理するので、1st pass では中心+crossのみ
        if (needsHugeMarker) {
          if (isCrossArm) {
            scaledData[i] = r;
            scaledData[i + 1] = g;
            scaledData[i + 2] = b;
            scaledData[i + 3] = a;
          }
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

  // 2nd pass: huge marker 描画
  if (needsHugeMarker && unplacedCenters.length > 0) {
    const armLength = 30;
    const centerSize = 1; // 中央3x3の半径（±1 = 3px）

    for (const { x: cx, y: cy } of unplacedCenters) {
      if (isHugeRedCross) {
        // 巨大赤十字: 細い線（1px幅）
        // 水平腕
        for (let dx = -armLength; dx <= armLength; dx++) {
          if (Math.abs(dx) <= centerSize) continue; // 中心3x3はスキップ
          const px = cx + dx;
          if (px < 0 || px >= scaledWidth) continue;
          const i = (cy * scaledWidth + px) * 4;
          scaledData[i] = 255;
          scaledData[i + 1] = 0;
          scaledData[i + 2] = 0;
          scaledData[i + 3] = 255;
        }
        // 垂直腕
        for (let dy = -armLength; dy <= armLength; dy++) {
          if (Math.abs(dy) <= centerSize) continue; // 中心3x3はスキップ
          const py = cy + dy;
          if (py < 0 || py >= scaledHeight) continue;
          const i = (py * scaledWidth + cx) * 4;
          scaledData[i] = 255;
          scaledData[i + 1] = 0;
          scaledData[i + 2] = 0;
          scaledData[i + 3] = 255;
        }
      } else if (isHugeRedCrossBold) {
        // 巨大赤十字（極太）: 3x3幅のクロス
        const thickness = 1; // ±1 = 3px幅
        for (let dy = -armLength; dy <= armLength; dy++) {
          for (let dx = -armLength; dx <= armLength; dx++) {
            // 中心3x3はスキップ
            if (Math.abs(dx) <= centerSize && Math.abs(dy) <= centerSize)
              continue;

            // クロス形状: 水平または垂直の腕
            const isHorizontalArm = Math.abs(dy) <= thickness;
            const isVerticalArm = Math.abs(dx) <= thickness;
            if (!isHorizontalArm && !isVerticalArm) continue;

            const px = cx + dx;
            const py = cy + dy;
            if (px < 0 || px >= scaledWidth || py < 0 || py >= scaledHeight)
              continue;

            const i = (py * scaledWidth + px) * 4;
            scaledData[i] = 255;
            scaledData[i + 1] = 0;
            scaledData[i + 2] = 0;
            scaledData[i + 3] = 255;
          }
        }
      } else if (isHugeRedDiamond) {
        // 巨大赤ダイヤ: マンハッタン距離でダイヤ形状、グラデーション
        for (let dy = -armLength; dy <= armLength; dy++) {
          for (let dx = -armLength; dx <= armLength; dx++) {
            // 中心3x3はスキップ
            if (Math.abs(dx) <= centerSize && Math.abs(dy) <= centerSize)
              continue;

            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist > armLength) continue; // ダイヤ形状の外側

            const px = cx + dx;
            const py = cy + dy;
            if (px < 0 || px >= scaledWidth || py < 0 || py >= scaledHeight)
              continue;

            const i = (py * scaledWidth + px) * 4;

            // グラデーション: 中心が濃い(255)、外が薄い(64)
            const ratio = dist / armLength;
            const alpha = Math.round(255 - ratio * 191); // 255 → 64
            scaledData[i] = 255;
            scaledData[i + 1] = 0;
            scaledData[i + 2] = 0;
            scaledData[i + 3] = alpha;
          }
        }
      } else if (isHugeRedRing) {
        // 巨大赤リング: ユークリッド距離で円形リング
        const innerRadius = 10; // 内径
        const outerRadius = armLength; // 外径
        for (let dy = -outerRadius; dy <= outerRadius; dy++) {
          for (let dx = -outerRadius; dx <= outerRadius; dx++) {
            // 中心3x3はスキップ
            if (Math.abs(dx) <= centerSize && Math.abs(dy) <= centerSize)
              continue;

            const dist = Math.sqrt(dx * dx + dy * dy);

            // リング範囲内のみ描画
            if (dist < innerRadius || dist > outerRadius) continue;

            const px = cx + dx;
            const py = cy + dy;
            if (px < 0 || px >= scaledWidth || py < 0 || py >= scaledHeight)
              continue;

            const i = (py * scaledWidth + px) * 4;
            // グラデーション: 内側が濃い、外側が薄い
            const ratio = (dist - innerRadius) / (outerRadius - innerRadius);
            const alpha = Math.round(255 - ratio * 191); // 255 → 64
            scaledData[i] = 255;
            scaledData[i + 1] = 0;
            scaledData[i + 2] = 0;
            scaledData[i + 3] = alpha;
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
  // Ensure data is a standard Uint8ClampedArray (not generic ArrayBufferLike)
  const standardData = new Uint8ClampedArray(data);
  const imageData = new ImageData(standardData, width, height);
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
    "../../states/colorFilterState"
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

  // padded format for legacy compatibility: "0005,0003"
  const coordStrPadded =
    tileCoords[0].toString().padStart(4, "0") +
    "," +
    tileCoords[1].toString().padStart(4, "0");

  // v2 format: "5,3" (no padding, exact match)
  const coordStrV2 = `${tileCoords[0]},${tileCoords[1]}`;

  // 現在タイルに重なる全オーバーレイ画像のリストを取得
  const matchingTiles: Array<{
    tileKey: string;
    instance: TileDrawInstance;
  }> = [];

  for (const instance of overlayLayers) {
    if (!instance.drawEnabled) continue;

    // v2: Use pre-calculated affectedTiles for efficient lookup
    // affectedTiles format: "tx,ty" (no padding, e.g., "5,3")
    if (instance.affectedTiles && instance.affectedTiles.length > 0) {
      // Check if current tile is in affectedTiles
      if (instance.affectedTiles.includes(coordStrV2)) {
        matchingTiles.push({ tileKey: coordStrV2, instance });
      }
      continue;
    }

    // Legacy: Check if this layer is optimized and uses bounds checking
    if (instance.isOptimized && instance.bounds) {
      // Calculate tile pixel bounds
      const tilePixelLeft = tileCoords[0] * 1000;
      const tilePixelTop = tileCoords[1] * 1000;
      const tilePixelRight = tilePixelLeft + 1000;
      const tilePixelBottom = tilePixelTop + 1000;

      // Check if tile intersects with layer bounds
      if (
        tilePixelRight > instance.bounds.left &&
        tilePixelLeft < instance.bounds.right &&
        tilePixelBottom > instance.bounds.top &&
        tilePixelTop < instance.bounds.bottom
      ) {
        // Calculate which sub-tiles within this tile are covered by the layer
        // Layer coords are in WPlace coordinates (TLX, TLY, PxX, PxY)
        const layerStartPixelX = instance.coords[0] * 1000 + instance.coords[2];
        const layerStartPixelY = instance.coords[1] * 1000 + instance.coords[3];

        // Calculate the intersection of the current tile with the layer
        const intersectLeft = Math.max(tilePixelLeft, instance.bounds.left);
        const intersectTop = Math.max(tilePixelTop, instance.bounds.top);
        const intersectRight = Math.min(tilePixelRight, instance.bounds.right);
        const intersectBottom = Math.min(
          tilePixelBottom,
          instance.bounds.bottom
        );

        // Convert intersection to tile-relative coordinates
        const relativeStartX = intersectLeft - layerStartPixelX;
        const relativeStartY = intersectTop - layerStartPixelY;
        const relativeEndX = intersectRight - layerStartPixelX;
        const relativeEndY = intersectBottom - layerStartPixelY;

        // Calculate which sub-tiles are needed (in 1000x1000 chunks)
        const startSubTileX = Math.floor(relativeStartX / 1000);
        const startSubTileY = Math.floor(relativeStartY / 1000);
        const endSubTileX = Math.floor((relativeEndX - 1) / 1000);
        const endSubTileY = Math.floor((relativeEndY - 1) / 1000);

        // Generate tile keys for all sub-tiles that intersect
        for (
          let subTileY = startSubTileY;
          subTileY <= endSubTileY;
          subTileY++
        ) {
          for (
            let subTileX = startSubTileX;
            subTileX <= endSubTileX;
            subTileX++
          ) {
            const subTilePixelX = subTileX * 1000;
            const subTilePixelY = subTileY * 1000;
            const globalTileX =
              instance.coords[0] +
              Math.floor((instance.coords[2] + subTilePixelX) / 1000);
            const globalTileY =
              instance.coords[1] +
              Math.floor((instance.coords[3] + subTilePixelY) / 1000);
            const pixelOffsetX = (instance.coords[2] + subTilePixelX) % 1000;
            const pixelOffsetY = (instance.coords[3] + subTilePixelY) % 1000;

            const tileKey = `${globalTileX
              .toString()
              .padStart(4, "0")},${globalTileY
              .toString()
              .padStart(4, "0")},${pixelOffsetX
              .toString()
              .padStart(3, "0")},${pixelOffsetY.toString().padStart(3, "0")}`;

            // Only add if this tile key starts with coordStrPadded (matches current tile)
            if (tileKey.startsWith(coordStrPadded)) {
              matchingTiles.push({ tileKey, instance });
            }
          }
        }
      }
    } else if (instance.tiles) {
      // Non-optimized layer - use existing tile keys
      const tiles = Object.keys(instance.tiles).filter((tile) =>
        tile.startsWith(coordStrPadded)
      );
      for (const tileKey of tiles) {
        matchingTiles.push({ tileKey, instance });
      }
    }
  }

  if (matchingTiles.length === 0) return tileBlob;

  // ポーリング累積防止: 同タイルのみ統計delete
  for (const { instance } of matchingTiles) {
    const imageStatsMap = perTileColorStats.get(instance.imageKey);
    if (imageStatsMap?.has(coordStrPadded)) {
      // console.log(
      //   `🧑‍🎨 : Deleting existing stats for tile ${coordStrPadded}, image ${instance.imageKey}`
      // );
      imageStatsMap.delete(coordStrPadded);
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
  const { getEnhancedMode } = await import("../../states/colorFilterState");
  const mode = getEnhancedMode();

  // 透明背景に複数オーバーレイが重なった合成画像を出力
  for (const { tileKey, instance } of matchingTiles) {
    const coords = tileKey.split(",");
    let paintedTilebitmap = instance.tiles?.[tileKey];

    // Determine if this is a v2 tile (format: "tx,ty" - 2 parts)
    // or legacy tile (format: "tx,ty,pxX,pxY" - 4 parts)
    const isV2Tile = coords.length === 2;

    // If tile not in memory, try loading from IndexedDB v2 first, then legacy
    if (!paintedTilebitmap) {
      // Try new GalleryRepository v2 first
      try {
        const { getGalleryRepository } = await import(
          "../../db/gallery-repository"
        );
        const repoV2 = getGalleryRepository();
        console.log(
          `🧑‍🎨 : Trying to load tile [${
            instance.imageKey
          }, ${tileKey}], repoV2 initialized=${!!repoV2}`
        );
        if (repoV2) {
          const tileBlob = await repoV2.getTile(instance.imageKey, tileKey);
          console.log(
            `🧑‍🎨 : getTile result for [${instance.imageKey}, ${tileKey}]: ${
              tileBlob ? `Blob(${tileBlob.size})` : "null"
            }`
          );
          if (tileBlob) {
            paintedTilebitmap = await createImageBitmap(tileBlob);
            // Cache in memory for faster subsequent access
            if (!instance.tiles) {
              instance.tiles = {};
            }
            instance.tiles[tileKey] = paintedTilebitmap;
            console.log(
              `🧑‍🎨 : Loaded tile ${tileKey} from IndexedDB v2 for ${instance.imageKey}`
            );
          }
        }
      } catch (error) {
        console.error(`🧑‍🎨 : Error loading tile from v2:`, error);
      }
    }

    if (!paintedTilebitmap) continue;

    // v2 tiles: already positioned within 1000x1000 tile, draw at (0,0)
    // legacy tiles: have pixel offset in tileKey, draw at that offset
    const offsetX = isV2Tile ? 0 : Number(coords[2]);
    const offsetY = isV2Tile ? 0 : Number(coords[3]);

    paintedTilebitmap = await applyOverlayProcessing(
      paintedTilebitmap,
      finalBgPixels,
      finalBgWidth,
      offsetX,
      offsetY,
      mode,
      instance.imageKey,
      tempStatsMap,
      computeDevice
    );

    context.drawImage(
      paintedTilebitmap,
      offsetX * TILE_DRAW_CONSTANTS.RENDER_SCALE,
      offsetY * TILE_DRAW_CONSTANTS.RENDER_SCALE
    );
  }

  // 一時統計をperTile統計に保存
  for (const [imageKey, stats] of tempStatsMap.entries()) {
    if (!perTileColorStats.has(imageKey)) {
      perTileColorStats.set(imageKey, new Map());
    }
    perTileColorStats.get(imageKey)!.set(coordStrPadded, stats);
  }

  // Notify content script to save statistics to storage
  // Do this asynchronously to avoid blocking tile rendering
  if (tempStatsMap.size > 0) {
    notifyStatsUpdate(tempStatsMap, coordStrPadded);
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
