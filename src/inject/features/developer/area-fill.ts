/**
 * Area Fill
 * Automatically clicks pixels within a defined rectangular area
 * Developer mode only
 */

import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import { latLngToTilePixelFloat, tilePixelToLatLng } from "@/utils/coordinate";
import { TILE_SIZE } from "@/utils/geo-converter";
import { getOriginalBlob } from "../tile-draw";
import { statusManagerSingleton } from "../user-status/status-manager";

interface AreaFillCorners {
  topLeft: { lat: number; lng: number } | null;
  bottomRight: { lat: number; lng: number } | null;
}

interface AreaFillOptions {
  skipExistingPixels: boolean;
}

const DEFAULT_OPTIONS: AreaFillOptions = {
  skipExistingPixels: true,
};

// ============================================
// Human-like behavior settings
// ============================================

type FillPattern = "linear" | "spiralPingPong";

interface HumanLikeBehaviorSettings {
  enabled: boolean;
  fillPattern: FillPattern;
}

const humanLikeBehaviorSettings: HumanLikeBehaviorSettings = {
  enabled: true,
  fillPattern: "spiralPingPong",
};

/**
 * Apply spiral ping-pong pattern (outside → inside, alternating directions per layer)
 * Each spiral layer alternates: clockwise → counter-clockwise → clockwise...
 */
const applySpiralPingPongPattern = (
  positions: PixelPosition[],
  width: number,
  height: number,
): PixelPosition[] => {
  if (width <= 0 || height <= 0) return positions;

  // Build 2D grid
  const grid: (PixelPosition | null)[][] = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      grid[y][x] = idx < positions.length ? positions[idx] : null;
    }
  }

  const result: PixelPosition[] = [];
  let top = 0,
    bottom = height - 1,
    left = 0,
    right = width - 1;
  let layerIndex = 0;

  while (top <= bottom && left <= right) {
    const clockwise = layerIndex % 2 === 0;

    if (clockwise) {
      // Clockwise: → ↓ ← ↑
      for (let x = left; x <= right; x++) {
        if (grid[top][x]) result.push(grid[top][x]!);
      }
      top++;

      for (let y = top; y <= bottom; y++) {
        if (grid[y][right]) result.push(grid[y][right]!);
      }
      right--;

      if (top <= bottom) {
        for (let x = right; x >= left; x--) {
          if (grid[bottom][x]) result.push(grid[bottom][x]!);
        }
        bottom--;
      }

      if (left <= right) {
        for (let y = bottom; y >= top; y--) {
          if (grid[y][left]) result.push(grid[y][left]!);
        }
        left++;
      }
    } else {
      // Counter-clockwise: ↓ → ↑ ←
      for (let y = top; y <= bottom; y++) {
        if (grid[y][left]) result.push(grid[y][left]!);
      }
      left++;

      if (left <= right) {
        for (let x = left; x <= right; x++) {
          if (grid[bottom][x]) result.push(grid[bottom][x]!);
        }
        bottom--;
      }

      if (top <= bottom) {
        for (let y = bottom; y >= top; y--) {
          if (grid[y][right]) result.push(grid[y][right]!);
        }
        right--;
      }

      if (left <= right) {
        for (let x = right; x >= left; x--) {
          if (grid[top][x]) result.push(grid[top][x]!);
        }
        top++;
      }
    }

    layerIndex++;
  }

  return result;
};

/**
 * Apply fill pattern based on settings
 */
const applyFillPattern = (
  positions: PixelPosition[],
  width: number,
  height: number,
): PixelPosition[] => {
  if (
    !humanLikeBehaviorSettings.enabled ||
    humanLikeBehaviorSettings.fillPattern === "linear"
  ) {
    return positions;
  }
  return applySpiralPingPongPattern(positions, width, height);
};

// ============================================
// Core state
// ============================================

let isRunning = false;
let stopRequested = false;
let currentCorners: AreaFillCorners = { topLeft: null, bottomRight: null };

const BASE_INTERVAL_MS = 10;
const MIN_JITTER_MS = 2;
const MAX_JITTER_MS = 15;
const JITTER_CYCLE_CLICKS = 100; // jitter が一周するクリック数

/**
 * Check if developer mode is enabled
 */
const isDevModeEnabled = (): boolean => {
  const dataElement = document.getElementById("__mr_wplace_data__");
  if (!dataElement) return false;
  const devMode = dataElement.getAttribute("data-auto-spoit-dev-mode");
  return devMode === "true";
};

/**
 * Get interval with gradual jitter (spring-like acceleration/deceleration)
 * jitter が sin 波で変化し、クリック速度が徐々に上下する
 */
const getGradualInterval = (clickIndex: number): number => {
  const phase = (clickIndex % JITTER_CYCLE_CLICKS) / JITTER_CYCLE_CLICKS;
  const sinValue = Math.sin(phase * Math.PI * 2);
  const jitterRange = MAX_JITTER_MS - MIN_JITTER_MS;
  const jitter = MIN_JITTER_MS + (jitterRange * (sinValue + 1)) / 2;
  const randomOffset = (Math.random() - 0.5) * 2;
  return BASE_INTERVAL_MS + jitter + randomOffset;
};

/**
 * Sleep for given ms
 */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fire fake click event on map
 */
const fireMapClick = (lat: number, lng: number): boolean => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) {
    console.error("🧑‍🎨 : Area fill - Map instance not found");
    return false;
  }

  // Convert lat/lng to tile pixel coordinates
  const { PxX, PxY } = latLngToTilePixelFloat(lat, lng);

  map.fire("click", {
    type: "click",
    target: map,
    lngLat: { lng, lat },
    point: { x: PxX, y: PxY },
    originalEvent: {
      target: document.body,
    },
  });

  return true;
};

interface PixelPosition {
  lat: number;
  lng: number;
  tileKey: string;
  pxX: number;
  pxY: number;
}

interface GenerateResult {
  positions: PixelPosition[];
  width: number;
  height: number;
}

/**
 * Generate pixel grid positions within the area
 * Returns array of positions with tile info for filtering, and row width
 */
const generatePixelPositions = (
  topLeft: { lat: number; lng: number },
  bottomRight: { lat: number; lng: number },
): GenerateResult => {
  const tl = latLngToTilePixelFloat(topLeft.lat, topLeft.lng);
  const br = latLngToTilePixelFloat(bottomRight.lat, bottomRight.lng);

  const tlWorldX = tl.TLX * TILE_SIZE + tl.PxX;
  const tlWorldY = tl.TLY * TILE_SIZE + tl.PxY;
  const brWorldX = br.TLX * TILE_SIZE + br.PxX;
  const brWorldY = br.TLY * TILE_SIZE + br.PxY;

  const minX = Math.min(tlWorldX, brWorldX);
  const maxX = Math.max(tlWorldX, brWorldX);
  const minY = Math.min(tlWorldY, brWorldY);
  const maxY = Math.max(tlWorldY, brWorldY);

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const positions: PixelPosition[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const centerX = x + 0.5;
      const centerY = y + 0.5;
      const tileX = Math.floor(centerX / TILE_SIZE);
      const tileY = Math.floor(centerY / TILE_SIZE);
      const pxX = Math.floor(centerX - tileX * TILE_SIZE);
      const pxY = Math.floor(centerY - tileY * TILE_SIZE);
      const { lat, lng } = tilePixelToLatLng(
        tileX,
        tileY,
        pxX + 0.5,
        pxY + 0.5,
      );
      positions.push({ lat, lng, tileKey: `${tileX},${tileY}`, pxX, pxY });
    }
  }

  return { positions, width, height };
};

/**
 * Load tile ImageData from cached blob
 */
const loadTileImageData = async (blob: Blob): Promise<ImageData> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
};

/**
 * Filter positions to exclude pixels that already exist in background
 */
const filterExistingPixels = async (
  positions: PixelPosition[],
): Promise<PixelPosition[]> => {
  // Group by tile
  const byTile = new Map<string, PixelPosition[]>();
  for (const pos of positions) {
    const arr = byTile.get(pos.tileKey) ?? [];
    arr.push(pos);
    byTile.set(pos.tileKey, arr);
  }

  const result: PixelPosition[] = [];
  const tileImageDataCache = new Map<string, ImageData | null>();

  for (const [tileKey, tilePositions] of byTile) {
    // Get cached original tile
    let imageData = tileImageDataCache.get(tileKey);
    if (imageData === undefined) {
      const blob = getOriginalBlob(tileKey);
      imageData = blob ? await loadTileImageData(blob) : null;
      tileImageDataCache.set(tileKey, imageData);
    }

    // If no cache, include all positions (can't check)
    if (!imageData) {
      result.push(...tilePositions);
      continue;
    }

    // Check each pixel
    for (const pos of tilePositions) {
      const idx = (pos.pxY * TILE_SIZE + pos.pxX) * 4;
      const alpha = imageData.data[idx + 3];
      // Empty pixel = transparent (alpha === 0)
      if (alpha === 0) result.push(pos);
    }
  }

  return result;
};

/**
 * Start area fill process
 */
export const startAreaFill = async (
  corners: AreaFillCorners,
  options: AreaFillOptions = DEFAULT_OPTIONS,
): Promise<void> => {
  if (!isDevModeEnabled()) {
    console.warn("🧑‍🎨 : Area fill requires developer mode");
    return;
  }

  if (isRunning) {
    console.warn("🧑‍🎨 : Area fill already running");
    return;
  }

  if (!corners.topLeft || !corners.bottomRight) {
    console.error("🧑‍🎨 : Area fill - Both corners must be set");
    return;
  }

  currentCorners = corners;
  isRunning = true;
  stopRequested = false;

  console.log("🧑‍🎨 : Area fill started", corners);

  const generated = generatePixelPositions(
    corners.topLeft,
    corners.bottomRight,
  );
  let positions = generated.positions;
  const { width, height } = generated;
  console.log(
    `🧑‍🎨 : Area fill - ${positions.length} pixels in area (${width}x${height})`,
  );

  if (options.skipExistingPixels) {
    const before = positions.length;
    positions = await filterExistingPixels(positions);
    console.log(
      `🧑‍🎨 : Area fill - Filtered to ${positions.length} empty pixels (skipped ${
        before - positions.length
      } existing)`,
    );
  }

  // Apply fill pattern (human-like behavior)
  positions = applyFillPattern(positions, width, height);
  if (
    humanLikeBehaviorSettings.enabled &&
    humanLikeBehaviorSettings.fillPattern !== "linear"
  ) {
    console.log(
      `🧑‍🎨 : Area fill - Pattern applied: ${humanLikeBehaviorSettings.fillPattern}`,
    );
  }

  // Get available charge count
  const availableCharges = statusManagerSingleton.getCurrentChargeCount();
  console.log(`🧑‍🎨 : Area fill - Available charges: ${availableCharges}`);

  // Limit positions by available charges
  const maxClicks = Math.min(positions.length, availableCharges);
  const limitedPositions = positions.slice(0, maxClicks);

  if (limitedPositions.length < positions.length) {
    console.log(
      `🧑‍🎨 : Area fill - Limited to ${limitedPositions.length} clicks (charge limit)`,
    );
  }

  // Send initial progress
  window.postMessage(
    {
      source: "mr-wplace-area-fill-progress",
      current: 0,
      total: limitedPositions.length,
    },
    "*",
  );

  let clickCount = 0;
  for (const pos of limitedPositions) {
    if (stopRequested) {
      console.log("🧑‍🎨 : Area fill stopped by user");
      break;
    }

    const success = fireMapClick(pos.lat, pos.lng);
    if (success) {
      clickCount++;

      // Send progress update every 10 clicks or on milestones
      if (clickCount % 10 === 0 || clickCount === limitedPositions.length) {
        window.postMessage(
          {
            source: "mr-wplace-area-fill-progress",
            current: clickCount,
            total: limitedPositions.length,
          },
          "*",
        );
      }

      if (clickCount % 100 === 0) {
        console.log(
          `🧑‍🎨 : Area fill progress: ${clickCount}/${limitedPositions.length}`,
        );
      }
    }

    await sleep(getGradualInterval(clickCount));
  }

  isRunning = false;
  console.log(`🧑‍🎨 : Area fill completed. Clicked ${clickCount} pixels`);

  // Notify content script that area fill has finished
  window.postMessage({ source: "mr-wplace-area-fill-finished" }, "*");
};

/**
 * Stop area fill process
 */
export const stopAreaFill = (): void => {
  if (!isRunning) return;
  stopRequested = true;
  console.log("🧑‍🎨 : Area fill stop requested");
};

/**
 * Check if area fill is running
 */
export const isAreaFillRunning = (): boolean => isRunning;

/**
 * Update corners (called from message handler)
 */
export const setAreaFillCorners = (corners: AreaFillCorners): void => {
  currentCorners = corners;
};

/**
 * Get current corners
 */
export const getAreaFillCorners = (): AreaFillCorners => currentCorners;
