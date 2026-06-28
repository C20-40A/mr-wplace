import { latLngToTilePixelRound } from "@/utils/coordinate";
import { TILE_SIZE } from "@/utils/geo-converter";
import type { DrawPosition } from "@/states/galleryStorage";
import {
  type ColorMetric,
  quantizePixels,
  resizeImageDataNearest,
} from "@/utils/color-quantize";

interface WplaceFileImage {
  dataUrl: string;
  width: number;
  height: number;
}

interface WplaceFileBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

interface WplaceOverlayFile {
  id: string;
  schemaVersion: string;
  name?: string;
  opacity?: number;
  image: WplaceFileImage;
  bounds: WplaceFileBounds;
  colorMetric?: string;
  dithering?: boolean;
  order?: number;
  locked?: boolean;
  hasPlaced?: boolean;
  visible?: boolean;
}

interface WplaceOverlaySize {
  width: number;
  height: number;
}

interface BluemarbleJson {
  templates: Record<
    string,
    {
      coords: string;
      tiles: Record<string, string>;
    }
  >;
}

export interface ImportedEditorFile {
  dataUrl: string;
  drawPosition: DrawPosition | null;
  fileName?: string;
  colorMetric?: string;
  dithering?: boolean;
  /** `.wplace` overlay 由来なら true (bluemarble等と区別) */
  isWplaceOverlay?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isWplaceOverlayFile = (value: unknown): value is WplaceOverlayFile => {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== "string") return false;
  if (!isRecord(value.image) || typeof value.image.dataUrl !== "string")
    return false;
  if (!isRecord(value.bounds)) return false;

  return (
    typeof value.bounds.north === "number" &&
    typeof value.bounds.south === "number" &&
    typeof value.bounds.west === "number" &&
    typeof value.bounds.east === "number"
  );
};

const isBluemarbleJson = (value: unknown): value is BluemarbleJson =>
  isRecord(value) && isRecord(value.templates);

export const isImportableEditorFile = (file: File): boolean =>
  file.type.startsWith("image/") ||
  file.type === "application/json" ||
  file.name.toLowerCase().endsWith(".json") ||
  file.name.toLowerCase().endsWith(".wplace");

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsText(file);
  });
}

const normalizeColorMetric = (value: unknown): string | undefined => {
  if (value === "compuphase" || value === "ciede2000") return value;
  if (value === "lab" || value == null) return undefined;
  return undefined;
};

const getWorldPixel = (lat: number, lng: number) => {
  const pos = latLngToTilePixelRound(lat, lng);
  return {
    x: pos.TLX * TILE_SIZE + pos.PxX,
    y: pos.TLY * TILE_SIZE + pos.PxY,
  };
};

const getWplaceBoundsSize = (
  bounds: WplaceFileBounds
): WplaceOverlaySize | null => {
  const northWest = getWorldPixel(bounds.north, bounds.west);
  const southEast = getWorldPixel(bounds.south, bounds.east);
  const width = southEast.x - northWest.x;
  const height = southEast.y - northWest.y;

  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

const resizeDataUrl = async (
  dataUrl: string,
  target: WplaceOverlaySize
): Promise<string> => {
  const imageData = await loadDataUrlToImageData(dataUrl);
  if (imageData.width === target.width && imageData.height === target.height)
    return dataUrl;

  const resized = resizeImageDataNearest(
    imageData,
    target.width,
    target.height
  );
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  ctx.putImageData(resized, 0, 0);
  return canvas.toDataURL("image/png");
};

const parseWplaceJson = async (
  json: WplaceOverlayFile
): Promise<ImportedEditorFile> => {
  // bounds は wplace本体が整数pixelをroundして生成した lat/lng のため、
  // floorではなくround版で戻す (floorだと誤差で1pxずれる)
  const drawPosition: DrawPosition = latLngToTilePixelRound(
    json.bounds.north,
    json.bounds.west
  );
  const targetSize = getWplaceBoundsSize(json.bounds);
  const dataUrl = targetSize
    ? await resizeDataUrl(json.image.dataUrl, targetSize)
    : json.image.dataUrl;

  return {
    dataUrl,
    drawPosition,
    fileName: json.name,
    colorMetric: normalizeColorMetric(json.colorMetric),
    dithering: typeof json.dithering === "boolean" ? json.dithering : undefined,
    isWplaceOverlay: true,
  };
};

const parseBluemarbleJsonObject = async (
  json: BluemarbleJson
): Promise<ImportedEditorFile> => {
  const templateKeys = Object.keys(json.templates);
  if (templateKeys.length === 0) {
    throw new Error("No templates found in JSON");
  }

  const template = json.templates[templateKeys[0]];
  const coordsParts = template.coords
    .split(",")
    .map((s: string) => parseInt(s.trim()));

  if (coordsParts.length !== 4) {
    throw new Error("Invalid coords format");
  }

  const drawPosition: DrawPosition = {
    TLX: coordsParts[0],
    TLY: coordsParts[1],
    PxX: coordsParts[2],
    PxY: coordsParts[3],
  };

  const tiles = template.tiles;
  const tileEntries = Object.entries(tiles) as Array<[string, string]>;

  if (tileEntries.length === 0) {
    throw new Error("No tiles found in template");
  }

  interface TileInfo {
    tx: number;
    ty: number;
    offsetX: number;
    offsetY: number;
    base64: string;
    image?: HTMLImageElement;
    width?: number;
    height?: number;
  }

  const tileInfos: TileInfo[] = tileEntries.map(([key, base64]) => {
    const parts = key.split(",").map((s) => parseInt(s));
    return {
      tx: parts[0],
      ty: parts[1],
      offsetX: parts[2],
      offsetY: parts[3],
      base64,
    };
  });

  await Promise.all(
    tileInfos.map((info) => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const originalWidth = img.width;
          const originalHeight = img.height;
          const newWidth = Math.floor(originalWidth / 3);
          const newHeight = Math.floor(originalHeight / 3);

          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = originalWidth;
          tempCanvas.height = originalHeight;
          const tempCtx = tempCanvas.getContext("2d");
          if (!tempCtx) {
            reject(new Error("Failed to get temp canvas context"));
            return;
          }

          tempCtx.drawImage(img, 0, 0);
          const imageData = tempCtx.getImageData(
            0,
            0,
            originalWidth,
            originalHeight
          );

          const extractedCanvas = document.createElement("canvas");
          extractedCanvas.width = newWidth;
          extractedCanvas.height = newHeight;
          const extractedCtx = extractedCanvas.getContext("2d");
          if (!extractedCtx) {
            reject(new Error("Failed to get extracted canvas context"));
            return;
          }

          const extractedImageData = extractedCtx.createImageData(
            newWidth,
            newHeight
          );

          for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
              const srcX = x * 3 + 1;
              const srcY = y * 3 + 1;
              const srcIndex = (srcY * originalWidth + srcX) * 4;
              const dstIndex = (y * newWidth + x) * 4;

              extractedImageData.data[dstIndex] = imageData.data[srcIndex];
              extractedImageData.data[dstIndex + 1] =
                imageData.data[srcIndex + 1];
              extractedImageData.data[dstIndex + 2] =
                imageData.data[srcIndex + 2];
              extractedImageData.data[dstIndex + 3] =
                imageData.data[srcIndex + 3];
            }
          }

          extractedCtx.putImageData(extractedImageData, 0, 0);

          const extractedImg = new Image();
          extractedImg.onload = () => {
            info.image = extractedImg;
            info.width = newWidth;
            info.height = newHeight;
            resolve();
          };
          extractedImg.onerror = () =>
            reject(new Error("Failed to load extracted image"));
          extractedImg.src = extractedCanvas.toDataURL("image/png");
        };
        img.onerror = () =>
          reject(new Error(`Failed to load tile image: ${info.tx},${info.ty}`));

        const base64Data = info.base64.startsWith("data:")
          ? info.base64
          : `data:image/png;base64,${info.base64}`;
        img.src = base64Data;
      });
    })
  );

  const baseTX = drawPosition.TLX;
  const baseTY = drawPosition.TLY;
  const baseOffsetX = drawPosition.PxX;
  const baseOffsetY = drawPosition.PxY;

  let maxWidth = 0;
  let maxHeight = 0;

  for (const info of tileInfos) {
    const startX = (info.tx - baseTX) * 1000 + info.offsetX - baseOffsetX;
    const startY = (info.ty - baseTY) * 1000 + info.offsetY - baseOffsetY;
    maxWidth = Math.max(maxWidth, startX + (info.width || 0));
    maxHeight = Math.max(maxHeight, startY + (info.height || 0));
  }

  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  for (const info of tileInfos) {
    if (!info.image) continue;

    const startX = (info.tx - baseTX) * 1000 + info.offsetX - baseOffsetX;
    const startY = (info.ty - baseTY) * 1000 + info.offsetY - baseOffsetY;
    ctx.drawImage(info.image, startX, startY);
  }

  return {
    dataUrl: canvas.toDataURL("image/png"),
    drawPosition,
  };
};

const toColorMetric = (value: string | undefined): ColorMetric => {
  if (value === "compuphase" || value === "ciede2000") return value;
  return "lab";
};

const loadDataUrlToImageData = (dataUrl: string): Promise<ImageData> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });

/**
 * `.wplace` 由来のdataUrlを color-quantize.ts の正確な計算でパレットへ量子化し直す。
 * 編集画面を経由せずそのまま登録する用途。
 */
export const requantizeWplaceDataUrl = async (
  dataUrl: string,
  colorMetric: string | undefined,
  dithering: boolean | undefined
): Promise<string> => {
  const imageData = await loadDataUrlToImageData(dataUrl);
  await quantizePixels(
    imageData.data,
    imageData.width,
    imageData.height,
    toColorMetric(colorMetric),
    dithering ?? false,
    undefined
  );
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
};

export const parseImportedEditorFile = async (
  file: File
): Promise<ImportedEditorFile | null> => {
  if (!isImportableEditorFile(file) || file.type.startsWith("image/")) {
    return null;
  }

  const jsonText = await readFileAsText(file);
  const json = JSON.parse(jsonText) as unknown;

  if (isWplaceOverlayFile(json)) {
    return parseWplaceJson(json);
  }

  if (isBluemarbleJson(json)) {
    return parseBluemarbleJsonObject(json);
  }

  throw new Error("Unsupported import file format");
};
