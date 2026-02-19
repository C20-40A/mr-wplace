import type {
  AreaNameDisplayMode,
  AreaNameStyleMode,
  AreaRegionBounds,
  AreaRegionVertex,
} from "@/types/area-region";

export const DEFAULT_AREA_COLOR = "#0f766e";
export const DEFAULT_AREA_NAME_DISPLAY_MODE: AreaNameDisplayMode = "always";
export const DEFAULT_AREA_NAME_STYLE_MODE: AreaNameStyleMode = "halo";
export const DEFAULT_AREA_NAME_FONT_SIZE_PX = 14;
export const MIN_AREA_NAME_FONT_SIZE_PX = 8;
export const MAX_AREA_NAME_FONT_SIZE_PX = 32;

export const normalizeAreaColor = (
  value: unknown,
  fallback = DEFAULT_AREA_COLOR,
): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(normalized)) return fallback;
  return normalized.toLowerCase();
};

export const normalizeAreaNameDisplayMode = (
  value: unknown,
): AreaNameDisplayMode => {
  if (value === "always" || value === "off") return value;
  return DEFAULT_AREA_NAME_DISPLAY_MODE;
};

export const normalizeAreaNameStyleMode = (
  value: unknown,
): AreaNameStyleMode => {
  if (value === "halo" || value === "color-badge") return value;
  return DEFAULT_AREA_NAME_STYLE_MODE;
};

export const normalizeAreaNameFontSizePx = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value))
    return DEFAULT_AREA_NAME_FONT_SIZE_PX;
  return Math.min(
    MAX_AREA_NAME_FONT_SIZE_PX,
    Math.max(MIN_AREA_NAME_FONT_SIZE_PX, Math.round(value)),
  );
};

export const getAreaBounds = (
  vertices: AreaRegionVertex[],
): AreaRegionBounds | null => {
  if (vertices.length === 0) return null;

  let west = vertices[0].lng;
  let east = vertices[0].lng;
  let south = vertices[0].lat;
  let north = vertices[0].lat;

  for (const vertex of vertices) {
    if (!Number.isFinite(vertex.lng) || !Number.isFinite(vertex.lat)) continue;
    if (vertex.lng < west) west = vertex.lng;
    if (vertex.lng > east) east = vertex.lng;
    if (vertex.lat < south) south = vertex.lat;
    if (vertex.lat > north) north = vertex.lat;
  }

  return { west, south, east, north };
};

export const formatPixelArea = (pixelArea: number): string => {
  const rounded = Math.round(pixelArea);
  return `${rounded.toLocaleString()} px²`;
};
