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

export type TextDirection = "horizontal" | "vertical";

const getVerticalColumns = (lines: string[]): string[][] =>
  lines.map((line) => [...line]);

export const textToBlob = async (
  text: string,
  font: string,
  colorId: number,
  lineSpacing = 0,
  direction: TextDirection = "horizontal",
): Promise<Blob> => {
  const fontConfig = fonts[font];
  if (!fontConfig) throw new Error(`Font not found: ${font}`);

  const colorHex = getColorHex(colorId);
  const lines = normalizeLines(text);

  if (fontConfig.type === "bitmap") {
    return bitmapToBlob(lines, fontConfig.data, colorHex, lineSpacing, direction);
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not found");

  const fontSize = fontConfig.size;
  const lineHeight = Math.max(fontSize + lineSpacing, 1);
  ctx.font = `${fontSize}px ${font}`;

  if (direction === "vertical") {
    const columns = getVerticalColumns(lines);
    const columnWidths = columns.map((column) =>
      Math.max(...column.map((char) => Math.ceil(ctx.measureText(char).width)), 1),
    );
    const columnHeight = Math.max(...columns.map((column) => column.length), 1) * lineHeight;
    canvas.width = Math.max(
      columnWidths.reduce((sum, width) => sum + width, 0) +
        Math.max(columnWidths.length - 1, 0) * lineSpacing,
      1,
    );
    canvas.height = Math.max(columnHeight, 1);
  } else {
    const maxWidth = Math.max(
      ...lines.map((line) => Math.ceil(ctx.measureText(line).width)),
      1,
    );
    canvas.width = maxWidth;
    canvas.height = Math.max(lines.length * lineHeight, 1);
  }

  ctx.font = `${fontSize}px ${font}`;
  ctx.fillStyle = colorHex;
  ctx.textBaseline = "top";
  if (direction === "vertical") {
    let x = 0;
    for (const column of getVerticalColumns(lines)) {
      const columnWidth = Math.max(
        ...column.map((char) => Math.ceil(ctx.measureText(char).width)),
        1,
      );
      column.forEach((char, rowIndex) => {
        ctx.fillText(char, x, rowIndex * lineHeight);
      });
      x += columnWidth + lineSpacing;
    }
  } else {
    lines.forEach((line, index) => {
      ctx.fillText(line, 0, index * lineHeight);
    });
  }

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
  colorHex: string,
  lineSpacing = 0,
  direction: TextDirection = "horizontal",
): Promise<Blob> => {
  const charSpacing = 1;
  const charMap = new Map(bitmapData.map((c) => [c.char, c]));
  const sourceLines =
    direction === "vertical"
      ? getVerticalColumns(lines)
      : lines.map((line) => [...line]);
  const lineInfos = sourceLines.map((chars) => {
    let totalWidth = 0;
    let totalHeight = 0;
    let maxWidth = 0;
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
      totalHeight += info.height + charSpacing;
      maxWidth = Math.max(maxWidth, info.width);
      maxHeight = Math.max(maxHeight, info.height);
    }

    if (charInfos.length > 0) totalWidth -= charSpacing;
    if (charInfos.length > 0) totalHeight -= charSpacing;

    return { charInfos, totalWidth, totalHeight, maxWidth, maxHeight };
  });

  const defaultHeight = bitmapData.reduce((height, char) => Math.max(height, char.height), 1);
  const lineHeight = Math.max(
    Math.max(...lineInfos.map((line) => line.maxHeight), defaultHeight) + lineSpacing,
    1,
  );
  const maxWidth = Math.max(...lineInfos.map((line) => line.totalWidth), 1);
  const canvasWidth =
    direction === "vertical"
      ? lineInfos.reduce((sum, line) => sum + Math.max(line.maxWidth, 1), 0) +
        Math.max(lineInfos.length - 1, 0) * lineSpacing
      : maxWidth;
  const canvasHeight =
    direction === "vertical"
      ? Math.max(...lineInfos.map((line) => line.totalHeight), 1)
      : Math.max(lineInfos.length * lineHeight, 1);

  if (!lineInfos.some((line) => line.charInfos.length > 0)) {
    throw new Error("No valid characters found");
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(canvasWidth, 1);
  canvas.height = Math.max(canvasHeight, 1);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not found");

  ctx.fillStyle = colorHex;

  if (direction === "vertical") {
    let x = 0;
    for (const { charInfos, maxWidth } of lineInfos) {
      let y = 0;
      for (const charInfo of charInfos) {
        const xOffset = x + (maxWidth - charInfo.width);
        for (let row = 0; row < charInfo.height; row++) {
          for (let col = 0; col < charInfo.width; col++) {
            if (charInfo.data[row][col] === 1) {
              ctx.fillRect(xOffset + col, y + row, 1, 1);
            }
          }
        }
        y += charInfo.height + charSpacing;
      }
      x += Math.max(maxWidth, 1) + lineSpacing;
    }
  } else {
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
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error("Blob conversion failed");
      resolve(blob);
    }, "image/png");
  });
};
