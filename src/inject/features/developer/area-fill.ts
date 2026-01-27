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

let isRunning = false;
let stopRequested = false;
let currentCorners: AreaFillCorners = { topLeft: null, bottomRight: null };

const BASE_INTERVAL_MS = 10;
const JITTER_MS = 5;

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
 * Get random interval with jitter
 */
const getRandomInterval = (): number => {
  const jitter = Math.random() * JITTER_MS * 2 - JITTER_MS;
  return BASE_INTERVAL_MS + jitter;
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

/**
 * Generate pixel grid positions within the area
 * Returns array of positions with tile info for filtering
 */
const generatePixelPositions = (
  topLeft: { lat: number; lng: number },
  bottomRight: { lat: number; lng: number }
): PixelPosition[] => {
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
        pxY + 0.5
      );
      positions.push({ lat, lng, tileKey: `${tileX},${tileY}`, pxX, pxY });
    }
  }

  return positions;
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
  positions: PixelPosition[]
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
  options: AreaFillOptions = DEFAULT_OPTIONS
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

  let positions = generatePixelPositions(corners.topLeft, corners.bottomRight);
  console.log(`🧑‍🎨 : Area fill - ${positions.length} pixels in area`);

  if (options.skipExistingPixels) {
    const before = positions.length;
    positions = await filterExistingPixels(positions);
    console.log(
      `🧑‍🎨 : Area fill - Filtered to ${positions.length} empty pixels (skipped ${
        before - positions.length
      } existing)`
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
      `🧑‍🎨 : Area fill - Limited to ${limitedPositions.length} clicks (charge limit)`
    );
  }

  // Send initial progress
  window.postMessage(
    {
      source: "mr-wplace-area-fill-progress",
      current: 0,
      total: limitedPositions.length,
    },
    "*"
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
          "*"
        );
      }

      if (clickCount % 100 === 0) {
        console.log(
          `🧑‍🎨 : Area fill progress: ${clickCount}/${limitedPositions.length}`
        );
      }
    }

    await sleep(getRandomInterval());
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
