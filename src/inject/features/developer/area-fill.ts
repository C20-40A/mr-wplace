/**
 * Area Fill
 * Automatically clicks pixels within a defined rectangular area
 * Developer mode only
 */

import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import { latLngToTilePixelFloat, tilePixelToLatLng } from "@/utils/coordinate";
import { TILE_SIZE } from "@/utils/geo-converter";
import { getOriginalBlob, overlayLayers } from "../tile-draw";
import type { TileDrawInstance } from "../tile-draw/types";
import { statusManagerSingleton } from "../user-status/status-manager";
import { colorpalette } from "@/constants/colors";

interface AreaFillCorners {
  topLeft: { lat: number; lng: number } | null;
  bottomRight: { lat: number; lng: number } | null;
}

type FillPattern = "linear" | "spiralPingPong";

interface AreaFillOptions {
  skipExistingPixels: boolean;
  templateOnlyMode: boolean;
  fillPattern?: FillPattern;
}

const DEFAULT_OPTIONS: AreaFillOptions = {
  skipExistingPixels: true,
  templateOnlyMode: false,
};

// ============================================
// Fill patterns
// ============================================

/**
 * Apply spiral ping-pong pattern (outside → inside, alternating directions per layer)
 * Each spiral layer alternates: clockwise → counter-clockwise → clockwise...
 * Uses gridX/gridY coordinates for correct lookup even after filtering.
 */
const applySpiralPingPongPattern = (
  positions: PixelPosition[],
  width: number,
  height: number,
): PixelPosition[] => {
  if (width <= 0 || height <= 0) return positions;

  // Build coordinate-keyed lookup from filtered positions
  const coordMap = new Map<string, PixelPosition>();
  for (const pos of positions) {
    coordMap.set(`${pos.gridX},${pos.gridY}`, pos);
  }

  const result: PixelPosition[] = [];
  let top = 0,
    bottom = height - 1,
    left = 0,
    right = width - 1;
  let layerIndex = 0;

  const push = (x: number, y: number) => {
    const pos = coordMap.get(`${x},${y}`);
    if (pos) result.push(pos);
  };

  while (top <= bottom && left <= right) {
    const clockwise = layerIndex % 2 === 0;

    if (clockwise) {
      // Clockwise: → ↓ ← ↑
      for (let x = left; x <= right; x++) push(x, top);
      top++;

      for (let y = top; y <= bottom; y++) push(right, y);
      right--;

      if (top <= bottom) {
        for (let x = right; x >= left; x--) push(x, bottom);
        bottom--;
      }

      if (left <= right) {
        for (let y = bottom; y >= top; y--) push(left, y);
        left++;
      }
    } else {
      // Counter-clockwise: ↓ → ↑ ←
      for (let y = top; y <= bottom; y++) push(left, y);
      left++;

      if (left <= right) {
        for (let x = left; x <= right; x++) push(x, bottom);
        bottom--;
      }

      if (top <= bottom) {
        for (let y = bottom; y >= top; y--) push(right, y);
        right--;
      }

      if (left <= right) {
        for (let x = right; x >= left; x--) push(x, top);
        top++;
      }
    }

    layerIndex++;
  }

  return result;
};

/**
 * Apply fill pattern based on selected pattern
 */
const applyFillPattern = (
  positions: PixelPosition[],
  width: number,
  height: number,
  pattern: FillPattern,
): PixelPosition[] => {
  if (pattern === "linear") return positions;
  return applySpiralPingPongPattern(positions, width, height);
};

// ============================================
// Core state
// ============================================

let isRunning = false;
let stopRequested = false;
let currentCorners: AreaFillCorners = { topLeft: null, bottomRight: null };
let lastProcessedIndex = 0; // Track last processed index for resume
let cachedPositions: PixelPosition[] | null = null; // Cache filtered positions
let cachedOptions: AreaFillOptions | null = null; // Cache options for comparison

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
  gridX: number;
  gridY: number;
}

interface GenerateResult {
  positions: PixelPosition[];
  width: number;
  height: number;
}

interface TileDrawSource {
  bitmap: ImageBitmap;
  offsetX: number;
  offsetY: number;
}

const parseTileCoords = (
  tileKey: string,
): { tileX: number; tileY: number } | null => {
  const parts = tileKey.split(",");
  if (parts.length < 2) return null;
  const tileX = Number(parts[0]);
  const tileY = Number(parts[1]);
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;
  return { tileX, tileY };
};

const tileIntersectsLayerBounds = (
  layer: TileDrawInstance,
  tileX: number,
  tileY: number,
): boolean => {
  if (!layer.bounds) return false;

  const tilePixelLeft = tileX * TILE_SIZE;
  const tilePixelTop = tileY * TILE_SIZE;
  const tilePixelRight = tilePixelLeft + TILE_SIZE;
  const tilePixelBottom = tilePixelTop + TILE_SIZE;

  return (
    tilePixelRight > layer.bounds.left &&
    tilePixelLeft < layer.bounds.right &&
    tilePixelBottom > layer.bounds.top &&
    tilePixelTop < layer.bounds.bottom
  );
};

const getLayerInMemorySources = (
  layer: TileDrawInstance,
  tileX: number,
  tileY: number,
): TileDrawSource[] => {
  if (!layer.tiles) return [];

  const sources: TileDrawSource[] = [];

  for (const [key, bitmap] of Object.entries(layer.tiles)) {
    const parts = key.split(",");
    if (parts.length < 2) continue;

    const keyTileX = Number(parts[0]);
    const keyTileY = Number(parts[1]);
    if (!Number.isFinite(keyTileX) || !Number.isFinite(keyTileY)) continue;
    if (keyTileX !== tileX || keyTileY !== tileY) continue;

    const offsetX = parts.length >= 4 ? Number(parts[2]) : 0;
    const offsetY = parts.length >= 4 ? Number(parts[3]) : 0;

    sources.push({
      bitmap,
      offsetX: Number.isFinite(offsetX) ? offsetX : 0,
      offsetY: Number.isFinite(offsetY) ? offsetY : 0,
    });
  }

  return sources;
};

const layerAffectsTile = (
  layer: TileDrawInstance,
  tileKey: string,
  tileX: number,
  tileY: number,
): boolean => {
  if (!layer.drawEnabled) return false;

  // v2 layers: exact affected tile membership
  if (layer.affectedTiles && layer.affectedTiles.length > 0) {
    const affectedTileSet =
      layer.affectedTileSet ?? (layer.affectedTileSet = new Set(layer.affectedTiles));
    return affectedTileSet.has(tileKey);
  }

  // Optimized legacy layers: bounds intersection
  if (layer.isOptimized && layer.bounds) {
    return tileIntersectsLayerBounds(layer, tileX, tileY);
  }

  // Legacy in-memory tiles: tile key match
  if (layer.tiles) {
    if (!layer.affectedTileSet) {
      const tileSet = new Set<string>();
      for (const key of Object.keys(layer.tiles)) {
        const parts = key.split(",");
        if (parts.length < 2) continue;
        const keyTileX = Number(parts[0]);
        const keyTileY = Number(parts[1]);
        if (!Number.isFinite(keyTileX) || !Number.isFinite(keyTileY)) continue;
        tileSet.add(`${keyTileX},${keyTileY}`);
      }
      layer.affectedTileSet = tileSet;
    }
    return layer.affectedTileSet.has(tileKey);
  }

  // Fallback: single-tile layers (e.g. snapshot-like data) use anchor coords
  return layer.coords[0] === tileX && layer.coords[1] === tileY;
};

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
      positions.push({
        lat, lng, tileKey: `${tileX},${tileY}`, pxX, pxY,
        gridX: x - minX, gridY: y - minY,
      });
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
 * Get currently selected color RGB from localStorage
 */
const getSelectedColorRGB = (): [number, number, number] | null => {
  const selectedColorId = localStorage.getItem("selected-color");
  if (!selectedColorId) return null;
  const id = parseInt(selectedColorId, 10);
  if (isNaN(id)) return null;
  const color = colorpalette.find((c) => c.id === id);
  return color ? color.rgb : null;
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
 * Filter positions to only include pixels that match the selected color in overlay layers
 * Used when templateOnlyMode is enabled
 * Supports IndexedDB v2 for gallery images and snapshot layers
 * Only includes pixels where background differs from template (skip already-placed pixels)
 */
const filterByTemplateColor = async (
  positions: PixelPosition[],
  targetRGB: [number, number, number],
): Promise<PixelPosition[]> => {
  if (overlayLayers.length === 0) return [];

  const byTile = new Map<string, PixelPosition[]>();
  for (const pos of positions) {
    const arr = byTile.get(pos.tileKey) ?? [];
    arr.push(pos);
    byTile.set(pos.tileKey, arr);
  }

  const result: PixelPosition[] = [];
  const tileImageDataCache = new Map<string, ImageData | null>();
  const inMemoryTileCache = new Map<string, TileDrawSource[]>();
  const snapshotBitmapCache = new Map<string, ImageBitmap | null>();
  const temporaryBitmaps: ImageBitmap[] = [];
  let galleryRepo: any;
  let snapshotRepo: any;

  for (const [tileKey, tilePositions] of byTile) {
    const parsedTile = parseTileCoords(tileKey);
    if (!parsedTile) continue;

    const { tileX, tileY } = parsedTile;
    const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
    const ctx = canvas.getContext("2d")!;

    for (const layer of overlayLayers) {
      if (!layerAffectsTile(layer, tileKey, tileX, tileY)) continue;

      const cacheKey = `${layer.imageKey}:${tileKey}`;
      let sources = inMemoryTileCache.get(cacheKey);
      if (!sources) {
        sources = getLayerInMemorySources(layer, tileX, tileY);
        inMemoryTileCache.set(cacheKey, sources);
      }

      if (sources.length > 0) {
        for (const source of sources) {
          ctx.drawImage(source.bitmap, source.offsetX, source.offsetY);
        }
        continue;
      }

      const isSnapshot = layer.imageKey.startsWith("snapshot_");
      if (isSnapshot) {
        let snapshotBitmap = snapshotBitmapCache.get(layer.imageKey);
        if (snapshotBitmap === undefined) {
          snapshotBitmap = null;
          if (!snapshotRepo) {
            try {
              const { getSnapshotRepository } = await import("../../db/snapshot-repository");
              snapshotRepo = getSnapshotRepository();
            } catch {}
          }
          if (snapshotRepo) {
            const snapshotId = layer.imageKey.replace("snapshot_tile_snapshot_", "");
            const blob = await snapshotRepo.getSnapshot(snapshotId);
            if (blob) {
              snapshotBitmap = await createImageBitmap(blob);
              temporaryBitmaps.push(snapshotBitmap);
            }
          }
          snapshotBitmapCache.set(layer.imageKey, snapshotBitmap);
        }
        if (snapshotBitmap) ctx.drawImage(snapshotBitmap, 0, 0);
        continue;
      }

      if (!galleryRepo) {
        try {
          const { getGalleryRepository } = await import("../../db/gallery-repository");
          galleryRepo = getGalleryRepository();
        } catch {}
      }
      if (galleryRepo) {
        const blob = await galleryRepo.getTile(layer.imageKey, tileKey);
        if (blob) {
          const bitmap = await createImageBitmap(blob);
          temporaryBitmaps.push(bitmap);
          ctx.drawImage(bitmap, 0, 0);
        }
      }
    }

    const templateData = ctx.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;

    // Load background tile for comparison
    let bgImageData = tileImageDataCache.get(tileKey);
    if (bgImageData === undefined) {
      const blob = getOriginalBlob(tileKey);
      bgImageData = blob ? await loadTileImageData(blob) : null;
      tileImageDataCache.set(tileKey, bgImageData);
    }

    for (const pos of tilePositions) {
      const i = (pos.pxY * TILE_SIZE + pos.pxX) * 4;
      const tAlpha = templateData[i + 3];

      // Skip if template pixel is transparent
      if (tAlpha === 0) continue;

      // Check if template color matches target
      if (templateData[i] !== targetRGB[0] || templateData[i + 1] !== targetRGB[1] || templateData[i + 2] !== targetRGB[2]) continue;

      // If no background data, include (empty tile)
      if (!bgImageData) {
        result.push(pos);
        continue;
      }

      // Check background pixel
      const bgAlpha = bgImageData.data[i + 3];

      // Include if background is empty (alpha === 0)
      if (bgAlpha === 0) {
        result.push(pos);
        continue;
      }

      // Include if background color differs from template color
      if (bgImageData.data[i] !== targetRGB[0] || bgImageData.data[i + 1] !== targetRGB[1] || bgImageData.data[i + 2] !== targetRGB[2]) {
        result.push(pos);
      }
      // Skip if background already matches template color (no need to paint)
    }
  }

  for (const bitmap of temporaryBitmaps) {
    bitmap.close();
  }

  return result;
};

/**
 * Check if corners or options have changed (requires recalculation)
 */
const needsRecalculation = (
  corners: AreaFillCorners,
  options: AreaFillOptions,
): boolean => {
  if (!cachedPositions || !cachedOptions) {
    console.log("🧑‍🎨 : Recalculation needed - no cache");
    return true;
  }

  // Check corners change
  const cornersChanged =
    currentCorners.topLeft?.lat !== corners.topLeft?.lat ||
    currentCorners.topLeft?.lng !== corners.topLeft?.lng ||
    currentCorners.bottomRight?.lat !== corners.bottomRight?.lat ||
    currentCorners.bottomRight?.lng !== corners.bottomRight?.lng;

  if (cornersChanged) {
    console.log("🧑‍🎨 : Recalculation needed - corners changed");
    return true;
  }

  // Check options change
  const optionsChanged =
    cachedOptions.skipExistingPixels !== options.skipExistingPixels ||
    cachedOptions.templateOnlyMode !== options.templateOnlyMode ||
    cachedOptions.fillPattern !== options.fillPattern;

  if (optionsChanged) {
    console.log("🧑‍🎨 : Recalculation needed - options changed");
    return true;
  }

  console.log("🧑‍🎨 : Using cached positions (no recalculation)");
  return false;
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

  const isResume = !needsRecalculation(corners, options);
  currentCorners = corners;
  isRunning = true;
  stopRequested = false;

  console.log(
    `🧑‍🎨 : Area fill ${isResume ? "resumed" : "started"}`,
    corners,
  );

  let positions: PixelPosition[];
  let width: number;
  let height: number;

  // Use cached positions if resuming, otherwise recalculate
  if (isResume && cachedPositions && lastProcessedIndex < cachedPositions.length) {
    positions = cachedPositions;
    console.log(
      `🧑‍🎨 : Area fill - Resuming from index ${lastProcessedIndex}/${positions.length}`,
    );
  } else {
    // Reset cache and index
    lastProcessedIndex = 0;
    cachedOptions = { ...options };

    const generated = generatePixelPositions(corners.topLeft, corners.bottomRight);
    positions = generated.positions;
    width = generated.width;
    height = generated.height;
    console.log(
      `🧑‍🎨 : Area fill - ${positions.length} pixels in area (${width}x${height})`,
    );

    // Template only mode: filter by overlay color (skip existing pixel check)
    if (options.templateOnlyMode) {
      const selectedRGB = getSelectedColorRGB();
      if (!selectedRGB) {
        console.error("🧑‍🎨 : Template only mode requires a selected color");
        isRunning = false;
        window.postMessage({ source: "mr-wplace-area-fill-finished" }, "*");
        return;
      }

      const before = positions.length;
      positions = await filterByTemplateColor(positions, selectedRGB);
      console.log(
        `🧑‍🎨 : Area fill - Template filter: ${positions.length} pixels match color RGB(${selectedRGB.join(",")}) (filtered ${before - positions.length})`,
      );

      if (positions.length === 0) {
        console.warn(
          "🧑‍🎨 : No pixels match the selected color in overlay templates",
        );
        isRunning = false;
        window.postMessage({ source: "mr-wplace-area-fill-finished" }, "*");
        return;
      }
    } else if (options.skipExistingPixels) {
      // Normal mode: skip existing pixels
      const before = positions.length;
      positions = await filterExistingPixels(positions);
      console.log(
        `🧑‍🎨 : Area fill - Filtered to ${positions.length} empty pixels (skipped ${
          before - positions.length
        } existing)`,
      );
    }

    // Apply fill pattern
    const fillPattern = options.fillPattern ?? "spiralPingPong";
    positions = applyFillPattern(positions, width, height, fillPattern);
    if (fillPattern !== "linear") {
      console.log(`🧑‍🎨 : Area fill - Pattern applied: ${fillPattern}`);
    }

    // Cache positions for resume
    cachedPositions = positions;
  }

  // Get available charge count
  const availableCharges = statusManagerSingleton.getCurrentChargeCount();
  console.log(`🧑‍🎨 : Area fill - Available charges: ${availableCharges}`);

  // Calculate remaining positions from last index
  const remainingPositions = positions.slice(lastProcessedIndex);
  const maxClicks = Math.min(remainingPositions.length, availableCharges);
  const limitedPositions = remainingPositions.slice(0, maxClicks);

  if (limitedPositions.length < remainingPositions.length) {
    console.log(
      `🧑‍🎨 : Area fill - Limited to ${limitedPositions.length} clicks (charge limit)`,
    );
  }

  // Send initial progress
  window.postMessage(
    {
      source: "mr-wplace-area-fill-progress",
      current: lastProcessedIndex,
      total: positions.length,
    },
    "*",
  );

  let clickCount = 0;
  for (const pos of limitedPositions) {
    if (stopRequested) {
      console.log(
        `🧑‍🎨 : Area fill stopped by user at ${lastProcessedIndex + clickCount}/${positions.length}`,
      );
      break;
    }

    const success = fireMapClick(pos.lat, pos.lng);
    if (success) {
      clickCount++;
      lastProcessedIndex++;

      // Send progress update every 10 clicks or on milestones
      if (clickCount % 10 === 0 || lastProcessedIndex === positions.length) {
        window.postMessage(
          {
            source: "mr-wplace-area-fill-progress",
            current: lastProcessedIndex,
            total: positions.length,
          },
          "*",
        );
      }

      if (clickCount % 100 === 0) {
        console.log(
          `🧑‍🎨 : Area fill progress: ${lastProcessedIndex}/${positions.length}`,
        );
      }
    }

    await sleep(getGradualInterval(lastProcessedIndex));
  }

  const isComplete = lastProcessedIndex >= positions.length;
  isRunning = false;

  if (isComplete) {
    console.log(`🧑‍🎨 : Area fill completed. Total clicked ${lastProcessedIndex} pixels`);
    // Reset cache on completion
    cachedPositions = null;
    cachedOptions = null;
    lastProcessedIndex = 0;
  } else {
    console.log(
      `🧑‍🎨 : Area fill paused at ${lastProcessedIndex}/${positions.length}`,
    );
  }

  // Notify content script that area fill has finished/paused
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
 * Reset area fill progress (called when paint modal is closed)
 */
export const resetAreaFillProgress = (): void => {
  if (cachedPositions && lastProcessedIndex > 0) {
    console.log(
      `🧑‍🎨 : Area fill progress reset from ${lastProcessedIndex} to 0 (paint modal closed)`,
    );
    lastProcessedIndex = 0;
  }
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

/**
 * Calculate estimated paint count for given corners and options
 */
export const calculateAreaFillEstimate = async (
  corners: AreaFillCorners,
  options: AreaFillOptions = DEFAULT_OPTIONS,
): Promise<{ total: number; estimated: number } | null> => {
  if (!corners.topLeft || !corners.bottomRight) return null;

  const generated = generatePixelPositions(corners.topLeft, corners.bottomRight);
  let positions = generated.positions;
  const { width, height } = generated;

  const totalPixels = positions.length;

  if (options.templateOnlyMode) {
    const selectedRGB = getSelectedColorRGB();
    if (!selectedRGB) return { total: totalPixels, estimated: 0 };
    positions = await filterByTemplateColor(positions, selectedRGB);
  } else if (options.skipExistingPixels) {
    positions = await filterExistingPixels(positions);
  }

  const fillPattern = options.fillPattern ?? "spiralPingPong";
  positions = applyFillPattern(positions, width, height, fillPattern);

  return { total: totalPixels, estimated: positions.length };
};
