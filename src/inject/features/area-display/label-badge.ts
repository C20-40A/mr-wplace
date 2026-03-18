import { normalizeAreaColor } from "@/utils/area-region";
import type { AreaMap } from "./types";
import { AREA_LABEL_BADGE_IMAGE_ID_PREFIX } from "./types";
import { areaRegions } from "./state";

export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const matched = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!matched) return null;
  const value = matched[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
};

const toHex = (value: number): string =>
  Math.min(255, Math.max(0, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

export const getNeutralLabelHaloColor = (hexColor: string): string => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return "#2b2b2b";
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  const tone = Math.round(28 + Math.min(0.35, luminance) * 64);
  return `#${toHex(tone)}${toHex(tone)}${toHex(tone)}`;
};

export const getContrastTextColor = (hexColor: string): string => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return "#ffffff";
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.56 ? "#141414" : "#ffffff";
};

export const getLabelBadgeImageId = (hexColor: string): string =>
  `${AREA_LABEL_BADGE_IMAGE_ID_PREFIX}${hexColor.slice(1).toLowerCase()}`;

const createRoundRectImageData = (hexColor: string): ImageData | null => {
  const canvas = document.createElement("canvas");
  canvas.width = 52;
  canvas.height = 28;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const radius = Math.floor(canvas.height / 2) - 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.moveTo(radius, 1);
  ctx.lineTo(canvas.width - radius - 1, 1);
  ctx.arcTo(canvas.width - 1, 1, canvas.width - 1, radius + 1, radius);
  ctx.lineTo(canvas.width - 1, canvas.height - radius - 1);
  ctx.arcTo(
    canvas.width - 1,
    canvas.height - 1,
    canvas.width - radius - 1,
    canvas.height - 1,
    radius,
  );
  ctx.lineTo(radius, canvas.height - 1);
  ctx.arcTo(1, canvas.height - 1, 1, canvas.height - radius - 1, radius);
  ctx.lineTo(1, radius + 1);
  ctx.arcTo(1, 1, radius + 1, 1, radius);
  ctx.closePath();

  ctx.fillStyle = hexColor;
  ctx.fill();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

export const ensureAreaLabelBadgeImages = (map: AreaMap): void => {
  if (!map.addImage || !map.hasImage) return;

  const colors = new Set(
    areaRegions.map((region) => normalizeAreaColor(region.color)).filter(Boolean),
  );

  for (const color of colors) {
    const imageId = getLabelBadgeImageId(color);
    if (map.hasImage(imageId)) continue;
    const imageData = createRoundRectImageData(color);
    if (!imageData) continue;
    map.addImage(imageId, imageData, {
      pixelRatio: 1,
      stretchX: [[13, 39]],
      stretchY: [[8, 20]],
      content: [11, 5, 41, 23],
    });
  }
};
