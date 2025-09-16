import { uint8ToBase64 } from "./utils";

/** テンプレート処理結果の型定義 */
export interface TemplateProcessingResult {
  templateTiles: Record<string, ImageBitmap>;
  templateTilesBuffers: Record<string, string>;
  colorPalette: Record<string, { count: number; enabled: boolean }>;
  tilePrefixes: Set<string>;
}

/** テンプレート入力パラメータの型定義 */
export interface TemplateProcessingInput {
  file: File;
  coords: number[];
  tileSize: number;
  allowedColorsSet: Set<string>;
}

/** ピクセル分析結果の型定義 */
interface PixelAnalysisResult {
  paletteMap: Map<string, number>;
}

/** タイル座標の型定義 */
interface TileCoords {
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
}

/** Canvas描画設定の型定義 */
interface CanvasDrawSettings {
  width: number;
  height: number;
  drawSizeX: number;
  drawSizeY: number;
  shreadSize: number;
}

/** ピクセル分析（純粋関数） */
const analyzePixels = (
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  allowedColorsSet: Set<string>
): PixelAnalysisResult => {
  const paletteMap = new Map<string, number>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];
      const a = imageData[idx + 3];

      if (a === 0) continue; // 透明ピクセルを無視

      const key = allowedColorsSet.has(`${r},${g},${b}`)
        ? `${r},${g},${b}`
        : "other";
      paletteMap.set(key, (paletteMap.get(key) || 0) + 1);
    }
  }

  return { paletteMap };
};

/** タイル座標計算（純粋関数） */
const calculateTileCoords = (
  pixelX: number,
  pixelY: number,
  coords: number[],
  tileSize: number
): TileCoords => ({
  x: coords[0] + Math.floor(pixelX / tileSize),
  y: coords[1] + Math.floor(pixelY / tileSize),
  pixelX: pixelX % tileSize,
  pixelY: pixelY % tileSize,
});

/** Canvas描画設定計算（純粋関数） */
const calculateCanvasSettings = (
  pixelX: number,
  pixelY: number,
  imageWidth: number,
  imageHeight: number,
  coords: number[],
  tileSize: number,
  shreadSize: number
): CanvasDrawSettings => {
  const drawSizeX = Math.min(
    tileSize - (pixelX % tileSize),
    imageWidth - (pixelX - coords[2])
  );
  const drawSizeY = Math.min(
    tileSize - (pixelY % tileSize),
    imageHeight - (pixelY - coords[3])
  );

  return {
    width: drawSizeX * shreadSize,
    height: drawSizeY * shreadSize,
    drawSizeX,
    drawSizeY,
    shreadSize,
  };
};

/** ImageDataピクセル処理（純粋関数） */
const processImageDataPixels = (
  imageData: ImageData,
  allowedColorsSet: Set<string>,
  shreadSize: number
): ImageData => {
  const { data, width, height } = imageData;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIndex = (y * width + x) * 4;

      // #deface色の場合、チェッカーボードパターンを適用
      if (
        data[pixelIndex] === 222 &&
        data[pixelIndex + 1] === 250 &&
        data[pixelIndex + 2] === 206
      ) {
        if ((x + y) % 2 === 0) {
          data[pixelIndex] = 0;
          data[pixelIndex + 1] = 0;
          data[pixelIndex + 2] = 0;
        } else {
          data[pixelIndex] = 255;
          data[pixelIndex + 1] = 255;
          data[pixelIndex + 2] = 255;
        }
        data[pixelIndex + 3] = 32; // 半透明にする
      } else if (x % shreadSize !== 1 || y % shreadSize !== 1) {
        // 中央ピクセル以外は透明にする
        data[pixelIndex + 3] = 0;
      } else {
        // 中央ピクセル: 許可色セットにない場合の処理（元のコードではコメントアウト）
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];
        if (!allowedColorsSet.has(`${r},${g},${b}`)) {
          // data[pixelIndex + 3] = 0; // 元のコードではコメントアウト
        }
      }
    }
  }

  return imageData;
};

/** 単一タイル処理（非同期関数だが副作用を最小化） */
const processSingleTile = async (
  bitmap: ImageBitmap,
  coords: number[],
  pixelX: number,
  pixelY: number,
  settings: CanvasDrawSettings,
  allowedColorsSet: Set<string>
): Promise<{ bitmap: ImageBitmap; buffer: string; tileName: string }> => {
  const canvas = new OffscreenCanvas(settings.width, settings.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Failed to get 2D context");
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, settings.width, settings.height);

  // 画像描画
  context.drawImage(
    bitmap,
    pixelX - coords[2],
    pixelY - coords[3],
    settings.drawSizeX,
    settings.drawSizeY,
    0,
    0,
    settings.drawSizeX * settings.shreadSize,
    settings.drawSizeY * settings.shreadSize
  );

  // ImageData処理
  const imageData = context.getImageData(0, 0, settings.width, settings.height);
  const processedImageData = processImageDataPixels(
    imageData,
    allowedColorsSet,
    settings.shreadSize
  );

  context.putImageData(processedImageData, 0, 0);

  // タイル名生成
  const tileCoords = calculateTileCoords(pixelX, pixelY, coords, 1000);
  const tileName = `${tileCoords.x.toString().padStart(4, "0")},${tileCoords.y
    .toString()
    .padStart(4, "0")},${tileCoords.pixelX
    .toString()
    .padStart(3, "0")},${tileCoords.pixelY.toString().padStart(3, "0")}`;

  // 結果生成
  const resultBitmap = await createImageBitmap(canvas);
  const canvasBlob = await canvas.convertToBlob();
  const canvasBuffer = await canvasBlob.arrayBuffer();
  const canvasBufferBytes = new Uint8Array(canvasBuffer);
  const bufferString = uint8ToBase64(canvasBufferBytes);

  return {
    bitmap: resultBitmap,
    buffer: bufferString,
    tileName,
  };
};

/** メインのテンプレート処理関数（関数型スタイル） */
export const createTemplateTiles = async (
  input: TemplateProcessingInput
): Promise<TemplateProcessingResult> => {
  const { file, coords, tileSize, allowedColorsSet } = input;
  const shreadSize = 3;

  // 基本画像情報取得
  const bitmap = await createImageBitmap(file);
  const imageWidth = bitmap.width;
  const imageHeight = bitmap.height;
  const totalPixels = imageWidth * imageHeight;

  console.log(
    `Template pixel analysis - Dimensions: ${imageWidth}×${imageHeight} = ${totalPixels.toLocaleString()} pixels`
  );

  // ピクセル分析
  let pixelAnalysis: PixelAnalysisResult;
  try {
    const inspectCanvas = new OffscreenCanvas(imageWidth, imageHeight);
    const inspectCtx = inspectCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    if (!inspectCtx) throw new Error("Failed to get inspect context");

    inspectCtx.imageSmoothingEnabled = false;
    inspectCtx.clearRect(0, 0, imageWidth, imageHeight);
    inspectCtx.drawImage(bitmap, 0, 0);
    const inspectData = inspectCtx.getImageData(
      0,
      0,
      imageWidth,
      imageHeight
    ).data;

    pixelAnalysis = analyzePixels(
      inspectData,
      imageWidth,
      imageHeight,
      allowedColorsSet
    );
  } catch (err) {
    // フェイルセーフ
    pixelAnalysis = {
      paletteMap: new Map(),
    };
  }

  // タイル処理
  const templateTiles: Record<string, ImageBitmap> = {};
  const templateTilesBuffers: Record<string, string> = {};
  const tilePrefixes = new Set<string>();

  for (let pixelY = coords[3]; pixelY < imageHeight + coords[3]; ) {
    const settings = calculateCanvasSettings(
      coords[2],
      pixelY,
      imageWidth,
      imageHeight,
      coords,
      tileSize,
      shreadSize
    );

    for (let pixelX = coords[2]; pixelX < imageWidth + coords[2]; ) {
      const currentSettings = calculateCanvasSettings(
        pixelX,
        pixelY,
        imageWidth,
        imageHeight,
        coords,
        tileSize,
        shreadSize
      );

      const tileResult = await processSingleTile(
        bitmap,
        coords,
        pixelX,
        pixelY,
        currentSettings,
        allowedColorsSet
      );

      templateTiles[tileResult.tileName] = tileResult.bitmap;
      templateTilesBuffers[tileResult.tileName] = tileResult.buffer;
      tilePrefixes.add(tileResult.tileName.split(",").slice(0, 2).join(","));

      pixelX += currentSettings.drawSizeX;
    }

    pixelY += settings.drawSizeY;
  }

  // カラーパレット構築
  const colorPalette: Record<string, { count: number; enabled: boolean }> = {};
  for (const [key, count] of pixelAnalysis.paletteMap.entries()) {
    colorPalette[key] = { count, enabled: true };
  }

  return {
    templateTiles,
    templateTilesBuffers,
    colorPalette,
    tilePrefixes,
  };
};
