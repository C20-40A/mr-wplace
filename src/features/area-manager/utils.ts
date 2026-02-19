import { t } from "@/i18n/manager";
import type { AreaRegion, AreaRegionVertex } from "@/types/area-region";
import { normalizeAreaColor } from "@/utils/area-region";
import { calculateGeodesicAreaSquareMeters } from "@/utils/coordinate";

const AUTO_AREA_COLOR_GOLDEN_ANGLE = 137.508;
const DEFAULT_AREA_FILL_OPACITY_PERCENT = 14;

export function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

export function getColorHue(color: string): number | null {
  const normalized = normalizeAreaColor(color, "");
  if (!normalized) return null;

  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) return 0;

  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;

  return (hue * 60 + 360) % 360;
}

export function hslToHex(
  hue: number,
  saturation: number,
  lightness: number,
): string {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) {
    rPrime = c;
    gPrime = x;
  } else if (h < 120) {
    rPrime = x;
    gPrime = c;
  } else if (h < 180) {
    gPrime = c;
    bPrime = x;
  } else if (h < 240) {
    gPrime = x;
    bPrime = c;
  } else if (h < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  const toHex = (value: number): string =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
}

export function createDistinctAreaColor(regions: AreaRegion[] = []): string {
  const usedHues = regions
    .map((region) => getColorHue(region.color))
    .filter((hue): hue is number => hue !== null);

  const seedHue = (regions.length * AUTO_AREA_COLOR_GOLDEN_ANGLE) % 360;
  const candidateCount = Math.max(18, usedHues.length * 3);
  let bestHue = seedHue;
  let bestDistance = -1;

  for (let i = 0; i < candidateCount; i++) {
    const hue = (seedHue + i * AUTO_AREA_COLOR_GOLDEN_ANGLE) % 360;
    const nearestDistance =
      usedHues.length === 0
        ? 180
        : Math.min(...usedHues.map((usedHue) => hueDistance(hue, usedHue)));

    if (nearestDistance > bestDistance) {
      bestDistance = nearestDistance;
      bestHue = hue;
    }
  }

  return hslToHex(bestHue, 72, 52);
}

export function formatAreaKm2(vertices: AreaRegionVertex[]): string {
  const km2 = calculateGeodesicAreaSquareMeters(vertices) / 1000000;
  if (km2 >= 100) return `${km2.toFixed(1)} km²`;
  if (km2 >= 10) return `${km2.toFixed(2)} km²`;
  return `${km2.toFixed(3)} km²`;
}

export function createAreaRegionId(): string {
  return `area_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createAreaRegionGroupId(): string {
  return `area_group_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultAreaName(index: number): string {
  return `${t`${"map_filter_area_default_name"}`} ${index}`;
}

export function createDefaultAreaGroupName(index: number): string {
  return `Area Group ${index}`;
}

export function normalizeTimestamp(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function normalizeAreaFillOpacityPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    return DEFAULT_AREA_FILL_OPACITY_PERCENT;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeAreaVertices(value: unknown): AreaRegionVertex[] {
  if (!Array.isArray(value)) return [];

  const vertices: AreaRegionVertex[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;
    const lng = candidate.lng;
    const lat = candidate.lat;
    if (
      typeof lng === "number" &&
      Number.isFinite(lng) &&
      typeof lat === "number" &&
      Number.isFinite(lat)
    ) {
      vertices.push({ lng, lat });
    }
  }

  return vertices;
}

export function parseGeoJsonVertices(geometry: unknown): AreaRegionVertex[] {
  if (!geometry || typeof geometry !== "object") return [];
  const candidate = geometry as Record<string, unknown>;
  const type = candidate.type;
  const coordinates = candidate.coordinates;

  let ring: unknown[] | null = null;
  if (
    type === "Polygon" &&
    Array.isArray(coordinates) &&
    Array.isArray(coordinates[0])
  ) {
    ring = coordinates[0] as unknown[];
  }

  if (
    type === "MultiPolygon" &&
    Array.isArray(coordinates) &&
    Array.isArray(coordinates[0]) &&
    Array.isArray((coordinates[0] as unknown[])[0])
  ) {
    ring = (coordinates[0] as unknown[])[0] as unknown[];
  }

  if (!ring) return [];

  const vertices: AreaRegionVertex[] = [];
  for (const pointRaw of ring) {
    if (!Array.isArray(pointRaw) || pointRaw.length < 2) continue;
    const [lng, lat] = pointRaw;
    if (
      typeof lng === "number" &&
      Number.isFinite(lng) &&
      typeof lat === "number" &&
      Number.isFinite(lat)
    ) {
      vertices.push({ lng, lat });
    }
  }

  if (vertices.length >= 4) {
    const first = vertices[0];
    const last = vertices[vertices.length - 1];
    if (first.lng === last.lng && first.lat === last.lat) {
      vertices.pop();
    }
  }

  return vertices;
}
