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

const normalizeLines = (text: string): string[] => text.replace(/\r\n?/g, "\n").split("\n");

export const textToBlob = async (text: string, font: string, colorId: number): Promise<Blob> => {
  const fontConfig = fonts[font];
  if (!fontConfig) throw new Error(`Font not found: ${font}`);

  const colorHex = getColorHex(colorId);
  const lines = normalizeLines(text);

  if (fontConfig.type === "bitmap") {
    return bitmapToBlob(lines, fontConfig.data, colorHex);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not found");

  const fontSize = fontConfig.size;
  const lineHeight = fontSize;
  ctx.font = `${fontSize}px ${font}`;

  const maxWidth = Math.max(
    ...lines.map((line) => Math.ceil(ctx.measureText(line).width)),
    1,
  );
  canvas.width = maxWidth;
  canvas.height = Math.max(lines.length * lineHeight, 1);

  ctx.font = `${fontSize}px ${font}`;
  ctx.fillStyle = colorHex;
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, 0, index * lineHeight);
  });

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
  lines: string[],
  bitmapData: BitmapChar[],
  colorHex: string
): Promise<Blob> => {
  const charSpacing = 1;
  const charMap = new Map(bitmapData.map((c) => [c.char, c]));
  const lineInfos = lines.map((line) => {
    let totalWidth = 0;
    let maxHeight = 0;
    const charInfos: BitmapChar[] = [];

    for (const char of line) {
      const info = charMap.get(char);
      if (!info) {
        console.log("🧑‍🎨 : Character not found in bitmap data:", char);
        continue;
      }
      charInfos.push(info);
      totalWidth += info.width + charSpacing;
      maxHeight = Math.max(maxHeight, info.height);
    }

    if (charInfos.length > 0) totalWidth -= charSpacing;

    return { charInfos, totalWidth, maxHeight };
  });

  const maxWidth = Math.max(...lineInfos.map((line) => line.totalWidth), 1);
  const defaultHeight = bitmapData.reduce((height, char) => Math.max(height, char.height), 1);
  const lineHeight = Math.max(...lineInfos.map((line) => line.maxHeight), defaultHeight);

  if (!lineInfos.some((line) => line.charInfos.length > 0)) {
    throw new Error("No valid characters found");
  }

  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = Math.max(lineInfos.length * lineHeight, 1);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not found");

  ctx.fillStyle = colorHex;

  lineInfos.forEach(({ charInfos, maxHeight }, lineIndex) => {
    let x = 0;
    const lineBaseY = lineIndex * lineHeight;

    for (const charInfo of charInfos) {
      const yOffset = lineBaseY + (maxHeight - charInfo.height);
      for (let row = 0; row < charInfo.height; row++) {
        for (let col = 0; col < charInfo.width; col++) {
          if (charInfo.data[row][col] === 1) {
            ctx.fillRect(x + col, yOffset + row, 1, 1);
          }
        }
      }
      x += charInfo.width + charSpacing;
    }
  });

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Blob conversion failed");
      resolve(blob);
    }, "image/png");
  });
};
