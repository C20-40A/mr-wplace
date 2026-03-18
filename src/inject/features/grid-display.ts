import { getMapInstanceFromWplace } from "./map-instance";
import { TILE_SIZE, latLonToPixels, ZOOM_LEVEL } from "@/utils/geo-converter";
import { tilePixelToLatLng } from "@/utils/coordinate";

const GRID_CONTAINER_ID = "mr-wplace-grid-display";
const GRID_CANVAS_ID = "mr-wplace-grid-canvas";
const GRID_MIN_ZOOM = 14;
const GRID_MIN_SCREEN_SPACING = 6;
const GRID_MAX_LINES_PER_AXIS = 180;
const GRID_MAX_DPR = 1.5;
const MAP_UPDATE_EVENTS = ["move", "zoom", "resize", "rotate", "pitch"];

interface LngLat {
  lng: number;
  lat: number;
}

interface GridMap {
  getCenter: () => LngLat;
  getZoom: () => number;
  project?: (lngLat: LngLat | [number, number]) => { x: number; y: number };
  unproject?: (point: { x: number; y: number } | [number, number]) => LngLat;
  getContainer?: () => HTMLElement;
  getBearing?: () => number;
  getPitch?: () => number;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
}

let gridEnabled = false;
let gridContainer: HTMLDivElement | null = null;
let gridCanvas: HTMLCanvasElement | null = null;
let activeMap: GridMap | null = null;
let mapUpdateHandler: (() => void) | null = null;
let renderFrameId: number | null = null;

const WORLD_PIXEL_SPAN = TILE_SIZE * 2 ** ZOOM_LEVEL;

const getMapContainer = (map: GridMap): HTMLElement | null => {
  const byApi = map.getContainer?.();
  if (byApi instanceof HTMLElement) return byApi;

  return (
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container")
  );
};

const createGridOverlay = (): HTMLDivElement => {
  const container = document.createElement("div");
  container.id = GRID_CONTAINER_ID;
  container.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    overflow: hidden;
  `;

  const canvas = document.createElement("canvas");
  canvas.id = GRID_CANVAS_ID;
  canvas.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  `;

  container.appendChild(canvas);
  gridCanvas = canvas;
  return container;
};

const clearScheduledRender = (): void => {
  if (renderFrameId === null) return;
  window.cancelAnimationFrame(renderFrameId);
  renderFrameId = null;
};

const clearGridCanvas = (): void => {
  if (!gridCanvas) return;
  const context = gridCanvas.getContext("2d");
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
};

const hideGridOverlay = (): void => {
  if (gridContainer) gridContainer.style.display = "none";
  clearGridCanvas();
};

const isNorthUpFlat = (map: GridMap): boolean => {
  const bearing = map.getBearing?.() ?? 0;
  const pitch = map.getPitch?.() ?? 0;
  return Math.abs(bearing) < 0.01 && pitch < 0.01;
};

const syncCanvasResolution = (
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): CanvasRenderingContext2D | null => {
  const context = canvas.getContext("2d");
  if (!context) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, GRID_MAX_DPR);
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(cssHeight * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);
  return context;
};

const toAlignedScreen = (value: number): number => Math.round(value) + 0.5;

const wrapWorldPixelX = (value: number): number => {
  let out = value % WORLD_PIXEL_SPAN;
  if (out < 0) out += WORLD_PIXEL_SPAN;
  return out;
};

const normalizeWorldPixelXNear = (value: number, base: number): number => {
  let out = value;
  const halfSpan = WORLD_PIXEL_SPAN / 2;
  while (out - base > halfSpan) out -= WORLD_PIXEL_SPAN;
  while (out - base < -halfSpan) out += WORLD_PIXEL_SPAN;
  return out;
};

const worldPixelToLngLat = (worldX: number, worldY: number): LngLat => {
  const wrappedX = wrapWorldPixelX(worldX);
  const tileX = Math.floor(wrappedX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const pxX = wrappedX - tileX * TILE_SIZE;
  const pxY = worldY - tileY * TILE_SIZE;
  return tilePixelToLatLng(tileX, tileY, pxX, pxY);
};

const canRenderSinglePixelGrid = (
  scale: number,
  cssWidth: number,
  cssHeight: number,
): boolean => {
  const visibleWorldWidth = cssWidth / scale;
  const visibleWorldHeight = cssHeight / scale;
  const maxVisiblePixels = Math.max(visibleWorldWidth, visibleWorldHeight);
  if (scale < GRID_MIN_SCREEN_SPACING) return false;
  return maxVisiblePixels <= GRID_MAX_LINES_PER_AXIS;
};

const drawGridNow = (map: GridMap): void => {
  renderFrameId = null;

  if (!gridEnabled || !gridContainer || !gridCanvas) return;

  const mapContainer = getMapContainer(map);
  if (!mapContainer) {
    hideGridOverlay();
    return;
  }

  const rect = mapContainer.getBoundingClientRect();
  const cssWidth = Math.round(rect.width);
  const cssHeight = Math.round(rect.height);
  if (cssWidth <= 0 || cssHeight <= 0) {
    hideGridOverlay();
    return;
  }

  const zoom = map.getZoom();
  if (
    zoom < GRID_MIN_ZOOM ||
    !isNorthUpFlat(map) ||
    !map.project ||
    !map.unproject
  ) {
    hideGridOverlay();
    return;
  }

  const context = syncCanvasResolution(gridCanvas, cssWidth, cssHeight);
  if (!context) return;

  gridContainer.style.display = "block";

  const center = map.getCenter();
  const [centerWorldX, centerWorldY] = latLonToPixels(
    center.lat,
    center.lng,
    ZOOM_LEVEL,
  );
  const topLeft = map.unproject({ x: 0, y: 0 });
  const topRight = map.unproject({ x: cssWidth, y: 0 });
  const bottomLeft = map.unproject({ x: 0, y: cssHeight });
  const bottomRight = map.unproject({ x: cssWidth, y: cssHeight });
  const corners = [topLeft, topRight, bottomLeft, bottomRight].map((corner) => {
    const [worldX, worldY] = latLonToPixels(corner.lat, corner.lng, ZOOM_LEVEL);
    return {
      x: normalizeWorldPixelXNear(worldX, centerWorldX),
      y: worldY,
    };
  });

  const referencePoint = map.project(center);
  const nextXPoint = map.project(
    worldPixelToLngLat(centerWorldX + 1, centerWorldY),
  );
  const nextYPoint = map.project(
    worldPixelToLngLat(centerWorldX, centerWorldY + 1),
  );
  const scaleX = Math.abs(nextXPoint.x - referencePoint.x);
  const scaleY = Math.abs(nextYPoint.y - referencePoint.y);
  const scale = Math.max(Math.min(scaleX, scaleY), 0.0001);
  if (!canRenderSinglePixelGrid(scale, cssWidth, cssHeight)) {
    hideGridOverlay();
    return;
  }
  const step = 1;

  const leftWorld = Math.min(...corners.map((corner) => corner.x));
  const topWorld = Math.min(...corners.map((corner) => corner.y));
  const rightWorld = Math.max(...corners.map((corner) => corner.x));
  const bottomWorld = Math.max(...corners.map((corner) => corner.y));

  const startX = Math.floor(leftWorld / step) * step;
  const endX = Math.ceil(rightWorld / step) * step;
  const startY = Math.floor(topWorld / step) * step;
  const endY = Math.ceil(bottomWorld / step) * step;

  context.beginPath();
  for (let worldX = startX; worldX <= endX; worldX += step) {
    const { x } = map.project(worldPixelToLngLat(worldX, centerWorldY));
    const screenX = toAlignedScreen(x);
    context.moveTo(screenX, 0);
    context.lineTo(screenX, cssHeight);
  }

  for (let worldY = startY; worldY <= endY; worldY += step) {
    const { y } = map.project(worldPixelToLngLat(centerWorldX, worldY));
    const screenY = toAlignedScreen(y);
    context.moveTo(0, screenY);
    context.lineTo(cssWidth, screenY);
  }

  context.lineWidth = 1;
  context.strokeStyle =
    step === 1 ? "rgba(120, 120, 120, 0.48)" : "rgba(120, 120, 120, 0.34)";
  context.stroke();
};

const scheduleGridRender = (map: GridMap): void => {
  if (!gridEnabled) return;
  if (renderFrameId !== null) return;

  renderFrameId = window.requestAnimationFrame(() => {
    const nextMap = activeMap ?? map;
    if (!nextMap) {
      renderFrameId = null;
      return;
    }
    drawGridNow(nextMap);
  });
};

const attachGridOverlay = (map: GridMap): void => {
  if (gridContainer) return;

  const mapContainer = getMapContainer(map);
  if (!mapContainer) {
    console.warn("🧑‍🎨 : Map container not found for grid display");
    return;
  }

  const existingContainer = document.getElementById(GRID_CONTAINER_ID);
  if (existingContainer) existingContainer.remove();

  gridContainer = createGridOverlay();
  mapContainer.appendChild(gridContainer);

  mapUpdateHandler = () => scheduleGridRender(map);
  for (const eventName of MAP_UPDATE_EVENTS)
    map.on(eventName, mapUpdateHandler);

  activeMap = map;
  scheduleGridRender(map);
  console.log("🧑‍🎨 : Grid display added");
};

const removeGridOverlay = (map: GridMap): void => {
  clearScheduledRender();

  if (mapUpdateHandler) {
    for (const eventName of MAP_UPDATE_EVENTS)
      map.off(eventName, mapUpdateHandler);
    mapUpdateHandler = null;
  }

  gridContainer?.remove();
  gridContainer = null;
  gridCanvas = null;
  activeMap = null;

  console.log("🧑‍🎨 : Grid display removed");
};

export const setGridDisplayEnabled = (enabled: boolean): void => {
  gridEnabled = enabled;

  const map = getMapInstanceFromWplace() as GridMap | null;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for grid display");
    return;
  }

  if (enabled) attachGridOverlay(map);
  else removeGridOverlay(map);

  console.log("🧑‍🎨 : Grid display enabled:", enabled);
};

export const setupGridDisplayOnMapReady = (mapInstance: unknown): void => {
  const map = mapInstance as GridMap;

  const onStyleData = () => {
    if (!gridEnabled) return;
    activeMap = map;

    const mapContainer = getMapContainer(map);
    if (!mapContainer) return;
    if (gridContainer && gridContainer.parentElement !== mapContainer) {
      gridContainer.remove();
      mapContainer.appendChild(gridContainer);
    }

    scheduleGridRender(map);
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Grid display listener setup complete");
};
