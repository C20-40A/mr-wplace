import { splitImageOnTiles } from "./splitImageOnTiles";
import { TILE_DRAW_CONSTANTS, WplaceCoords, TileCoords } from "./constants";
import { llzToTilePixel } from "../../utils/coordinate";
import type { TileDrawInstance, ColorStats, EnhancedMode } from "./types";
import { getAuxiliaryColor, isSameColor, colorToKey } from "./color-processing";
import { getGridPosition } from "./pixel-processing";
import { gpuApplyColorFilter } from "./gpu-filter";

export class TileDrawManager {
  public tileSize: number;
  public renderScale: number;
  public overlayLayers: TileDrawInstance[];
  private colorStatsMap = new Map<string, ColorStats>();

  constructor() {
    this.tileSize = TILE_DRAW_CONSTANTS.TILE_SIZE;
    this.renderScale = TILE_DRAW_CONSTANTS.RENDER_SCALE;
    this.overlayLayers = [];
  }

  async addImageToOverlayLayers(
    blob: File,
    coords: WplaceCoords,
    imageKey: string
  ): Promise<void> {
    this.removePreparedOverlayImageByKey(imageKey);

    const { preparedOverlayImages: preparedOverlayImage } =
      await splitImageOnTiles({
        file: blob,
        coords,
        tileSize: this.tileSize,
      });

    this.overlayLayers.push({
      coords,
      tiles: preparedOverlayImage,
      imageKey,
      drawEnabled: true,
    });
  }

  async drawOverlayLayersOnTile(
    tileBlob: Blob,
    tileCoords: TileCoords
  ): Promise<Blob> {
    if (this.overlayLayers.length === 0) return tileBlob; // 描画するものがなければスキップ

    const coordStr =
      tileCoords[0].toString().padStart(4, "0") +
      "," +
      tileCoords[1].toString().padStart(4, "0");

    // 現在タイルに重なる全オーバーレイ画像のリストを取得
    const matchingTiles: Array<{
      tileKey: string;
      instance: TileDrawInstance;
    }> = [];
    for (const instance of this.overlayLayers) {
      if (!instance.drawEnabled || !instance.tiles) continue;
      const tiles = Object.keys(instance.tiles).filter((tile) =>
        tile.startsWith(coordStr)
      );
      for (const tileKey of tiles) matchingTiles.push({ tileKey, instance });
    }
    if (matchingTiles.length === 0) return tileBlob;

    // 統計リセット: 処理対象imageKeyをクリア（ポーリング再描画時の累積防止）
    const imageKeysToReset = new Set(
      matchingTiles.map((t) => t.instance.imageKey)
    );
    for (const imageKey of imageKeysToReset) {
      this.colorStatsMap.delete(imageKey);
    }

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
      finalBgPixels = new Uint8Array(this.tileSize * this.tileSize * 4);
      finalBgWidth = this.tileSize;
      finalBgHeight = this.tileSize;
    }

    const bgImageData = new ImageData(
      new Uint8ClampedArray(finalBgPixels.buffer),
      finalBgWidth,
      finalBgHeight
    );
    const tileBitmap = await createImageBitmap(bgImageData);

    // キャンバス作成（実サイズベース）
    const drawSize = Math.max(finalBgWidth, finalBgHeight) * this.renderScale;
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

      // 全モード統一処理: x1背景比較 → 処理 → x3拡大（背景ピクセル再利用）
      paintedTilebitmap = await this.applyOverlayProcessing(
        paintedTilebitmap,
        finalBgPixels,
        finalBgWidth,
        Number(coords[2]),
        Number(coords[3]),
        mode,
        instance.imageKey
      );

      context.drawImage(
        paintedTilebitmap,
        Number(coords[2]) * this.renderScale,
        Number(coords[3]) * this.renderScale
      );
    }

    const result = await canvas.convertToBlob({ type: "image/png" });
    return result;
  }

  removePreparedOverlayImageByKey(imageKey: string): void {
    this.overlayLayers = this.overlayLayers.filter(
      (i) => i.imageKey !== imageKey
    );
  }

  toggleDrawEnabled(imageKey: string): boolean {
    const instance = this.overlayLayers.find((i) => i.imageKey === imageKey);
    if (!instance) return false;

    instance.drawEnabled = !instance.drawEnabled;
    return instance.drawEnabled;
  }

  clearAllPreparedOverlayImages(): void {
    this.overlayLayers = [];
  }

  removeTextDrawInstances(): void {
    this.overlayLayers = this.overlayLayers.filter(
      (i) => !i.imageKey.startsWith("text_")
    );
  }

  async getOverlayPixelColor(
    lat: number,
    lng: number
  ): Promise<{ r: number; g: number; b: number; a: number } | null> {
    const coords = llzToTilePixel(lat, lng);
    const coordPrefix = `${coords.TLX.toString().padStart(
      4,
      "0"
    )},${coords.TLY.toString().padStart(4, "0")}`;

    // 後ろから検索（上位レイヤー優先）
    for (let i = this.overlayLayers.length - 1; i >= 0; i--) {
      const instance = this.overlayLayers[i];
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
        const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
        const drawW = bitmap.width / pixelScale;
        const drawH = bitmap.height / pixelScale;

        if (relX < 0 || relX >= drawW || relY < 0 || relY >= drawH) continue;

        // ピクセル取得（3倍スケール）
        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(
          bitmap,
          relX * pixelScale,
          relY * pixelScale,
          1,
          1,
          0,
          0,
          1,
          1
        );
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
  }

  isDrawingOnTile(tileX: number, tileY: number): boolean {
    for (const instance of this.overlayLayers) {
      if (!instance.drawEnabled || !instance.coords) continue;

      const [overlayTileX, overlayTileY] = instance.coords;
      if (overlayTileX === tileX && overlayTileY === tileY) return true;
    }
    return false;
  }

  getColorStats(
    imageKey: string
  ): { matched: Record<string, number>; total: Record<string, number> } | null {
    const stats = this.colorStatsMap.get(imageKey);
    if (!stats) {
      console.log("🧑‍🎨 : getColorStats - no stats for", imageKey);
      return null;
    }

    const result = {
      matched: Object.fromEntries(stats.matched),
      total: Object.fromEntries(stats.total),
    };
    console.log("🧑‍🎨 : getColorStats", imageKey, result);
    return result;
  }

  getAggregatedColorStats(
    imageKeys: string[]
  ): Record<string, { matched: number; total: number }> {
    const aggregated: Record<string, { matched: number; total: number }> = {};

    for (const imageKey of imageKeys) {
      const stats = this.colorStatsMap.get(imageKey);
      if (!stats) continue;

      // matched 集計
      for (const [colorKey, count] of stats.matched.entries()) {
        if (!aggregated[colorKey]) {
          aggregated[colorKey] = { matched: 0, total: 0 };
        }
        aggregated[colorKey].matched += count;
      }

      // total 集計
      for (const [colorKey, count] of stats.total.entries()) {
        if (!aggregated[colorKey]) {
          aggregated[colorKey] = { matched: 0, total: 0 };
        }
        aggregated[colorKey].total += count;
      }
    }

    return aggregated;
  }

  /**
   * オーバーレイ最終処理（全モード統合）
   * 1. カラーフィルター適用（x1サイズ）
   * 2. 背景比較+統計計算（x1サイズ）
   * 3. x3拡大
   * 4. モード別処理（x3サイズ：dot/cross/fill/補助色）
   */
  private async applyOverlayProcessing(
    overlayBitmap: ImageBitmap,
    bgPixels: Uint8Array,
    bgWidth: number,
    offsetX: number,
    offsetY: number,
    mode: EnhancedMode,
    imageKey: string
  ): Promise<ImageBitmap> {
    const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
    const width = overlayBitmap.width;
    const height = overlayBitmap.height;

    // === Phase 1: x1サイズ処理 ===
    // GPU: カラーフィルター適用
    const colorFilter = window.mrWplace?.colorFilterManager?.isFilterActive()
      ? window.mrWplace.colorFilterManager.selectedRGBs
      : undefined;

    const data = await gpuApplyColorFilter(overlayBitmap, colorFilter);
    // overlayBitmapはGPU内でclose済み

    // 背景ピクセル（事前デコード済み）
    const bgData = new Uint8ClampedArray(bgPixels.buffer);

    // 統計初期化
    if (!this.colorStatsMap.has(imageKey)) {
      this.colorStatsMap.set(imageKey, {
        matched: new Map(),
        total: new Map(),
      });
    }
    const stats = this.colorStatsMap.get(imageKey)!;

    // === Phase 1: 背景比較 + 統計計算（x1全ピクセル）===
    // カラーフィルターはGPU適用済み
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

    console.log(
      "🧑‍🎨 : applyOverlayProcessing",
      imageKey,
      "matched:",
      stats.matched.size,
      "total:",
      stats.total.size
    );

    return await createImageBitmap(finalCanvas);
  }
}

const blobToPixels = async (blob: Blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const decoder = new ImageDecoder({ data: arrayBuffer, type: blob.type });
  const { image } = await decoder.decode();
  const width = image.displayWidth;
  const height = image.displayHeight;
  const buf = new Uint8Array(width * height * 4);
  await image.copyTo(buf, { format: "RGBA" });
  image.close();
  return { pixels: buf, width, height };
};
