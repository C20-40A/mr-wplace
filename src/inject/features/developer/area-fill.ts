/**
 * Area Fill
 * Automatically clicks pixels within a defined rectangular area
 * Developer mode only
 */

import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import { latLngToTilePixelFloat } from "@/utils/coordinate";

interface AreaFillCorners {
  topLeft: { lat: number; lng: number } | null;
  bottomRight: { lat: number; lng: number } | null;
}

let isRunning = false;
let stopRequested = false;
let currentCorners: AreaFillCorners = { topLeft: null, bottomRight: null };

// Base interval ~500ms with ±100ms jitter
const BASE_INTERVAL_MS = 500;
const JITTER_MS = 100;

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

/**
 * Generate pixel grid positions within the area
 * Returns array of {lat, lng} for each pixel center
 */
const generatePixelPositions = (
  topLeft: { lat: number; lng: number },
  bottomRight: { lat: number; lng: number }
): { lat: number; lng: number }[] => {
  const positions: { lat: number; lng: number }[] = [];

  // At zoom level 11 (wplace default), 1 tile = 1000x1000 pixels
  // Each tile spans a certain lat/lng range depending on location
  // For simplicity, we'll use a small step that approximates 1 pixel

  // Approximate pixel size at equator for zoom 11
  // 360 degrees / (2^11 * 1000 pixels) ≈ 0.000176 degrees per pixel
  const PIXEL_SIZE_LNG = 0.000176;
  // Latitude needs to be adjusted for mercator projection
  // For simplicity, use similar value (works well near equator)
  const PIXEL_SIZE_LAT = 0.000176;

  // Ensure correct ordering (topLeft should have higher lat, lower lng)
  const minLat = Math.min(topLeft.lat, bottomRight.lat);
  const maxLat = Math.max(topLeft.lat, bottomRight.lat);
  const minLng = Math.min(topLeft.lng, bottomRight.lng);
  const maxLng = Math.max(topLeft.lng, bottomRight.lng);

  // Generate grid (row by row, left to right)
  for (let lat = maxLat; lat >= minLat; lat -= PIXEL_SIZE_LAT) {
    for (let lng = minLng; lng <= maxLng; lng += PIXEL_SIZE_LNG) {
      positions.push({ lat, lng });
    }
  }

  return positions;
};

/**
 * Start area fill process
 */
export const startAreaFill = async (corners: AreaFillCorners): Promise<void> => {
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

  const positions = generatePixelPositions(corners.topLeft, corners.bottomRight);
  console.log(`🧑‍🎨 : Area fill - ${positions.length} pixels to fill`);

  let clickCount = 0;
  for (const pos of positions) {
    if (stopRequested) {
      console.log("🧑‍🎨 : Area fill stopped by user");
      break;
    }

    const success = fireMapClick(pos.lat, pos.lng);
    if (success) {
      clickCount++;
      if (clickCount % 100 === 0) {
        console.log(`🧑‍🎨 : Area fill progress: ${clickCount}/${positions.length}`);
      }
    }

    await sleep(getRandomInterval());
  }

  isRunning = false;
  console.log(`🧑‍🎨 : Area fill completed. Clicked ${clickCount} pixels`);
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
