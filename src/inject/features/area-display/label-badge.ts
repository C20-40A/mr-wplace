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
