import type {
  AreaRegion,
  AreaRegionEditSnapshot,
  AreaRegionVertex,
} from "@/types/area-region";
import { getMapInstanceFromWplace } from "./map-instance";

const AREA_CONTAINER_ID = "mr-wplace-area-measure";
const AREA_SVG_NS = "http://www.w3.org/2000/svg";
const MAP_UPDATE_EVENTS = ["move", "zoom", "rotate", "pitch", "resize"];

interface LngLat {
  lng: number;
  lat: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface AreaMap {
  getCenter: () => LngLat;
  project: (lngLat: LngLat | [number, number]) => ScreenPoint;
  unproject: (point: ScreenPoint | [number, number]) => LngLat;
  getContainer?: () => HTMLElement;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  dragPan?: {
    disable: () => void;
    enable: () => void;
  };
}

interface AreaRegionEditStartPayload {
  regionId?: string | null;
  name?: string;
  color?: string;
  vertices?: AreaRegionVertex[];
  saveLabel?: string;
  cancelLabel?: string;
}

let areaEnabled = false;

let container: HTMLDivElement | null = null;
let svg: SVGSVGElement | null = null;
let regionsLayer: SVGGElement | null = null;
let editPolygon: SVGPolygonElement | null = null;
let edgeHitLayer: HTMLDivElement | null = null;
let areaLabel: HTMLDivElement | null = null;
let regionLabelLayer: HTMLDivElement | null = null;
let editActionLayer: HTMLDivElement | null = null;
let saveEditButton: HTMLButtonElement | null = null;
let cancelEditButton: HTMLButtonElement | null = null;

let areaRegions: AreaRegion[] = [];
let editMode = false;
let editingRegionId: string | null = null;
let editingRegionName = "";
let editingColor = "#0f766e";
let editingSaveLabel = "Save";
let editingCancelLabel = "Cancel";
let editVertices: LngLat[] = [];
let vertexElements: HTMLDivElement[] = [];

let activeMap: AreaMap | null = null;
let activeDragIndex: number | null = null;
let mapUpdateHandler: (() => void) | null = null;
let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
let pointerUpHandler: (() => void) | null = null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidVertex = (vertex: unknown): vertex is AreaRegionVertex => {
  if (!vertex || typeof vertex !== "object") return false;
  const candidate = vertex as Record<string, unknown>;
  return isFiniteNumber(candidate.lng) && isFiniteNumber(candidate.lat);
};

const sanitizeVertices = (vertices: unknown): LngLat[] => {
  if (!Array.isArray(vertices)) return [];
  return vertices.filter(isValidVertex).map((vertex) => ({
    lng: vertex.lng,
    lat: vertex.lat,
  }));
};

const cloneVertices = (vertices: LngLat[]): AreaRegionVertex[] =>
  vertices.map((vertex) => ({ lng: vertex.lng, lat: vertex.lat }));

const normalizeHexColor = (value: unknown, fallback = "#0f766e"): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!/^#([0-9a-fA-F]{6})$/.test(normalized)) return fallback;
  return normalized.toLowerCase();
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const matched = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!matched) return null;
  const value = matched[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
};

const getContrastTextColor = (bgHex: string): string => {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "#000";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? "#000" : "#fff";
};

const getMapContainer = (map: AreaMap): HTMLElement | null => {
  const byApi = map.getContainer?.();
  if (byApi instanceof HTMLElement) return byApi;
  return (
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container")
  );
};

const createVertexElement = (): HTMLDivElement => {
  const vertex = document.createElement("div");
  vertex.style.cssText = `
    position: absolute;
    width: 14px;
    height: 14px;
    transform: translate(-50%, -50%);
    border: 2px solid #fff;
    border-radius: 9999px;
    background: #a31616;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
    cursor: grab;
    user-select: none;
    touch-action: none;
    z-index: 3;
  `;
  return vertex;
};

const createOverlay = (): HTMLDivElement => {
  const root = document.createElement("div");
  root.id = AREA_CONTAINER_ID;
  root.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
  `;

  const svgRoot = document.createElementNS(AREA_SVG_NS, "svg");
  svgRoot.setAttribute("width", "100%");
  svgRoot.setAttribute("height", "100%");
  svgRoot.setAttribute("viewBox", "0 0 1 1");
  svgRoot.style.pointerEvents = "none";

  const regionsGroup = document.createElementNS(AREA_SVG_NS, "g");

  const editingPolygon = document.createElementNS(AREA_SVG_NS, "polygon");
  editingPolygon.setAttribute("fill", "rgba(15, 118, 110, 0.2)");
  editingPolygon.setAttribute("stroke", "rgba(15, 118, 110, 0.95)");
  editingPolygon.setAttribute("stroke-width", "3");
  editingPolygon.setAttribute("vector-effect", "non-scaling-stroke");
  editingPolygon.style.pointerEvents = "none";
  editingPolygon.style.display = "none";

  svgRoot.appendChild(regionsGroup);
  svgRoot.appendChild(editingPolygon);

  const hitLayer = document.createElement("div");
  hitLayer.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  `;

  const label = document.createElement("div");
  label.style.cssText = `
    position: absolute;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.82);
    color: #fff;
    border-radius: 9999px;
    padding: 4px 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    line-height: 1.2;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    pointer-events: none;
    z-index: 2;
    display: none;
  `;

  const labelsLayer = document.createElement("div");
  labelsLayer.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
  `;

  const actionLayer = document.createElement("div");
  actionLayer.style.cssText = `
    position: absolute;
    transform: translate(-50%, -50%);
    display: none;
    gap: 8px;
    z-index: 4;
    pointer-events: auto;
  `;

  const saveButton = document.createElement("button");
  saveButton.className = "btn btn-primary btn-sm";
  saveButton.textContent = editingSaveLabel;
  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.postMessage({ source: "mr-wplace-area-region-save-click" }, "*");
  });

  const cancelButton = document.createElement("button");
  cancelButton.className = "btn btn-outline btn-sm";
  cancelButton.textContent = editingCancelLabel;
  cancelButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.postMessage({ source: "mr-wplace-area-region-cancel-click" }, "*");
  });

  actionLayer.appendChild(saveButton);
  actionLayer.appendChild(cancelButton);

  root.appendChild(svgRoot);
  root.appendChild(hitLayer);
  root.appendChild(labelsLayer);
  root.appendChild(label);
  root.appendChild(actionLayer);

  svg = svgRoot;
  regionsLayer = regionsGroup;
  editPolygon = editingPolygon;
  edgeHitLayer = hitLayer;
  regionLabelLayer = labelsLayer;
  areaLabel = label;
  editActionLayer = actionLayer;
  saveEditButton = saveButton;
  cancelEditButton = cancelButton;

  return root;
};

const toRadians = (value: number): number => (value * Math.PI) / 180;

const toMercatorMeters = (lngLat: LngLat): { x: number; y: number } => {
  const earthRadius = 6378137;
  const maxLat = 85.05112878;
  const lat = Math.max(Math.min(lngLat.lat, maxLat), -maxLat);
  const x = earthRadius * toRadians(lngLat.lng);
  const y = earthRadius * Math.log(Math.tan(Math.PI / 4 + toRadians(lat) / 2));
  return { x, y };
};

const calculateAreaSquareMeters = (input: LngLat[]): number => {
  if (input.length < 3) return 0;

  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const curr = toMercatorMeters(input[i]);
    const next = toMercatorMeters(input[(i + 1) % input.length]);
    sum += curr.x * next.y - next.x * curr.y;
  }
  return Math.abs(sum) / 2;
};

const formatArea = (areaM2: number): string => {
  if (areaM2 < 1000000) {
    if (areaM2 < 100) return `${areaM2.toFixed(2)} m²`;
    if (areaM2 < 10000) return `${areaM2.toFixed(1)} m²`;
    return `${Math.round(areaM2)} m²`;
  }

  const km2 = areaM2 / 1000000;
  if (km2 < 10) return `${km2.toFixed(3)} km²`;
  if (km2 < 100) return `${km2.toFixed(2)} km²`;
  return `${km2.toFixed(1)} km²`;
};

const ensureDefaultVertices = (map: AreaMap): void => {
  if (editVertices.length >= 3) return;

  const center = map.getCenter();
  const centerPoint = map.project(center);
  const offsets = [
    { x: -120, y: 40 },
    { x: 0, y: -110 },
    { x: 120, y: 40 },
  ];
  editVertices = offsets.map((offset) =>
    map.unproject({
      x: centerPoint.x + offset.x,
      y: centerPoint.y + offset.y,
    }),
  );
};

const clearEdgeHitLines = (): void => {
  if (!edgeHitLayer) return;
  while (edgeHitLayer.firstChild)
    edgeHitLayer.removeChild(edgeHitLayer.firstChild);
};

const clearVertexElements = (): void => {
  for (const vertex of vertexElements) vertex.remove();
  vertexElements = [];
};

const syncVertexElements = (): void => {
  if (!container) return;

  while (vertexElements.length < editVertices.length) {
    const vertex = createVertexElement();
    vertexElements.push(vertex);
    container.appendChild(vertex);
  }

  while (vertexElements.length > editVertices.length) {
    const vertex = vertexElements.pop();
    vertex?.remove();
  }
};

const setVertexFromPointer = (map: AreaMap, event: PointerEvent): void => {
  if (activeDragIndex == null) return;

  const mapContainer = getMapContainer(map);
  if (!mapContainer) return;

  const rect = mapContainer.getBoundingClientRect();
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
  editVertices[activeDragIndex] = map.unproject({ x, y });
  renderAreaOverlay(map);
};

const stopVertexDrag = (): void => {
  if (!activeMap) return;

  activeMap.dragPan?.enable();

  if (pointerMoveHandler) {
    window.removeEventListener("pointermove", pointerMoveHandler);
    pointerMoveHandler = null;
  }
  if (pointerUpHandler) {
    window.removeEventListener("pointerup", pointerUpHandler);
    window.removeEventListener("pointercancel", pointerUpHandler);
    pointerUpHandler = null;
  }

  for (const vertex of vertexElements) vertex.style.cursor = "grab";
  activeDragIndex = null;
  renderAreaOverlay(activeMap);
};

const startVertexDrag = (
  map: AreaMap,
  index: number,
  event: PointerEvent,
): void => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (activeDragIndex !== null) stopVertexDrag();
  event.preventDefault();
  event.stopPropagation();

  activeMap = map;
  activeDragIndex = index;
  activeMap.dragPan?.disable();
  if (vertexElements[index]) vertexElements[index].style.cursor = "grabbing";

  pointerMoveHandler = (moveEvent) => {
    if (!activeMap) return;
    setVertexFromPointer(activeMap, moveEvent);
  };
  pointerUpHandler = () => stopVertexDrag();

  window.addEventListener("pointermove", pointerMoveHandler, { passive: true });
  window.addEventListener("pointerup", pointerUpHandler, { passive: true });
  window.addEventListener("pointercancel", pointerUpHandler, { passive: true });

  setVertexFromPointer(map, event);
};

const insertVertexOnEdge = (map: AreaMap, edgeIndex: number): void => {
  const current = map.project(editVertices[edgeIndex]);
  const next = map.project(editVertices[(edgeIndex + 1) % editVertices.length]);
  const midpoint = map.unproject({
    x: (current.x + next.x) / 2,
    y: (current.y + next.y) / 2,
  });

  editVertices.splice(edgeIndex + 1, 0, midpoint);
  renderAreaOverlay(map);
};

const createRegionPolygon = (
  map: AreaMap,
  region: AreaRegion,
): { polygon: SVGPolygonElement; center: ScreenPoint } | null => {
  if (region.vertices.length < 3) return null;
  const points = region.vertices.map((vertex) => map.project(vertex));
  if (points.length < 3) return null;

  const polygon = document.createElementNS(AREA_SVG_NS, "polygon");
  const color = normalizeHexColor(region.color);
  const rgb = hexToRgb(color) ?? { r: 15, g: 118, b: 110 };
  polygon.setAttribute(
    "points",
    points.map((point) => `${point.x},${point.y}`).join(" "),
  );
  polygon.setAttribute("fill", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`);
  polygon.setAttribute("stroke", color);
  polygon.setAttribute("stroke-width", "3");
  polygon.setAttribute("vector-effect", "non-scaling-stroke");
  polygon.style.pointerEvents = "none";

  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };

  return { polygon, center };
};

const clearEditingUI = (): void => {
  if (editPolygon) editPolygon.style.display = "none";
  if (areaLabel) areaLabel.style.display = "none";
  if (editActionLayer) editActionLayer.style.display = "none";
  clearEdgeHitLines();
  clearVertexElements();
};

const renderAreaOverlay = (map: AreaMap): void => {
  if (
    !svg ||
    !regionsLayer ||
    !edgeHitLayer ||
    !areaLabel ||
    !regionLabelLayer ||
    !container
  ) {
    return;
  }

  const mapContainer = getMapContainer(map);
  if (!mapContainer) return;

  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;
  svg.setAttribute(
    "viewBox",
    `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`,
  );

  while (regionsLayer.firstChild)
    regionsLayer.removeChild(regionsLayer.firstChild);
  while (regionLabelLayer.firstChild)
    regionLabelLayer.removeChild(regionLabelLayer.firstChild);

  for (const region of areaRegions) {
    if (!region.visible) continue;
    if (editMode && editingRegionId && region.id === editingRegionId) continue;

    const rendered = createRegionPolygon(map, region);
    if (!rendered) continue;

    regionsLayer.appendChild(rendered.polygon);

    const regionColor = normalizeHexColor(region.color);
    const textColor = getContrastTextColor(regionColor);

    const label = document.createElement("div");
    label.style.cssText = `
      position: absolute;
      transform: translate(-50%, -50%);
      border-radius: 9999px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
      pointer-events: none;
    `;
    label.style.background = regionColor;
    label.style.color = textColor;
    label.style.left = `${rendered.center.x}px`;
    label.style.top = `${rendered.center.y}px`;
    label.textContent = region.name;
    regionLabelLayer.appendChild(label);
  }

  if (!editMode || !editPolygon) {
    clearEditingUI();
    return;
  }

  ensureDefaultVertices(map);
  if (editVertices.length < 3) {
    clearEditingUI();
    return;
  }

  const points = editVertices.map((lngLat) => map.project(lngLat));
  const editingHex = normalizeHexColor(editingColor);
  const editingRgb = hexToRgb(editingHex) ?? { r: 15, g: 118, b: 110 };
  editPolygon.style.display = "block";
  editPolygon.setAttribute(
    "fill",
    `rgba(${editingRgb.r}, ${editingRgb.g}, ${editingRgb.b}, 0.2)`,
  );
  editPolygon.setAttribute(
    "stroke",
    `rgba(${editingRgb.r}, ${editingRgb.g}, ${editingRgb.b}, 0.95)`,
  );
  editPolygon.setAttribute(
    "points",
    points.map((point) => `${point.x},${point.y}`).join(" "),
  );

  syncVertexElements();
  for (let i = 0; i < vertexElements.length; i++) {
    const point = points[i];
    const vertex = vertexElements[i];
    vertex.style.background = editingHex;
    vertex.style.left = `${point.x}px`;
    vertex.style.top = `${point.y}px`;
    vertex.dataset.index = String(i);

    if (!(vertex as { _mrAreaEventsBound?: boolean })._mrAreaEventsBound) {
      const onPointerDown = (event: PointerEvent) => {
        const index = Number(vertex.dataset.index);
        if (!Number.isFinite(index)) return;
        startVertexDrag(map, index, event);
      };

      const onDoubleClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(vertex.dataset.index);
        if (!Number.isFinite(index)) return;
        if (editVertices.length <= 3) return;
        editVertices.splice(index, 1);
        renderAreaOverlay(map);
      };

      vertex.addEventListener("pointerdown", onPointerDown);
      vertex.addEventListener("dblclick", onDoubleClick);
      (vertex as { _mrAreaEventsBound?: boolean })._mrAreaEventsBound = true;
    }
  }

  clearEdgeHitLines();
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;

    const hit = document.createElement("div");
    hit.style.cssText = `
      position: absolute;
      left: ${current.x}px;
      top: ${current.y}px;
      width: ${length}px;
      height: 14px;
      transform-origin: 0 50%;
      transform: translateY(-50%) rotate(${Math.atan2(dy, dx)}rad);
      pointer-events: auto;
      cursor: copy;
      background: rgba(0, 0, 0, 0);
    `;
    hit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      insertVertexOnEdge(map, i);
    });
    edgeHitLayer.appendChild(hit);
  }

  const area = calculateAreaSquareMeters(editVertices);
  areaLabel.textContent = formatArea(area);
  areaLabel.style.display = "block";

  const centerX =
    points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const centerY =
    points.reduce((sum, point) => sum + point.y, 0) / points.length;
  areaLabel.style.left = `${centerX}px`;
  areaLabel.style.top = `${centerY}px`;

  if (editActionLayer) {
    editActionLayer.style.display = "flex";
    editActionLayer.style.left = `${centerX}px`;
    editActionLayer.style.top = `${centerY + 28}px`;
  }
};

const addAreaOverlay = (map: AreaMap): void => {
  if (container) return;

  const mapContainer = getMapContainer(map);
  if (!mapContainer) {
    console.warn("🧑‍🎨 : Map container not found for area measure");
    return;
  }

  const existing = document.getElementById(AREA_CONTAINER_ID);
  if (existing) existing.remove();

  container = createOverlay();
  mapContainer.appendChild(container);

  mapUpdateHandler = () => renderAreaOverlay(map);
  for (const eventName of MAP_UPDATE_EVENTS)
    map.on(eventName, mapUpdateHandler);

  renderAreaOverlay(map);
  console.log("🧑‍🎨 : Area measure added");
};

const removeAreaOverlay = (map: AreaMap): void => {
  if (mapUpdateHandler) {
    for (const eventName of MAP_UPDATE_EVENTS)
      map.off(eventName, mapUpdateHandler);
    mapUpdateHandler = null;
  }

  stopVertexDrag();
  clearVertexElements();

  container?.remove();
  container = null;
  svg = null;
  regionsLayer = null;
  editPolygon = null;
  edgeHitLayer = null;
  areaLabel = null;
  regionLabelLayer = null;
  editActionLayer = null;
  saveEditButton = null;
  cancelEditButton = null;
  activeMap = null;
  activeDragIndex = null;

  console.log("🧑‍🎨 : Area measure removed");
};

const getCurrentEditSnapshot = (): AreaRegionEditSnapshot | null => {
  if (!editMode || editVertices.length < 3) return null;
  return {
    regionId: editingRegionId,
    name: editingRegionName,
    vertices: cloneVertices(editVertices),
  };
};

export const setAreaRegions = (regions: AreaRegion[]): void => {
  areaRegions = Array.isArray(regions)
    ? regions
        .map((region) => {
          if (!region || typeof region !== "object") return null;
          const vertices = sanitizeVertices(
            (region as { vertices?: unknown }).vertices,
          );
          if (vertices.length < 3) return null;

          return {
            id: String((region as { id?: unknown }).id ?? ""),
            name: String((region as { name?: unknown }).name ?? ""),
            color: normalizeHexColor((region as { color?: unknown }).color),
            visible:
              typeof (region as { visible?: unknown }).visible === "boolean"
                ? Boolean((region as { visible?: unknown }).visible)
                : true,
            createdAt: Number(
              (region as { createdAt?: unknown }).createdAt ?? 0,
            ),
            updatedAt: Number(
              (region as { updatedAt?: unknown }).updatedAt ?? 0,
            ),
            vertices,
          } satisfies AreaRegion;
        })
        .filter((region): region is AreaRegion => Boolean(region))
    : [];

  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (map && areaEnabled) renderAreaOverlay(map);

  console.log("🧑‍🎨 : Area regions synced:", areaRegions.length);
};

export const startAreaRegionEdit = (
  payload: AreaRegionEditStartPayload = {},
): void => {
  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for area edit");
    return;
  }

  if (!areaEnabled) {
    setAreaMeasureEnabled(true);
  }

  editMode = true;
  editingRegionId = payload.regionId ?? null;
  editingRegionName = payload.name?.trim() || "";
  editingColor = normalizeHexColor(payload.color);
  editingSaveLabel = payload.saveLabel?.trim() || "Save";
  editingCancelLabel = payload.cancelLabel?.trim() || "Cancel";
  if (saveEditButton) saveEditButton.textContent = editingSaveLabel;
  if (cancelEditButton) cancelEditButton.textContent = editingCancelLabel;
  editVertices = sanitizeVertices(payload.vertices);
  ensureDefaultVertices(map);
  renderAreaOverlay(map);

  console.log("🧑‍🎨 : Area edit started", {
    regionId: editingRegionId,
    points: editVertices.length,
  });
};

export const stopAreaRegionEdit = (): void => {
  stopVertexDrag();
  editMode = false;
  editingRegionId = null;
  editingRegionName = "";
  editingColor = "#0f766e";
  editVertices = [];

  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (map && areaEnabled) renderAreaOverlay(map);

  console.log("🧑‍🎨 : Area edit stopped");
};

export const respondAreaRegionEditRequest = (data: {
  requestId?: string;
}): void => {
  if (!data.requestId) return;

  window.postMessage(
    {
      source: "mr-wplace-area-region-edit-response",
      requestId: data.requestId,
      result: getCurrentEditSnapshot(),
    },
    "*",
  );
};

export const setAreaMeasureEnabled = (enabled: boolean): void => {
  areaEnabled = enabled;
  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for area measure");
    return;
  }

  if (enabled) addAreaOverlay(map);
  else removeAreaOverlay(map);

  console.log("🧑‍🎨 : Area measure enabled:", enabled);
};

export const setupAreaMeasureOnMapReady = (mapInstance: unknown): void => {
  const map = mapInstance as AreaMap;
  const onStyleData = () => {
    if (!areaEnabled) return;
    renderAreaOverlay(map);
  };
  map.on("styledata", onStyleData);
  if (areaEnabled) addAreaOverlay(map);

  console.log("🧑‍🎨 : Area measure listener setup complete");
};
