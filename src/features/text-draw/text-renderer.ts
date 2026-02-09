import { fonts } from "./font-loader";
import type { BitmapChar } from "../../assets/kyokugen-font";
import { colorpalette } from "@/constants/colors";

// ========================================
// Text to Blob conversion
// ========================================

const getColorHex = (colorId: number): string => {
  const color = colorpalette.find((c) => c.id === colorId);
  if (!color) return "#000000";
  const [r, g, b] = color.rgb;
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
};

export const textToBlob = async (text: string, font: string, colorId: number): Promise<Blob> => {
  const fontConfig = fonts[font];
  if (!fontConfig) throw new Error(`Font not found: ${font}`);

  const colorHex = getColorHex(colorId);

  if (fontConfig.type === "bitmap") {
    return bitmapToBlob(text, fontConfig.data, colorHex);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not found");

  const fontSize = fontConfig.size;
  ctx.font = `${fontSize}px ${font}`;

  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width);
  canvas.height = fontSize;

  ctx.font = `${fontSize}px ${font}`;
  ctx.fillStyle = colorHex;
  ctx.textBaseline = "top";
  ctx.fillText(text, 0, 0);

  // Pre-render to bitmap: 閾値処理でアンチエイリアス排除
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const color = colorpalette.find((c) => c.id === colorId);
  const [targetR, targetG, targetB] = color?.rgb ?? [0, 0, 0];

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha >= 128) {
      data[i] = targetR;
      data[i + 1] = targetG;
      data[i + 2] = targetB;
      data[i + 3] = 255;
    } else {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Blob conversion failed");
      resolve(blob);
    }, "image/png");
  });
};

const bitmapToBlob = async (
  text: string,
  bitmapData: BitmapChar[],
  colorHex: string
): Promise<Blob> => {
  const charSpacing = 1;
  const chars = text.split("");

  // 文字マップ構築
  const charMap = new Map(bitmapData.map((c) => [c.char, c]));

  // Canvas サイズ計算
  let totalWidth = 0;
  let maxHeight = 0;
  const charInfos: BitmapChar[] = [];

  for (const char of chars) {
    const info = charMap.get(char);
    if (!info) {
      console.log("🧑‍🎨 : Character not found in bitmap data:", char);
      continue;
    }
    charInfos.push(info);
    totalWidth += info.width + charSpacing;
    maxHeight = Math.max(maxHeight, info.height);
  }

  if (charInfos.length === 0) throw new Error("No valid characters found");

  totalWidth -= charSpacing; // 最後の文字間スペース削除

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not found");

  // 描画（下詰め）
  let x = 0;
  for (const charInfo of charInfos) {
    const yOffset = maxHeight - charInfo.height; // 下詰めのためのオフセット
    for (let row = 0; row < charInfo.height; row++) {
      for (let col = 0; col < charInfo.width; col++) {
        if (charInfo.data[row][col] === 1) {
          ctx.fillStyle = colorHex;
          ctx.fillRect(x + col, yOffset + row, 1, 1);
        }
      }
    }
    x += charInfo.width + charSpacing;
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Blob conversion failed");
      resolve(blob);
    }, "image/png");
  });
};
