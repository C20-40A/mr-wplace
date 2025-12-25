/**
 * Auto Color Spoit
 * Automatically picks color from template image under cursor
 * Developer mode only
 */

import { colorpalette } from "@/constants/colors";
import { latLngToTilePixel } from "@/utils/coordinate";
import { getGalleryRepository } from "../../db/gallery-repository";

let isEnabled = false;
let mapInstance: any = null;
let mouseMoveHandler: ((e: any) => void) | null = null;

// Throttle to avoid excessive processing
let lastSpoitTime = 0;
const SPOIT_THROTTLE_MS = 100;

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
 * Find closest color ID from RGB
 */
const findClosestColorId = (r: number, g: number, b: number): number => {
  let minDistance = Infinity;
  let closestId = 1;

  for (const color of colorpalette) {
    const [cr, cg, cb] = color.rgb;
    const distance =
      Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2);

    if (distance < minDistance) {
      minDistance = distance;
      closestId = color.id;
    }
  }

  return closestId;
};

/**
 * Select color by ID (click color palette button)
 */
const selectColor = (id: number): boolean => {
  const el = document.getElementById(`color-${id}`);
  if (el) {
    el.click();
    return true;
  }
  return false;
};

/**
 * Get pixel color from gallery splitTile at given tile pixel position
 */
const getPixelColorFromGallery = async (
  TLX: number,
  TLY: number,
  PxX: number,
  PxY: number
): Promise<[number, number, number] | null> => {
  const repo = getGalleryRepository();
  const tileKey = `${TLX},${TLY}`;

  // Get layers that affect this tile, sorted by zIndex
  const layers = await repo.getLayersForTile(tileKey);
  if (layers.length === 0) return null;

  // Iterate from highest zIndex (last) to lowest (first)
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible) continue;

    // Get split tile for this layer
    const tileBlob = await repo.getTile(layer.id, tileKey);
    if (!tileBlob) continue;

    // Load tile and get pixel color at (PxX, PxY)
    const bitmap = await createImageBitmap(tileBlob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      continue;
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    // Get pixel color at (PxX, PxY)
    const imageData = ctx.getImageData(PxX, PxY, 1, 1);
    const [r, g, b, a] = imageData.data;

    // Skip transparent pixels, continue to next layer
    if (a < 128) continue;

    return [r, g, b];
  }

  return null;
};

/**
 * Handle mouse move event
 */
const handleMouseMove = async (e: any): Promise<void> => {
  if (!isEnabled) return;

  // Throttle
  const now = Date.now();
  if (now - lastSpoitTime < SPOIT_THROTTLE_MS) return;
  lastSpoitTime = now;

  // Get cursor position (lat/lng)
  const lngLat = e.lngLat;
  if (!lngLat) return;

  const { lat, lng } = lngLat;

  // Convert to tile pixel coordinates
  const { TLX, TLY, PxX, PxY } = latLngToTilePixel(lat, lng);

  // Get pixel color from gallery
  const color = await getPixelColorFromGallery(TLX, TLY, PxX, PxY);
  if (!color) return;

  const [r, g, b] = color;

  // Find closest color ID
  const colorId = findClosestColorId(r, g, b);

  // Select color
  const selected = selectColor(colorId);
  if (selected) {
    console.log(
      `🧑‍🎨 : Auto color spoit: [${r},${g},${b}] -> color-${colorId} at (${TLX},${TLY},${PxX},${PxY})`
    );
  }
};

/**
 * Start auto color spoit
 */
export const startAutoColorSpoit = (): void => {
  if (!isDevModeEnabled()) {
    console.warn("🧑‍🎨 : Auto color spoit requires developer mode");
    return;
  }

  if (isEnabled) return;

  // Get map instance
  mapInstance = window.mrWplace?.wplaceMap;
  if (!mapInstance) {
    console.error("🧑‍🎨 : Map instance not found");
    return;
  }

  isEnabled = true;

  // Add mouse move listener
  mouseMoveHandler = (e: any) => {
    handleMouseMove(e).catch((error) => {
      console.error("🧑‍🎨 : Auto color spoit error:", error);
    });
  };

  mapInstance.on("mousemove", mouseMoveHandler);
  console.log("🧑‍🎨 : Auto color spoit started");
};

/**
 * Stop auto color spoit
 */
export const stopAutoColorSpoit = (): void => {
  if (!isEnabled) return;

  isEnabled = false;

  // Remove mouse move listener
  if (mapInstance && mouseMoveHandler) {
    // Note: MapLibre doesn't have off method, need to track and remove manually
    // For now, we'll just set isEnabled to false to stop processing
  }

  mapInstance = null;
  mouseMoveHandler = null;
  console.log("🧑‍🎨 : Auto color spoit stopped");
};

/**
 * Check if auto color spoit is enabled
 */
export const isAutoColorSpoitEnabled = (): boolean => isEnabled;