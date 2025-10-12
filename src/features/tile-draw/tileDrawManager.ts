import { drawImageOnTiles } from "./tile-draw";
import type { EnhancedConfig } from "./tile-draw";
import { TILE_DRAW_CONSTANTS, WplaceCoords, TileCoords } from "./constants";
import { llzToTilePixel } from "../../utils/coordinate";

interface TileDrawInstance {
  coords: WplaceCoords;
  tiles: Record<string, ImageBitmap> | null;
  imageKey: string;
  drawEnabled: boolean;
}

export class TileDrawManager {
  public tileSize: number;
  public renderScale: number;
  public overlayLayers: TileDrawInstance[];
  private colorStatsMap = new Map<string, {
    matched: Map<string, number>;
    total: Map<string, number>;
  }>();

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
    const enhancedConfig = this.getEnhancedConfig();

    const { preparedOverlayImage } = await drawImageOnTiles({
      file: blob,
      coords,
      tileSize: this.tileSize,
      enhanced: enhancedConfig,
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

    const drawSize = this.tileSize * this.renderScale;
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

    // キャンバス作成
    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("tile canvas context not found");
    context.imageSmoothingEnabled = false;

    // 元タイル画像を読み込んで下地化
    const tileBitmap = await createImageBitmap(tileBlob);
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    // 補助色モード判定（ループ前に1回のみ）
    const enhancedConfig = this.getEnhancedConfig();

    // 補助色モードの場合のみ、背景ImageDataを取得（重い処理）
    let backgroundImageData: ImageData | undefined;
    if (this.needsPixelComparison(enhancedConfig.mode)) {
      backgroundImageData = context.getImageData(0, 0, drawSize, drawSize);
    }

    // 透明背景に複数オーバーレイが重なった合成画像を出力
    for (const { tileKey, instance } of matchingTiles) {
      const coords = tileKey.split(",");
      let paintedTilebitmap = instance.tiles?.[tileKey];
      if (!paintedTilebitmap) continue;

      // 統一処理：通常モードは早期リターン、補色モードはピクセル処理
      paintedTilebitmap = await this.applyAuxiliaryColorPattern(
        paintedTilebitmap,
        backgroundImageData,
        Number(coords[2]) * this.renderScale,
        Number(coords[3]) * this.renderScale,
        enhancedConfig.mode,
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

  getColorStats(imageKey: string): { matched: Record<string, number>; total: Record<string, number> } | null {
    const stats = this.colorStatsMap.get(imageKey);
    if (!stats) {
      console.log("🧑‍🎨 : getColorStats - no stats for", imageKey);
      return null;
    }
    
    const result = {
      matched: Object.fromEntries(stats.matched),
      total: Object.fromEntries(stats.total)
    };
    console.log("🧑‍🎨 : getColorStats", imageKey, result);
    return result;
  }

  getAggregatedColorStats(imageKeys: string[]): Record<string, {matched: number, total: number}> {
    const aggregated: Record<string, {matched: number, total: number}> = {};

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

  private getEnhancedConfig(): EnhancedConfig {
    const colorFilterManager = window.mrWplace?.colorFilterManager;
    const mode = colorFilterManager?.getEnhancedMode() ?? "dot";
    return { mode };
  }

  /**
   * 補助色パターンかどうかを判定
   * 補助色パターン：タイル色との比較が必要
   */
  private needsPixelComparison(
    mode: EnhancedConfig["mode"]
  ): mode is
    | "red-cross"
    | "cyan-cross"
    | "dark-cross"
    | "complement-cross"
    | "red-border" {
    return [
      "red-cross",
      "cyan-cross",
      "dark-cross",
      "complement-cross",
      "red-border",
    ].includes(mode);
  }

  /**
   * オーバーレイ画像の最終処理を統一適用
   * - 通常モード(dot/cross/fill): そのまま返す（早期リターン、変換なし）
   * - 補助色モード: 背景比較 + 補助色適用 + 統計計算
   * README.mdの仕様：
   * - タイル色とオーバーレイ色が異なる場合のみ補助色表示
   * - 同じ場合は透明化
   */
  private async applyAuxiliaryColorPattern(
    overlayBitmap: ImageBitmap,
    backgroundImageData: ImageData | undefined,
    offsetX: number,
    offsetY: number,
    mode: EnhancedConfig["mode"],
    imageKey: string
  ): Promise<ImageBitmap> {
    // 通常モード: 変換なしで即座に返す（パフォーマンス最適化）
    if (!this.needsPixelComparison(mode)) {
      return overlayBitmap;
    }

    // 補助色モード: 背景比較必須
    if (!backgroundImageData) {
      throw new Error("Background ImageData required for auxiliary color pattern");
    }
    const pixelScale = TILE_DRAW_CONSTANTS.PIXEL_SCALE;
    const canvas = new OffscreenCanvas(
      overlayBitmap.width,
      overlayBitmap.height
    );
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.drawImage(overlayBitmap, 0, 0);
    const overlayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = overlayData;

    // 統計初期化
    if (!this.colorStatsMap.has(imageKey)) {
      this.colorStatsMap.set(imageKey, {
        matched: new Map(),
        total: new Map()
      });
    }
    const stats = this.colorStatsMap.get(imageKey)!;
    console.log("🧑‍🎨 : applyAuxiliaryColorPattern imageKey:", imageKey);

    // ピクセル単位で処理
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // 透明ピクセルはスキップ
        if (data[i + 3] === 0) continue;

        // 中央ピクセルかどうか
        const isCenterPixel = x % pixelScale === 1 && y % pixelScale === 1;

        // 十字の腕部分かどうか
        const isCrossArm =
          !isCenterPixel && (x % pixelScale === 1 || y % pixelScale === 1);

        // 背景タイルの対応ピクセル色を取得
        const bgX = offsetX + x;
        const bgY = offsetY + y;
        const bgI = (bgY * backgroundImageData.width + bgX) * 4;
        const bgR = backgroundImageData.data[bgI];
        const bgG = backgroundImageData.data[bgI + 1];
        const bgB = backgroundImageData.data[bgI + 2];
        const bgA = backgroundImageData.data[bgI + 3];

        // 背景が透明な場合は、常に補助色を表示（色比較しない）
        // 背景が透明でない場合のみ、色の比較を行う
        const isSameColor =
          bgA > 0 &&
          data[i] === bgR &&
          data[i + 1] === bgG &&
          data[i + 2] === bgB;

        if (isCenterPixel) {
          const colorKey = `${data[i]},${data[i + 1]},${data[i + 2]}`;
          
          // total: 全中央ピクセル色
          stats.total.set(colorKey, (stats.total.get(colorKey) || 0) + 1);
          
          // 中央ピクセル：同じ色なら透明化、異なるなら保持
          if (isSameColor) {
            data[i + 3] = 0; // 透明
            // matched: 背景と同じだった色（正しく塗れた）
            stats.matched.set(colorKey, (stats.matched.get(colorKey) || 0) + 1);
          }
        } else if (isCrossArm) {
          // 十字の腕：同じ色なら透明、異なるなら補助色
          if (isSameColor) {
            data[i + 3] = 0; // 透明
          } else {
            // 補助色を適用
            const auxColor = this.getAuxiliaryColor(
              mode as "red-cross" | "cyan-cross" | "dark-cross" | "complement-cross" | "red-border",
              data[i],
              data[i + 1],
              data[i + 2]
            );
            data[i] = auxColor[0];
            data[i + 1] = auxColor[1];
            data[i + 2] = auxColor[2];
            data[i + 3] = 255;
          }
        } else if (mode === "red-border") {
          // red-border: 周囲８ドットを赤色
          if (!isCenterPixel) {
            if (isSameColor) {
              data[i + 3] = 0; // 透明
            } else {
              data[i] = 255;
              data[i + 1] = 0;
              data[i + 2] = 0;
              data[i + 3] = 255;
            }
          }
        } else {
          // その他（４隅）は透明
          data[i + 3] = 0;
        }
      }
    }

    ctx.putImageData(overlayData, 0, 0);
    
    console.log("🧑‍🎨 : Stats for", imageKey, "matched:", stats.matched.size, "total:", stats.total.size);
    
    return await createImageBitmap(canvas);
  }

  /**
   * モードに応じた補助色を返す
   */
  private getAuxiliaryColor(
    mode:
      | "red-cross"
      | "cyan-cross"
      | "dark-cross"
      | "complement-cross"
      | "red-border",
    r: number,
    g: number,
    b: number
  ): [number, number, number] {
    switch (mode) {
      case "red-cross":
      case "red-border":
        return [255, 0, 0]; // 赤
      case "cyan-cross":
        return [0, 255, 255]; // シアン
      case "dark-cross":
        return [Math.max(0, r - 40), Math.max(0, g - 40), Math.max(0, b - 40)]; // 暗色
      case "complement-cross":
        return [255 - r, 255 - g, 255 - b]; // 補色
      default:
        return [r, g, b];
    }
  }
}
