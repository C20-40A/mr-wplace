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
  private colorStatsMap = new Map<
    string,
    {
      matched: Map<string, number>;
      total: Map<string, number>;
    }
  >();

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

    const { preparedOverlayImage } = await drawImageOnTiles({
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

    // 背景タイル1回デコード（高速化: 下地用+背景比較用）
    const bgPixels = await blobToPixels(tileBlob);
    const bgImageData = new ImageData(
      new Uint8ClampedArray(bgPixels.buffer),
      this.tileSize,
      this.tileSize
    );
    const tileBitmap = await createImageBitmap(bgImageData);

    // キャンバス作成
    const canvas = new OffscreenCanvas(drawSize, drawSize);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("tile canvas context not found");
    context.imageSmoothingEnabled = false;

    // 元タイル画像を下地化（デコード済みImageBitmap）
    context.drawImage(tileBitmap, 0, 0, drawSize, drawSize);

    const enhancedConfig = this.getEnhancedConfig();

    // 透明背景に複数オーバーレイが重なった合成画像を出力
    for (const { tileKey, instance } of matchingTiles) {
      const coords = tileKey.split(",");
      let paintedTilebitmap = instance.tiles?.[tileKey];
      if (!paintedTilebitmap) continue;

      // 全モード統一処理: x1背景比較 → 処理 → x3拡大（背景ピクセル再利用）
      paintedTilebitmap = await this.applyOverlayProcessing(
        paintedTilebitmap,
        bgPixels,
        Number(coords[2]),
        Number(coords[3]),
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
   * オーバーレイ最終処理（全モード統合）
   * 1. カラーフィルター適用（x1サイズ）
   * 2. 背景比較+統計計算（x1サイズ）
   * 3. x3拡大
   * 4. モード別処理（x3サイズ：dot/cross/fill/補助色）
   */
  private async applyOverlayProcessing(
    overlayBitmap: ImageBitmap,
    bgPixels: Uint8Array,
    offsetX: number,
    offsetY: number,
    mode: EnhancedConfig["mode"],
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
        const bgI = (bgY * this.tileSize + bgX) * 4;
        const [bgR, bgG, bgB, bgA] = [
          bgData[bgI],
          bgData[bgI + 1],
          bgData[bgI + 2],
          bgData[bgI + 3],
        ];

        const isSameColor = bgA > 0 && r === bgR && g === bgG && b === bgB;

        // 統計計算
        const colorKey = `${r},${g},${b}`;
        stats.total.set(colorKey, (stats.total.get(colorKey) || 0) + 1);
        if (isSameColor) {
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

          const isCenterPixel = x % pixelScale === 1 && y % pixelScale === 1;
          if (isCenterPixel) {
            // 中心ピクセルは常に書き込み
            scaledData[i] = r;
            scaledData[i + 1] = g;
            scaledData[i + 2] = b;
            scaledData[i + 3] = a;
            continue;
          }

          // 十字形状のアーム部分
          const isCrossArm = x % pixelScale === 1 || y % pixelScale === 1;

          // 背景色取得
          const bgX1 = offsetX + x1;
          const bgY1 = offsetY + y1;
          const bgI1 = (bgY1 * this.tileSize + bgX1) * 4;

          if (bgI1 + 3 >= bgData.length) continue;

          const [bgR, bgG, bgB, bgA] = [
            bgData[bgI1],
            bgData[bgI1 + 1],
            bgData[bgI1 + 2],
            bgData[bgI1 + 3],
          ];

          // 背景と同色なら透明化（書き込まない）
          const isSameColor = bgA > 0 && r === bgR && g === bgG && b === bgB;
          if (isSameColor) continue;

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
          } else if (this.needsPixelComparison(mode)) {
            if (isCrossArm) {
              const [ar, ag, ab] = this.getAuxiliaryColor(mode, r, g, b);
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

  /**
   * モードに応じた補助色を返す
   */
  private getAuxiliaryColor(
    mode: EnhancedConfig["mode"],
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

/**
 * GPU Phase1: カラーフィルター適用（x1サイズ）
 * colorFilter未指定時は全ピクセル通過
 * WebGL2非対応時はthrow（上層でcatch）
 */
async function gpuApplyColorFilter(
  overlayBitmap: ImageBitmap,
  colorFilter?: Array<[number, number, number]>,
  maxFilters = 64
): Promise<Uint8ClampedArray> {
  const width = overlayBitmap.width;
  const height = overlayBitmap.height;

  // WebGL2コンテキスト作成
  const glCanvas = new OffscreenCanvas(width, height);
  const gl = glCanvas.getContext("webgl2", {
    premultipliedAlpha: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error("WebGL2 not available");

  // シェーダーコンパイル
  const compileShader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error("Shader compile error: " + info);
    }
    return s;
  };

  const linkProgram = (vsSrc: string, fsSrc: string) => {
    const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(p);
      gl.deleteProgram(p);
      throw new Error("Program link error: " + info);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return p;
  };

  // 頂点シェーダー: フルスクリーン四角
  const vsSource = `#version 300 es
  in vec2 aPos;
  out vec2 vTexCoord;
  void main(){
    vTexCoord = (aPos + 1.0) * 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  // フラグメントシェーダー: カラーフィルター適用
  const fsSource = `#version 300 es
  precision highp float;
  in vec2 vTexCoord;
  uniform sampler2D uOverlay;
  uniform int uFilterCount;
  uniform vec3 uFilters[${maxFilters}];
  out vec4 outColor;

  const float EPS = 1.0/255.0 + 1e-6;

  void main(){
    vec4 ov = texture(uOverlay, vTexCoord);
    if (ov.a <= 0.0039) {
      outColor = vec4(0.0);
      return;
    }

    // カラーフィルター判定
    if (uFilterCount > 0) {
      bool match = false;
      for (int i = 0; i < ${maxFilters}; ++i) {
        if (i >= uFilterCount) break;
        vec3 f = uFilters[i] / 255.0;
        if (abs(ov.r - f.r) <= EPS && abs(ov.g - f.g) <= EPS && abs(ov.b - f.b) <= EPS) {
          match = true;
          break;
        }
      }
      if (!match) {
        outColor = vec4(0.0);
        return;
      }
    }

    outColor = vec4(ov.rgb, ov.a);
  }`;

  const program = linkProgram(vsSource, fsSource);
  gl.useProgram(program);

  // 頂点バッファ
  const quadBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]),
    gl.STATIC_DRAW
  );
  const aPosLoc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPosLoc);
  gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

  // overlayテクスチャ作成
  const overlayTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, overlayTex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    overlayBitmap
  );

  // GPU転送完了したのでImageBitmap解放
  overlayBitmap.close();

  // sampler uniform設定
  const uOverlayLoc = gl.getUniformLocation(program, "uOverlay");
  gl.uniform1i(uOverlayLoc, 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, overlayTex);

  // カラーフィルターuniform設定
  const uFilterCountLoc = gl.getUniformLocation(program, "uFilterCount");
  const uFiltersLoc = gl.getUniformLocation(program, "uFilters");
  const filters = colorFilter ?? [];
  const sendCount = Math.min(filters.length, maxFilters);
  gl.uniform1i(uFilterCountLoc, sendCount);

  const filterFlat = new Float32Array(maxFilters * 3);
  for (let i = 0; i < sendCount; i++) {
    const [r, g, b] = filters[i];
    filterFlat[i * 3 + 0] = r;
    filterFlat[i * 3 + 1] = g;
    filterFlat[i * 3 + 2] = b;
  }
  if (uFiltersLoc) gl.uniform3fv(uFiltersLoc, filterFlat);

  // Framebuffer作成（TEXTURE1で作成してフィードバックループ回避）
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const outTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, outTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    outTex,
    0
  );
  gl.activeTexture(gl.TEXTURE0); // TEXTURE0に戻す
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Framebuffer incomplete");
  }

  // 描画
  gl.viewport(0, 0, width, height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // readPixels（GPU→CPUコピー）
  const outBuf = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, outBuf);

  // クリーンアップ
  gl.deleteTexture(overlayTex);
  gl.deleteTexture(outTex);
  gl.deleteFramebuffer(fbo);
  gl.deleteBuffer(quadBuffer);
  gl.deleteProgram(program);

  return new Uint8ClampedArray(outBuf.buffer);
}

const blobToPixels = async (blob: Blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const decoder = new ImageDecoder({ data: arrayBuffer, type: blob.type });
  const { image } = await decoder.decode();
  const buf = new Uint8Array(image.displayWidth * image.displayHeight * 4);
  await image.copyTo(buf, { format: "RGBA" });
  image.close();
  return buf;
};
