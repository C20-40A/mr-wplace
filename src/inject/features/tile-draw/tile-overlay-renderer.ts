import { TILE_DRAW_CONSTANTS, TileCoords } from "./constants";
import { latLngToTilePixel } from "@/utils/coordinate";
import { blobToPixels } from "@/utils/pixel-converters";
import { colorpalette } from "@/constants/colors";
import type { TileDrawInstance, ColorStats, EnhancedMode } from "./types";
import { getAuxiliaryColor, colorToKey } from "./filters/color-processing";
import { ENHANCED_MODE_OPTIONS } from "@/components/color-palette/utils";
import { convertImageBitmapToUint8ClampedArray } from "./image-processing/pixel-processing";
import { processGpuColorFilter } from "./filters/gpu-filter";
import { processCpuColorFilter } from "./filters/cpu-filter";
import {
  getEnhancedColor,
  getEnhancedMode,
  getSelectedRGBs,
  getShowUnplacedColor,
  isColorFilterActive,
} from "../../states/colorFilterState";
import { overlayLayers, perTileColorStats } from "./states";

/**
 * RGBA配列を毎回生成せずに色一致判定する
 */
const isSameColorComponents = (
  r: number,
  g: number,
  b: number,
  bgR: number,
  bgG: number,
  bgB: number,
  bgA: number,
): boolean => {
  return bgA > 0 && r === bgR && g === bgG && b === bgB;
};

/**
 * Notify content script to save statistics to storage
 * This is called after tile rendering completes and statistics are updated
 */
const notifyStatsUpdate = (
  tempStatsMap: Map<string, ColorStats>,
  tileKey: string,
): void => {
  // Send only current tile delta to avoid full-map serialization on every tile render
  for (const [imageKey, stats] of tempStatsMap.entries()) {
    const tileStatsDelta: Record<
      string,
      { matched: Record<string, number>; total: Record<string, number> }
    > = {
      [tileKey]: {
        matched: Object.fromEntries(stats.matched),
        total: Object.fromEntries(stats.total),
      },
    };

    window.postMessage(
      {
        source: "mr-wplace-stats-updated",
        imageKey,
        tileStatsDelta,
      },
      "*",
    );
  }
};

/**
 * Phase 1: カラーフィルター適用（x1サイズ）
 * GPU/CPUでフィルター処理を行い、フィルター済みピクセルデータを返す
 */
const applyColorFilterToOverlay = async (
  overlayBitmap: ImageBitmap,
  colorFilter: [number, number, number][] | undefined,
  compute_device: "gpu" | "cpu",
  originalData?: Uint8ClampedArray,
): Promise<Uint8ClampedArray> => {
  let cachedOriginalData = originalData;
  const getOriginalData = (): Uint8ClampedArray => {
    if (!cachedOriginalData) {
      cachedOriginalData = convertImageBitmapToUint8ClampedArray(overlayBitmap);
    }
    return cachedOriginalData;
  };

  if (compute_device === "gpu" && colorFilter !== undefined) {
    try {
      return await processGpuColorFilter(overlayBitmap, colorFilter);
    } catch (error) {
      console.log("🧑‍🎨 : GPU processing failed, fallback to CPU", error);
      return processCpuColorFilter(getOriginalData(), { filters: colorFilter });
    }
  } else if (compute_device === "cpu" && colorFilter !== undefined) {
    return processCpuColorFilter(getOriginalData(), { filters: colorFilter });
  } else {
    return getOriginalData();
  }
};

/**
 * Phase 2: 背景比較 + 統計計算（x1サイズ）
 * オーバーレイと背景を比較し、色ごとの統計を計算
 * total: 元画像の色でカウント（カラーフィルター無関係）
 * matched: 元画像の色でカウント（カラーフィルター無関係）
 *
 * NOTE: totalは全ピクセルをカウント、matchedは背景範囲内のみ
 * NOTE: 統計はカラーフィルターの状態に依存せず、元画像の色で計算される
 */
const computeStatsWithBackground = (
  originalData: Uint8ClampedArray,
  width: number,
  height: number,
  bgData: Uint8ClampedArray,
  bgWidth: number,
  offsetX: number,
  offsetY: number,
  stats: ColorStats,
): void => {
  // "r,g,b" 文字列生成を色ごとに1回へ抑える
  const colorKeyCache = new Map<number, string>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      // 透明ピクセルをスキップ（元画像基準）
      if (originalData[i + 3] === 0) continue;

      // total: 元画像の色でカウント（カラーフィルター無関係）
      const origR = originalData[i];
      const origG = originalData[i + 1];
      const origB = originalData[i + 2];
      const colorInt = (origR << 16) | (origG << 8) | origB;
      let totalColorKey = colorKeyCache.get(colorInt);
      if (!totalColorKey) {
        totalColorKey = colorToKey([origR, origG, origB]);
        colorKeyCache.set(colorInt, totalColorKey);
      }
      stats.total.set(totalColorKey, (stats.total.get(totalColorKey) || 0) + 1);

      // matched: 元画像の色でカウント（カラーフィルター無関係）
      // 背景位置を計算
      const bgX = offsetX + x;
      const bgY = offsetY + y;
      const bgI = (bgY * bgWidth + bgX) * 4;

      // 背景の範囲外のピクセルはスキップ（matchedのみ）
      if (bgI + 3 >= bgData.length) continue;

      // 背景比較（元画像の色で）
      const bgR = bgData[bgI];
      const bgG = bgData[bgI + 1];
      const bgB = bgData[bgI + 2];
      const bgA = bgData[bgI + 3];

      const colorMatches = isSameColorComponents(
        origR,
        origG,
        origB,
        bgR,
        bgG,
        bgB,
        bgA,
      );

      if (colorMatches) {
        stats.matched.set(
          totalColorKey,
          (stats.matched.get(totalColorKey) || 0) + 1,
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
  comparisonData: Uint8ClampedArray | null,
  width: number,
  height: number,
  bgData: Uint8ClampedArray,
  bgWidth: number,
  offsetX: number,
  offsetY: number,
  mode: EnhancedMode,
  shouldSkipRendering: boolean,
  showUnplacedOnly: boolean = false,
  enhancedColor: readonly [number, number, number] = [255, 0, 0],
  showUnplacedColor: readonly [number, number, number] = [160, 160, 160],
  selectedColorOnlyMarkRGB: readonly [number, number, number] | null = null,
  originalDataForMark: Uint8ClampedArray | null = null,
): Uint8ClampedArray => {
  const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
  const scaledWidth = width * pixelScale;
  const scaledHeight = height * pixelScale;
  const scaledData = new Uint8ClampedArray(scaledWidth * scaledHeight * 4);
  const scaledStride = scaledWidth * 4;
  const [ecR, ecG, ecB] = enhancedColor;

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

  for (let y1 = 0; y1 < height; y1++) {
    for (let x1 = 0; x1 < width; x1++) {
      const srcI = (y1 * width + x1) * 4;

      // x1データから取得
      const r = data[srcI];
      const g = data[srcI + 1];
      const b = data[srcI + 2];
      const a = data[srcI + 3];

      // ON時のみ元画像基準で背景一致判定（OFF時は従来どおり描画データ基準）
      const useOriginalComparison = showUnplacedOnly && comparisonData !== null;
      if (!useOriginalComparison && a === 0) continue;
      const cmpR = useOriginalComparison ? comparisonData[srcI] : r;
      const cmpG = useOriginalComparison ? comparisonData[srcI + 1] : g;
      const cmpB = useOriginalComparison ? comparisonData[srcI + 2] : b;
      const cmpA = useOriginalComparison ? comparisonData[srcI + 3] : a;
      if (cmpA === 0) continue;

      // 背景色取得
      const bgX1 = offsetX + x1;
      const bgY1 = offsetY + y1;
      const bgI1 = (bgY1 * bgWidth + bgX1) * 4;

      if (bgI1 + 3 >= bgData.length) continue;

      const bgR = bgData[bgI1];
      const bgG = bgData[bgI1 + 1];
      const bgB = bgData[bgI1 + 2];
      const bgA = bgData[bgI1 + 3];

      const colorMatches = isSameColorComponents(
        cmpR,
        cmpG,
        cmpB,
        bgR,
        bgG,
        bgB,
        bgA,
      );

      // 通常: 配置済みピクセルは非表示
      // トグルON: 配置済みピクセルを専用色レイヤーで表示する
      if (colorMatches && !showUnplacedOnly) continue;

      const baseX = x1 * pixelScale;
      const baseY = y1 * pixelScale;
      const row0 = (baseY * scaledWidth + baseX) * 4;
      const row1 = row0 + scaledStride;
      const row2 = row1 + scaledStride;

      const topLeft = row0;
      const topCenter = row0 + 4;
      const topRight = row0 + 8;
      const midLeft = row1;
      const center = row1 + 4;
      const midRight = row1 + 8;
      const bottomLeft = row2;
      const bottomCenter = row2 + 4;
      const bottomRight = row2 + 8;

      if (showUnplacedOnly && colorMatches) {
        // 配置済みを専用色で塗る。視認性のため元色を少しだけ残す
        const matchedR = (showUnplacedColor[0] * 224 + cmpR * 32) >> 8;
        const matchedG = (showUnplacedColor[1] * 224 + cmpG * 32) >> 8;
        const matchedB = (showUnplacedColor[2] * 224 + cmpB * 32) >> 8;
        const matchedA = 255;

        scaledData[topLeft] = matchedR;
        scaledData[topLeft + 1] = matchedG;
        scaledData[topLeft + 2] = matchedB;
        scaledData[topLeft + 3] = matchedA;
        scaledData[topCenter] = matchedR;
        scaledData[topCenter + 1] = matchedG;
        scaledData[topCenter + 2] = matchedB;
        scaledData[topCenter + 3] = matchedA;
        scaledData[topRight] = matchedR;
        scaledData[topRight + 1] = matchedG;
        scaledData[topRight + 2] = matchedB;
        scaledData[topRight + 3] = matchedA;

        scaledData[midLeft] = matchedR;
        scaledData[midLeft + 1] = matchedG;
        scaledData[midLeft + 2] = matchedB;
        scaledData[midLeft + 3] = matchedA;
        scaledData[center] = matchedR;
        scaledData[center + 1] = matchedG;
        scaledData[center + 2] = matchedB;
        scaledData[center + 3] = matchedA;
        scaledData[midRight] = matchedR;
        scaledData[midRight + 1] = matchedG;
        scaledData[midRight + 2] = matchedB;
        scaledData[midRight + 3] = matchedA;

        scaledData[bottomLeft] = matchedR;
        scaledData[bottomLeft + 1] = matchedG;
        scaledData[bottomLeft + 2] = matchedB;
        scaledData[bottomLeft + 3] = matchedA;
        scaledData[bottomCenter] = matchedR;
        scaledData[bottomCenter + 1] = matchedG;
        scaledData[bottomCenter + 2] = matchedB;
        scaledData[bottomCenter + 3] = matchedA;
        scaledData[bottomRight] = matchedR;
        scaledData[bottomRight + 1] = matchedG;
        scaledData[bottomRight + 2] = matchedB;
        scaledData[bottomRight + 3] = matchedA;
        continue;
      }
      // showUnplacedOnly時でも未配置表示は選択色フィルターに従う
      if (a === 0) continue;

      // selectedColorOnlyMark: 選択色以外はdot表示にフォールバック
      if (selectedColorOnlyMarkRGB && originalDataForMark) {
        const origR = originalDataForMark[srcI];
        const origG = originalDataForMark[srcI + 1];
        const origB = originalDataForMark[srcI + 2];
        if (
          origR !== selectedColorOnlyMarkRGB[0] ||
          origG !== selectedColorOnlyMarkRGB[1] ||
          origB !== selectedColorOnlyMarkRGB[2]
        ) {
          // dot: 中心ピクセルのみ
          const baseX = x1 * pixelScale;
          const baseY = y1 * pixelScale;
          const dotCenter = ((baseY + 1) * scaledWidth + (baseX + 1)) * 4;
          scaledData[dotCenter] = r;
          scaledData[dotCenter + 1] = g;
          scaledData[dotCenter + 2] = b;
          scaledData[dotCenter + 3] = a;
          continue;
        }
      }

      // border-onlyは枠のみなので中心スキップ
      if (mode !== "border-only") {
        scaledData[center] = r;
        scaledData[center + 1] = g;
        scaledData[center + 2] = b;
        scaledData[center + 3] = a;
        // huge marker: 中心座標を収集
        if (needsHugeMarker)
          unplacedCenters.push({ x: baseX + 1, y: baseY + 1 });
      }

      // huge marker は 2nd pass で処理するので、1st pass では中心+crossのみ
      if (needsHugeMarker) {
        scaledData[topCenter] = r;
        scaledData[topCenter + 1] = g;
        scaledData[topCenter + 2] = b;
        scaledData[topCenter + 3] = a;

        scaledData[midLeft] = r;
        scaledData[midLeft + 1] = g;
        scaledData[midLeft + 2] = b;
        scaledData[midLeft + 3] = a;

        scaledData[midRight] = r;
        scaledData[midRight + 1] = g;
        scaledData[midRight + 2] = b;
        scaledData[midRight + 3] = a;

        scaledData[bottomCenter] = r;
        scaledData[bottomCenter + 1] = g;
        scaledData[bottomCenter + 2] = b;
        scaledData[bottomCenter + 3] = a;
        continue;
      }

      if (mode === "dot") {
        // 書き込まない（中心のみ）
        continue;
      }

      if (mode === "cross") {
        scaledData[topCenter] = r;
        scaledData[topCenter + 1] = g;
        scaledData[topCenter + 2] = b;
        scaledData[topCenter + 3] = a;

        scaledData[midLeft] = r;
        scaledData[midLeft + 1] = g;
        scaledData[midLeft + 2] = b;
        scaledData[midLeft + 3] = a;

        scaledData[midRight] = r;
        scaledData[midRight + 1] = g;
        scaledData[midRight + 2] = b;
        scaledData[midRight + 3] = a;

        scaledData[bottomCenter] = r;
        scaledData[bottomCenter + 1] = g;
        scaledData[bottomCenter + 2] = b;
        scaledData[bottomCenter + 3] = a;
        continue;
      }

      if (mode === "fill") {
        // 3x3全体を描画
        scaledData[topLeft] = r;
        scaledData[topLeft + 1] = g;
        scaledData[topLeft + 2] = b;
        scaledData[topLeft + 3] = a;
        scaledData[topCenter] = r;
        scaledData[topCenter + 1] = g;
        scaledData[topCenter + 2] = b;
        scaledData[topCenter + 3] = a;
        scaledData[topRight] = r;
        scaledData[topRight + 1] = g;
        scaledData[topRight + 2] = b;
        scaledData[topRight + 3] = a;

        scaledData[midLeft] = r;
        scaledData[midLeft + 1] = g;
        scaledData[midLeft + 2] = b;
        scaledData[midLeft + 3] = a;
        scaledData[center] = r;
        scaledData[center + 1] = g;
        scaledData[center + 2] = b;
        scaledData[center + 3] = a;
        scaledData[midRight] = r;
        scaledData[midRight + 1] = g;
        scaledData[midRight + 2] = b;
        scaledData[midRight + 3] = a;

        scaledData[bottomLeft] = r;
        scaledData[bottomLeft + 1] = g;
        scaledData[bottomLeft + 2] = b;
        scaledData[bottomLeft + 3] = a;
        scaledData[bottomCenter] = r;
        scaledData[bottomCenter + 1] = g;
        scaledData[bottomCenter + 2] = b;
        scaledData[bottomCenter + 3] = a;
        scaledData[bottomRight] = r;
        scaledData[bottomRight + 1] = g;
        scaledData[bottomRight + 2] = b;
        scaledData[bottomRight + 3] = a;
        continue;
      }

      if (mode === "border-only") {
        // 枠のみ描画（中心は透明）
        scaledData[topLeft] = r;
        scaledData[topLeft + 1] = g;
        scaledData[topLeft + 2] = b;
        scaledData[topLeft + 3] = a;
        scaledData[topCenter] = r;
        scaledData[topCenter + 1] = g;
        scaledData[topCenter + 2] = b;
        scaledData[topCenter + 3] = a;
        scaledData[topRight] = r;
        scaledData[topRight + 1] = g;
        scaledData[topRight + 2] = b;
        scaledData[topRight + 3] = a;

        scaledData[midLeft] = r;
        scaledData[midLeft + 1] = g;
        scaledData[midLeft + 2] = b;
        scaledData[midLeft + 3] = a;
        scaledData[midRight] = r;
        scaledData[midRight + 1] = g;
        scaledData[midRight + 2] = b;
        scaledData[midRight + 3] = a;

        scaledData[bottomLeft] = r;
        scaledData[bottomLeft + 1] = g;
        scaledData[bottomLeft + 2] = b;
        scaledData[bottomLeft + 3] = a;
        scaledData[bottomCenter] = r;
        scaledData[bottomCenter + 1] = g;
        scaledData[bottomCenter + 2] = b;
        scaledData[bottomCenter + 3] = a;
        scaledData[bottomRight] = r;
        scaledData[bottomRight + 1] = g;
        scaledData[bottomRight + 2] = b;
        scaledData[bottomRight + 3] = a;
        continue;
      }

      // 補助色を使うパターン
      const [ar, ag, ab] = getAuxiliaryColor(mode, [r, g, b], enhancedColor);
      scaledData[topCenter] = ar;
      scaledData[topCenter + 1] = ag;
      scaledData[topCenter + 2] = ab;
      scaledData[topCenter + 3] = 255;

      scaledData[midLeft] = ar;
      scaledData[midLeft + 1] = ag;
      scaledData[midLeft + 2] = ab;
      scaledData[midLeft + 3] = 255;

      scaledData[midRight] = ar;
      scaledData[midRight + 1] = ag;
      scaledData[midRight + 2] = ab;
      scaledData[midRight + 3] = 255;

      scaledData[bottomCenter] = ar;
      scaledData[bottomCenter + 1] = ag;
      scaledData[bottomCenter + 2] = ab;
      scaledData[bottomCenter + 3] = 255;

      if (mode === "red-border") {
        // 赤枠モードは腕以外(4隅)も赤
        scaledData[topLeft] = ecR;
        scaledData[topLeft + 1] = ecG;
        scaledData[topLeft + 2] = ecB;
        scaledData[topLeft + 3] = 255;
        scaledData[topRight] = ecR;
        scaledData[topRight + 1] = ecG;
        scaledData[topRight + 2] = ecB;
        scaledData[topRight + 3] = 255;

        scaledData[bottomLeft] = ecR;
        scaledData[bottomLeft + 1] = ecG;
        scaledData[bottomLeft + 2] = ecB;
        scaledData[bottomLeft + 3] = 255;
        scaledData[bottomRight] = ecR;
        scaledData[bottomRight + 1] = ecG;
        scaledData[bottomRight + 2] = ecB;
        scaledData[bottomRight + 3] = 255;
      }
    }
  }

  // 2nd pass: huge marker 描画
  // Per-mode pixel limit (undefined = no limit)
  const modeOption = ENHANCED_MODE_OPTIONS.find((o) => o.value === mode);
  const maxPixels = modeOption?.maxPixels;
  if (
    needsHugeMarker &&
    unplacedCenters.length > 0 &&
    (maxPixels === undefined || unplacedCenters.length <= maxPixels)
  ) {
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
          scaledData[i] = ecR;
          scaledData[i + 1] = ecG;
          scaledData[i + 2] = ecB;
          scaledData[i + 3] = 255;
        }
        // 垂直腕
        for (let dy = -armLength; dy <= armLength; dy++) {
          if (Math.abs(dy) <= centerSize) continue; // 中心3x3はスキップ
          const py = cy + dy;
          if (py < 0 || py >= scaledHeight) continue;
          const i = (py * scaledWidth + cx) * 4;
          scaledData[i] = ecR;
          scaledData[i + 1] = ecG;
          scaledData[i + 2] = ecB;
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
            scaledData[i] = ecR;
            scaledData[i + 1] = ecG;
            scaledData[i + 2] = ecB;
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
            scaledData[i] = ecR;
            scaledData[i + 1] = ecG;
            scaledData[i + 2] = ecB;
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
            scaledData[i] = ecR;
            scaledData[i + 1] = ecG;
            scaledData[i + 2] = ecB;
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
  height: number,
): Promise<ImageBitmap> => {
  // ArrayBuffer由来ならコピーせず使い、型要件を満たさない場合のみコピーする
  const imageDataInput =
    data.buffer instanceof ArrayBuffer
      ? (data as Uint8ClampedArray<ArrayBuffer>)
      : new Uint8ClampedArray(data);
  const imageData = new ImageData(imageDataInput, width, height);
  return await createImageBitmap(imageData);
};

/**
 * オーバーレイ最終処理（メイン関数）
 * 1. 背景比較+統計計算（x1サイズ）- カラーフィルター無関係
 * 2. カラーフィルター適用（x1サイズ）- 描画用
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
  compute_device: "gpu" | "cpu" = "gpu",
  skipStatsComputation: boolean = false,
  enhancedColor: [number, number, number] = [255, 0, 0],
): Promise<ImageBitmap> => {
  const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
  const width = overlayBitmap.width;
  const height = overlayBitmap.height;

  // カラーフィルター取得
  const colorFilter = isColorFilterActive() ? getSelectedRGBs() : undefined;

  // 元のオーバーレイデータ（必要時のみデコード）
  let originalData: Uint8ClampedArray | undefined;
  const getOriginalData = (): Uint8ClampedArray => {
    if (!originalData) {
      originalData = convertImageBitmapToUint8ClampedArray(overlayBitmap);
    }
    return originalData;
  };

  // 背景データ準備
  const bgData = new Uint8ClampedArray(bgPixels.buffer);

  // Phase 1: 背景比較 + 統計計算（カラーフィルター無関係）
  // Skip if we already have stats for this tile
  if (!skipStatsComputation) {
    // 統計初期化
    if (!tempStatsMap.has(imageKey)) {
      tempStatsMap.set(imageKey, {
        matched: new Map(),
        total: new Map(),
      });
    }
    const stats = tempStatsMap.get(imageKey)!;

    computeStatsWithBackground(
      getOriginalData(),
      width,
      height,
      bgData,
      bgWidth,
      offsetX,
      offsetY,
      stats,
    );
  }

  // Phase 2: カラーフィルター適用（描画用のみ）
  const filteredData = await applyColorFilterToOverlay(
    overlayBitmap,
    colorFilter,
    compute_device,
    originalData,
  );

  // Phase 3: x3拡大 + モード別処理
  const shouldSkipRendering =
    colorFilter !== undefined && colorFilter.length === 0;

  const showUnplacedOnly = window.mrWplaceShowUnplacedOnly ?? false;
  const comparisonData = showUnplacedOnly ? getOriginalData() : null;
  const showUnplacedColor = getShowUnplacedColor();

  // selectedColorOnlyMark: 選択色のRGBを解決
  let selectedColorOnlyMarkRGB: readonly [number, number, number] | null = null;
  let originalDataForMark: Uint8ClampedArray | null = null;
  if (window.mrWplaceSelectedColorOnlyMark) {
    const selectedColorId = localStorage.getItem("selected-color");
    if (selectedColorId) {
      const entry = colorpalette.find((c) => c.id === Number(selectedColorId));
      if (entry) {
        selectedColorOnlyMarkRGB = entry.rgb;
        originalDataForMark = getOriginalData();
      }
    }
  }

  const scaledData = scaleAndRenderWithMode(
    filteredData,
    comparisonData,
    width,
    height,
    bgData,
    bgWidth,
    offsetX,
    offsetY,
    mode,
    shouldSkipRendering,
    showUnplacedOnly,
    enhancedColor,
    showUnplacedColor,
    selectedColorOnlyMarkRGB,
    originalDataForMark,
  );

  // Phase 4: ImageBitmap変換
  return await convertToImageBitmap(
    scaledData,
    width * pixelScale,
    height * pixelScale,
  );
};

export const drawOverlayLayersOnTile = async (
  tileBlob: Blob,
  tileCoords: TileCoords,
  computeDevice: "gpu" | "cpu" = "gpu",
  options: {
    comparisonTileBlob?: Blob;
  } = {},
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
      const affectedTileSet =
        instance.affectedTileSet ??
        (instance.affectedTileSet = new Set(instance.affectedTiles));
      // Check if current tile is in affectedTiles
      if (affectedTileSet.has(coordStrV2)) {
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
          instance.bounds.bottom,
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
        tile.startsWith(coordStrPadded),
      );
      for (const tileKey of tiles) {
        matchingTiles.push({ tileKey, instance });
      }
    }
  }

  if (matchingTiles.length === 0) return tileBlob;

  // 一時統計マップ: 複数タイルまたがり対応
  const tempStatsMap = new Map<string, ColorStats>();

  // 背景タイル1回デコード（下地描画用）
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
      TILE_DRAW_CONSTANTS.TILE_SIZE * TILE_DRAW_CONSTANTS.TILE_SIZE * 4,
    );
    finalBgWidth = TILE_DRAW_CONSTANTS.TILE_SIZE;
    finalBgHeight = TILE_DRAW_CONSTANTS.TILE_SIZE;
  }

  // 背景比較用タイル（未指定時は下地と同一を使い再デコードを避ける）
  let comparisonBgPixels = finalBgPixels;
  let comparisonBgWidth = finalBgWidth;
  const comparisonTileBlob = options.comparisonTileBlob;

  if (comparisonTileBlob && comparisonTileBlob !== tileBlob) {
    const {
      pixels: comparePixels,
      width: compareWidth,
      height: compareHeight,
    } = await blobToPixels(comparisonTileBlob);

    if (compareWidth === 1 && compareHeight === 1) {
      comparisonBgPixels = new Uint8Array(
        TILE_DRAW_CONSTANTS.TILE_SIZE * TILE_DRAW_CONSTANTS.TILE_SIZE * 4,
      );
      comparisonBgWidth = TILE_DRAW_CONSTANTS.TILE_SIZE;
    } else {
      comparisonBgPixels = comparePixels;
      comparisonBgWidth = compareWidth;
    }
  }

  const bgImageData = new ImageData(
    new Uint8ClampedArray(finalBgPixels),
    finalBgWidth,
    finalBgHeight,
  );
  const tileBitmap = await createImageBitmap(bgImageData);

  // キャンバス作成（実サイズベース）
  const drawSize =
    Math.max(finalBgWidth, finalBgHeight) * TILE_DRAW_CONSTANTS.RENDER_SCALE;
  const canvas = new OffscreenCanvas(drawSize, drawSize);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("tile canvas context not found");
  context.imageSmoothingEnabled = false;

  // 元タイル画像を下地化（デコード済みImageBitmap）
  context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

  // 描画モードと色を取得
  const mode = getEnhancedMode();
  const enhancedColor = getEnhancedColor();

  // GalleryRepository v2 は必要時のみ初回1回だけ解決する
  let galleryRepoV2:
    | { getTile: (layerId: string, tileKey: string) => Promise<Blob | null> }
    | null
    | undefined;
  const getGalleryRepoV2 = async (): Promise<{
    getTile: (layerId: string, tileKey: string) => Promise<Blob | null>;
  } | null> => {
    if (galleryRepoV2 !== undefined) return galleryRepoV2;

    try {
      const { getGalleryRepository } =
        await import("../../db/gallery-repository");
      galleryRepoV2 = getGalleryRepository();
    } catch (error) {
      console.error(`🧑‍🎨 : Error loading gallery repository v2:`, error);
      galleryRepoV2 = null;
    }

    return galleryRepoV2;
  };

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
      const repoV2 = await getGalleryRepoV2();
      console.log(
        `🧑‍🎨 : Trying to load tile [${
          instance.imageKey
        }, ${tileKey}], repoV2 initialized=${!!repoV2}`,
      );
      if (repoV2) {
        const tileBlob = await repoV2.getTile(instance.imageKey, tileKey);
        console.log(
          `🧑‍🎨 : getTile result for [${instance.imageKey}, ${tileKey}]: ${
            tileBlob ? `Blob(${tileBlob.size})` : "null"
          }`,
        );
        if (tileBlob) {
          paintedTilebitmap = await createImageBitmap(tileBlob);
          // Cache in memory for faster subsequent access
          if (!instance.tiles) {
            instance.tiles = {};
          }
          instance.tiles[tileKey] = paintedTilebitmap;
          console.log(
            `🧑‍🎨 : Loaded tile ${tileKey} from IndexedDB v2 for ${instance.imageKey}`,
          );
        }
      }
    }

    if (!paintedTilebitmap) continue;

    // v2 tiles: already positioned within 1000x1000 tile, draw at (0,0)
    // legacy tiles: have pixel offset in tileKey, draw at that offset
    const offsetX = isV2Tile ? 0 : Number(coords[2]);
    const offsetY = isV2Tile ? 0 : Number(coords[3]);

    // Check if we already have stats for this tile+image (caching)
    const imageStatsMap = perTileColorStats.get(instance.imageKey);
    const alreadyHasStats = imageStatsMap?.has(coordStrPadded) ?? false;

    paintedTilebitmap = await applyOverlayProcessing(
      paintedTilebitmap,
      comparisonBgPixels,
      comparisonBgWidth,
      offsetX,
      offsetY,
      mode,
      instance.imageKey,
      tempStatsMap,
      computeDevice,
      alreadyHasStats,
      enhancedColor,
    );

    context.drawImage(
      paintedTilebitmap,
      offsetX * TILE_DRAW_CONSTANTS.RENDER_SCALE,
      offsetY * TILE_DRAW_CONSTANTS.RENDER_SCALE,
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
  lng: number,
): Promise<{ r: number; g: number; b: number; a: number } | null> => {
  const coords = latLngToTilePixel(lat, lng);
  const coordPrefix = `${coords.TLX.toString().padStart(
    4,
    "0",
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
