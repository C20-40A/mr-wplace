import { normalizeAreaColor } from "@/utils/area-region";
import type { AreaMap } from "./types";
import {
  areaFillOpacity,
  areaNameDisplayMode,
  areaNameFontSizePx,
  areaNameStyleMode,
  areaRegions,
  cachedMapContainer,
  editMode,
  editVertices,
  editingColor,
  editingRegionId,
  regionLayerDataDirty,
  regionLayerStyleDirty,
  editLayerDataDirty,
  setRegionLayerDataDirty,
  setRegionLayerStyleDirty,
  setEditLayerDataDirty,
  setCachedMapContainer,
} from "./state";
import { hexToRgb, getContrastTextColor, getNeutralLabelHaloColor } from "./label-badge";

// --- canvas refs ---
let regionCanvas: HTMLCanvasElement | null = null;
let editCanvas: HTMLCanvasElement | null = null;

export const getRegionCanvas = (): HTMLCanvasElement | null => regionCanvas;
export const getEditCanvas = (): HTMLCanvasElement | null => editCanvas;

export const createAreaCanvases = (container: HTMLDivElement): void => {
  const existing = container.querySelectorAll("canvas.mr-wplace-area-canvas");
  for (const el of existing) el.remove();

  const region = document.createElement("canvas");
  region.className = "mr-wplace-area-canvas";
  region.style.cssText = `position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;`;
  container.insertBefore(region, container.firstChild);

  const edit = document.createElement("canvas");
  edit.className = "mr-wplace-area-canvas";
  edit.style.cssText = `position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 2;`;
  container.insertBefore(edit, container.firstChild?.nextSibling ?? null);

  regionCanvas = region;
  editCanvas = edit;
};

export const clearAreaCanvases = (): void => {
  regionCanvas = null;
  editCanvas = null;
};

const resizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number): void => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
};

const projectVertices = (
  map: AreaMap,
  vertices: { lng: number; lat: number }[],
): { x: number; y: number }[] => vertices.map((v) => map.project(v));

const drawPolygon = (
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  dpr: number,
): void => {
  if (points.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * dpr, points[0].y * dpr);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * dpr, points[i].y * dpr);
  ctx.closePath();
};

const parseFontSize = (): number => Math.max(8, Math.min(48, areaNameFontSizePx));

// --- region layer canvas rendering ---
export const syncAreaRegionLayerData = (map: AreaMap): void => {
  if (!regionLayerDataDirty && !regionLayerStyleDirty) return;
  if (!regionCanvas) return;

  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) return;

  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;
  resizeCanvas(regionCanvas, width, height);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = regionCanvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, regionCanvas.width, regionCanvas.height);

  if (areaNameDisplayMode !== "off") {
    // pass 1: collect label positions (render after fill/stroke)
  }

  const labelsToDraw: { name: string; color: string; cx: number; cy: number }[] = [];

  for (const region of areaRegions) {
    if (!region.visible) continue;
    if (editMode && editingRegionId && region.id === editingRegionId) continue;
    if (region.vertices.length < 3) continue;

    const points = projectVertices(map, region.vertices);
    const areaColor = normalizeAreaColor(region.color);
    const rgb = hexToRgb(areaColor);
    if (!rgb) continue;

    // fill
    ctx.save();
    ctx.globalAlpha = areaFillOpacity;
    ctx.fillStyle = areaColor;
    drawPolygon(ctx, points, dpr);
    ctx.fill();
    ctx.restore();

    // stroke
    ctx.save();
    ctx.strokeStyle = areaColor;
    ctx.lineWidth = 3 * dpr;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    drawPolygon(ctx, points, dpr);
    ctx.stroke();
    ctx.restore();

    if (areaNameDisplayMode !== "off" && region.name) {
      const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
      const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
      labelsToDraw.push({ name: region.name, color: areaColor, cx, cy });
    }
  }

  // pass 2: labels
  const fontSize = parseFontSize();
  for (const { name, color, cx, cy } of labelsToDraw) {
    ctx.save();
    ctx.font = `700 ${fontSize * dpr}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (areaNameStyleMode === "color-badge") {
      // badge background
      const metrics = ctx.measureText(name);
      const textW = metrics.width;
      const padX = 6 * dpr;
      const padY = 3 * dpr;
      const bw = textW + padX * 2;
      const bh = fontSize * dpr + padY * 2;
      const bx = cx * dpr - bw / 2;
      const by = cy * dpr - bh / 2;
      const radius = bh / 2;
      ctx.beginPath();
      ctx.moveTo(bx + radius, by);
      ctx.lineTo(bx + bw - radius, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + radius, radius);
      ctx.lineTo(bx + bw, by + bh - radius);
      ctx.arcTo(bx + bw, by + bh, bx + bw - radius, by + bh, radius);
      ctx.lineTo(bx + radius, by + bh);
      ctx.arcTo(bx, by + bh, bx, by + bh - radius, radius);
      ctx.lineTo(bx, by + radius);
      ctx.arcTo(bx, by, bx + radius, by, radius);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.97;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = getContrastTextColor(color);
    } else {
      // halo
      const halo = getNeutralLabelHaloColor(color);
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = halo;
      ctx.shadowBlur = 3 * dpr;
    }
    ctx.fillText(name, cx * dpr, cy * dpr);
    ctx.restore();
  }

  setRegionLayerDataDirty(false);
  setRegionLayerStyleDirty(false);
};

// --- edit layer canvas rendering ---
export const syncAreaEditLayerData = (map: AreaMap): void => {
  if (!editLayerDataDirty) return;
  if (!editCanvas) return;

  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) return;

  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;
  resizeCanvas(editCanvas, width, height);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ctx = editCanvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, editCanvas.width, editCanvas.height);

  if (editMode && editVertices.length >= 3) {
    const points = projectVertices(map, editVertices);
    const color = normalizeAreaColor(editingColor);

    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = color;
    drawPolygon(ctx, points, dpr);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * dpr;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    drawPolygon(ctx, points, dpr);
    ctx.stroke();
    ctx.restore();
  }

  setEditLayerDataDirty(false);
};

// canvas cleanup (called on disable)
export const removeAreaMapLayers = (_map: AreaMap): void => {
  if (regionCanvas) {
    const ctx = regionCanvas.getContext("2d");
    ctx?.clearRect(0, 0, regionCanvas.width, regionCanvas.height);
  }
  if (editCanvas) {
    const ctx = editCanvas.getContext("2d");
    ctx?.clearRect(0, 0, editCanvas.width, editCanvas.height);
  }
};

export const getMapContainer = (map: AreaMap): HTMLElement | null => {
  const byApi = map.getContainer?.();
  if (byApi instanceof HTMLElement) return byApi;
  return (
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container")
  );
};

export const resolveMapContainer = (map: AreaMap): HTMLElement | null => {
  if (cachedMapContainer?.isConnected) return cachedMapContainer;
  const next = getMapContainer(map);
  if (!next) return null;
  setCachedMapContainer(next);
  return next;
};
