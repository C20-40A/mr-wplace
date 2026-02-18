import type {
  AreaDisplayOptions,
  AreaNameDisplayMode,
  AreaRegion,
  AreaRegionEditSnapshot,
  AreaRegionVertex,
} from "@/types/area-region";
import { AREA_MESSAGE_SOURCE } from "@/constants/area-message";
import { getMapInstanceFromWplace } from "./map-instance";
import {
  calculateGeodesicAreaSquareMeters,
  calculatePixelAreaSquare,
} from "@/utils/coordinate";
import {
  DEFAULT_AREA_COLOR,
  DEFAULT_AREA_NAME_DISPLAY_MODE,
  formatPixelArea,
  normalizeAreaColor,
  normalizeAreaNameDisplayMode,
} from "@/utils/area-region";

const AREA_CONTAINER_ID = "mr-wplace-area-measure";
const AREA_SVG_NS = "http://www.w3.org/2000/svg";
const MAP_UPDATE_EVENTS = ["move", "zoom", "rotate", "pitch", "resize"];
const DEFAULT_AREA_FILL_OPACITY = 0.14;
const AREA_REGION_SOURCE_ID = "mr-wplace-area-regions-source";
const AREA_REGION_FILL_LAYER_ID = "mr-wplace-area-regions-fill";
const AREA_REGION_LINE_LAYER_ID = "mr-wplace-area-regions-line";
const AREA_REGION_LABEL_LAYER_ID = "mr-wplace-area-regions-label";
const AREA_EDIT_SOURCE_ID = "mr-wplace-area-edit-source";
const AREA_EDIT_FILL_LAYER_ID = "mr-wplace-area-edit-fill";
const AREA_EDIT_LINE_LAYER_ID = "mr-wplace-area-edit-line";
const AREA_NAME_HIDE_ZOOM_THRESHOLD = 9;
const AREA_NAME_SCALE_START_ZOOM = 13;
const AREA_NAME_BASE_FONT_SIZE_PX = 14;
const AREA_NAME_MIN_FONT_SIZE_PX = 6;

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
  getZoom?: () => number;
  project: (lngLat: LngLat | [number, number]) => ScreenPoint;
  unproject: (point: ScreenPoint | [number, number]) => LngLat;
  getContainer?: () => HTMLElement;
  getLayer?: (id: string) => unknown;
  addLayer?: (layer: unknown, beforeId?: string) => void;
  removeLayer?: (id: string) => void;
  getSource?: (id: string) => unknown;
  addSource?: (id: string, source: unknown) => void;
  removeSource?: (id: string) => void;
  setPaintProperty?: (layer: string, property: string, value: unknown) => void;
  setLayoutProperty?: (
    layer: string,
    property: string,
    value: unknown,
  ) => void;
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
let editPolygon: SVGPolygonElement | null = null;
let edgeHitLayer: HTMLDivElement | null = null;
let areaLabel: HTMLDivElement | null = null;
let editActionLayer: HTMLDivElement | null = null;
let saveEditButton: HTMLButtonElement | null = null;
let cancelEditButton: HTMLButtonElement | null = null;

let areaRegions: AreaRegion[] = [];
let editMode = false;
let editingRegionId: string | null = null;
let editingRegionName = "";
let editingColor = DEFAULT_AREA_COLOR;
let areaFillOpacity = DEFAULT_AREA_FILL_OPACITY;
let areaNameDisplayMode: AreaNameDisplayMode = DEFAULT_AREA_NAME_DISPLAY_MODE;
let editingSaveLabel = "Save";
let editingCancelLabel = "Cancel";
let editVertices: LngLat[] = [];
let vertexElements: HTMLDivElement[] = [];

let activeMap: AreaMap | null = null;
let activeDragIndex: number | null = null;
let mapUpdateHandler: (() => void) | null = null;
let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
let pointerUpHandler: (() => void) | null = null;
let cachedMapContainer: HTMLElement | null = null;
let pendingRenderMap: AreaMap | null = null;
let renderFrameId: number | null = null;

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

const normalizeFillOpacityPercent = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value))
    return DEFAULT_AREA_FILL_OPACITY;
  return Math.min(1, Math.max(0, value / 100));
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

const rgbToHex = (rgb: { r: number; g: number; b: number }): string => {
  const toHex = (value: number): string =>
    Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, "0");
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
};

const rgbToHsl = (rgb: {
  r: number;
  g: number;
  b: number;
}): { h: number; s: number; l: number } => {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta < Number.EPSILON) return { h: 0, s: 0, l };

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  return { h: h / 6, s, l };
};

const hslToRgb = (hsl: {
  h: number;
  s: number;
  l: number;
}): { r: number; g: number; b: number } => {
  const { h, s, l } = hsl;
  if (s < Number.EPSILON) {
    const gray = l * 255;
    return { r: gray, g: gray, b: gray };
  }

  const hueToRgb = (p: number, q: number, tRaw: number): number => {
    let t = tRaw;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hueToRgb(p, q, h + 1 / 3) * 255,
    g: hueToRgb(p, q, h) * 255,
    b: hueToRgb(p, q, h - 1 / 3) * 255,
  };
};

const getInvertedLightnessStrokeColor = (hexColor: string): string => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return "#333333";
  const hsl = rgbToHsl(rgb);
  const invertedLightness = 1 - hsl.l;
  const clampedLightness = Math.min(0.62, Math.max(0.18, invertedLightness));
  return rgbToHex(
    hslToRgb({
      h: hsl.h,
      s: hsl.s,
      l: clampedLightness,
    }),
  );
};

const getMapContainer = (map: AreaMap): HTMLElement | null => {
  const byApi = map.getContainer?.();
  if (byApi instanceof HTMLElement) return byApi;
  return (
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container")
  );
};

const resolveMapContainer = (map: AreaMap): HTMLElement | null => {
  if (cachedMapContainer?.isConnected) return cachedMapContainer;
  const nextContainer = getMapContainer(map);
  if (!nextContainer) return null;
  cachedMapContainer = nextContainer;
  return cachedMapContainer;
};

interface GeoJsonPolygonFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: {
      type: "Polygon";
      coordinates: number[][][];
    };
  }>;
}

const EMPTY_POLYGON_FEATURE_COLLECTION: GeoJsonPolygonFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const toClosedPolygonRing = (vertices: LngLat[]): number[][] | null => {
  if (vertices.length < 3) return null;
  const ring = vertices.map((vertex) => [vertex.lng, vertex.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
};

const getGeoJsonSource = (
  map: AreaMap,
  sourceId: string,
): { setData?: (data: unknown) => void } | null => {
  const source = map.getSource?.(sourceId);
  if (!source || typeof source !== "object") return null;
  return source as { setData?: (data: unknown) => void };
};

const ensureGeoJsonSource = (
  map: AreaMap,
  sourceId: string,
  data: GeoJsonPolygonFeatureCollection,
): void => {
  if (!map.addSource || !map.getSource) return;
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, {
    type: "geojson",
    data,
  });
};

const ensureAreaRegionLayers = (map: AreaMap): void => {
  ensureGeoJsonSource(map, AREA_REGION_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
  if (!map.addLayer || !map.getLayer) return;

  if (!map.getLayer(AREA_REGION_FILL_LAYER_ID)) {
    map.addLayer({
      id: AREA_REGION_FILL_LAYER_ID,
      type: "fill",
      source: AREA_REGION_SOURCE_ID,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": areaFillOpacity,
      },
    });
  }

  if (!map.getLayer(AREA_REGION_LINE_LAYER_ID)) {
    map.addLayer({
      id: AREA_REGION_LINE_LAYER_ID,
      type: "line",
      source: AREA_REGION_SOURCE_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }

  if (!map.getLayer(AREA_REGION_LABEL_LAYER_ID)) {
    map.addLayer({
      id: AREA_REGION_LABEL_LAYER_ID,
      type: "symbol",
      source: AREA_REGION_SOURCE_ID,
      layout: {
        "text-field": ["get", "name"],
        "text-size": AREA_NAME_BASE_FONT_SIZE_PX,
        "text-anchor": "center",
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": ["get", "labelStrokeColor"],
        "text-halo-width": 1.6,
        "text-halo-blur": 0.2,
      },
    });
  }
};

const ensureAreaEditLayers = (map: AreaMap): void => {
  ensureGeoJsonSource(map, AREA_EDIT_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
  if (!map.addLayer || !map.getLayer) return;

  if (!map.getLayer(AREA_EDIT_FILL_LAYER_ID)) {
    map.addLayer({
      id: AREA_EDIT_FILL_LAYER_ID,
      type: "fill",
      source: AREA_EDIT_SOURCE_ID,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.2,
      },
    });
  }

  if (!map.getLayer(AREA_EDIT_LINE_LAYER_ID)) {
    map.addLayer({
      id: AREA_EDIT_LINE_LAYER_ID,
      type: "line",
      source: AREA_EDIT_SOURCE_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }
};

const setGeoJsonSourceData = (
  map: AreaMap,
  sourceId: string,
  data: GeoJsonPolygonFeatureCollection,
): void => {
  const source = getGeoJsonSource(map, sourceId);
  source?.setData?.(data);
};

const buildAreaRegionFeatureCollection = (): GeoJsonPolygonFeatureCollection => {
  const features: GeoJsonPolygonFeatureCollection["features"] = [];

  for (const region of areaRegions) {
    if (!region.visible) continue;
    if (editMode && editingRegionId && region.id === editingRegionId) continue;
    const ring = toClosedPolygonRing(region.vertices);
    if (!ring) continue;
    const areaColor = normalizeAreaColor(region.color);
    features.push({
      type: "Feature",
      properties: {
        id: region.id,
        name: region.name,
        color: areaColor,
        labelStrokeColor: getInvertedLightnessStrokeColor(areaColor),
      },
      geometry: {
        type: "Polygon",
        coordinates: [ring],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
};

const applyAreaNameLayerStyle = (map: AreaMap): void => {
  if (!map.getLayer?.(AREA_REGION_LABEL_LAYER_ID)) return;
  if (!map.setLayoutProperty || !map.setPaintProperty) return;

  if (areaNameDisplayMode === "off") {
    map.setLayoutProperty(AREA_REGION_LABEL_LAYER_ID, "visibility", "none");
    return;
  }

  map.setLayoutProperty(AREA_REGION_LABEL_LAYER_ID, "visibility", "visible");

  if (areaNameDisplayMode === "always") {
    map.setLayoutProperty(
      AREA_REGION_LABEL_LAYER_ID,
      "text-size",
      AREA_NAME_BASE_FONT_SIZE_PX,
    );
    map.setPaintProperty(AREA_REGION_LABEL_LAYER_ID, "text-opacity", 1);
    return;
  }

  map.setLayoutProperty(AREA_REGION_LABEL_LAYER_ID, "text-size", [
    "interpolate",
    ["linear"],
    ["zoom"],
    AREA_NAME_HIDE_ZOOM_THRESHOLD,
    AREA_NAME_MIN_FONT_SIZE_PX,
    AREA_NAME_SCALE_START_ZOOM,
    AREA_NAME_BASE_FONT_SIZE_PX,
  ]);
  map.setPaintProperty(AREA_REGION_LABEL_LAYER_ID, "text-opacity", [
    "step",
    ["zoom"],
    0,
    AREA_NAME_HIDE_ZOOM_THRESHOLD,
    1,
  ]);
};

const syncAreaRegionLayerData = (map: AreaMap): void => {
  ensureAreaRegionLayers(map);
  setGeoJsonSourceData(map, AREA_REGION_SOURCE_ID, buildAreaRegionFeatureCollection());
  if (map.setPaintProperty && map.getLayer?.(AREA_REGION_FILL_LAYER_ID)) {
    map.setPaintProperty(AREA_REGION_FILL_LAYER_ID, "fill-opacity", areaFillOpacity);
  }
  applyAreaNameLayerStyle(map);
};

const syncAreaEditLayerData = (map: AreaMap): void => {
  ensureAreaEditLayers(map);
  if (!editMode || editVertices.length < 3) {
    setGeoJsonSourceData(map, AREA_EDIT_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
    return;
  }

  const ring = toClosedPolygonRing(editVertices);
  if (!ring) {
    setGeoJsonSourceData(map, AREA_EDIT_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
    return;
  }

  setGeoJsonSourceData(map, AREA_EDIT_SOURCE_ID, {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          color: normalizeAreaColor(editingColor),
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring],
        },
      },
    ],
  });
};

const safeRemoveLayer = (map: AreaMap, layerId: string): void => {
  if (!map.getLayer || !map.removeLayer) return;
  if (!map.getLayer(layerId)) return;
  map.removeLayer(layerId);
};

const safeRemoveSource = (map: AreaMap, sourceId: string): void => {
  if (!map.getSource || !map.removeSource) return;
  if (!map.getSource(sourceId)) return;
  map.removeSource(sourceId);
};

const removeAreaMapLayers = (map: AreaMap): void => {
  safeRemoveLayer(map, AREA_EDIT_LINE_LAYER_ID);
  safeRemoveLayer(map, AREA_EDIT_FILL_LAYER_ID);
  safeRemoveLayer(map, AREA_REGION_LABEL_LAYER_ID);
  safeRemoveLayer(map, AREA_REGION_LINE_LAYER_ID);
  safeRemoveLayer(map, AREA_REGION_FILL_LAYER_ID);
  safeRemoveSource(map, AREA_EDIT_SOURCE_ID);
  safeRemoveSource(map, AREA_REGION_SOURCE_ID);
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
    z-index: 10;
  `;

  const svgRoot = document.createElementNS(AREA_SVG_NS, "svg");
  svgRoot.setAttribute("width", "100%");
  svgRoot.setAttribute("height", "100%");
  svgRoot.setAttribute("viewBox", "0 0 1 1");
  svgRoot.style.pointerEvents = "none";

  const editingPolygon = document.createElementNS(AREA_SVG_NS, "polygon");
  editingPolygon.setAttribute("fill", "rgba(15, 118, 110, 0.2)");
  editingPolygon.setAttribute("stroke", "rgba(15, 118, 110, 0.95)");
  editingPolygon.setAttribute("stroke-width", "3");
  editingPolygon.setAttribute("vector-effect", "non-scaling-stroke");
  editingPolygon.style.pointerEvents = "none";
  editingPolygon.style.display = "none";

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
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    line-height: 1.3;
    text-align: center;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 3px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    z-index: 2;
    display: none;
  `;

  const actionLayer = document.createElement("div");
  actionLayer.style.cssText = `
    position: absolute;
    transform: translate(-50%, -50%);
    display: none;
    gap: 4px;
    z-index: 4;
    pointer-events: auto;
  `;

  const saveButton = document.createElement("button");
  saveButton.style.cssText = `
    background: #0f766e;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  `;
  saveButton.textContent = editingSaveLabel;
  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.postMessage({ source: AREA_MESSAGE_SOURCE.REGION_SAVE_CLICK }, "*");
  });

  const cancelButton = document.createElement("button");
  cancelButton.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  `;
  cancelButton.innerHTML = "✕";
  cancelButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.postMessage({ source: AREA_MESSAGE_SOURCE.REGION_CANCEL_CLICK }, "*");
  });

  actionLayer.appendChild(saveButton);
  actionLayer.appendChild(cancelButton);

  root.appendChild(svgRoot);
  root.appendChild(hitLayer);
  root.appendChild(label);
  root.appendChild(actionLayer);

  svg = svgRoot;
  editPolygon = editingPolygon;
  edgeHitLayer = hitLayer;
  areaLabel = label;
  editActionLayer = actionLayer;
  saveEditButton = saveButton;
  cancelEditButton = cancelButton;

  return root;
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
  edgeHitLayer.replaceChildren();
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

  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) return;

  const rect = mapContainer.getBoundingClientRect();
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
  editVertices[activeDragIndex] = map.unproject({ x, y });
  renderEditingOverlay(map);
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
  if (areaEnabled) scheduleAreaOverlayRender(activeMap);
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
  renderEditingOverlay(map);
};

const clearEditingUI = (): void => {
  if (editPolygon) editPolygon.style.display = "none";
  if (areaLabel) areaLabel.style.display = "none";
  if (editActionLayer) editActionLayer.style.display = "none";
  clearEdgeHitLines();
  clearVertexElements();
};

const renderRegionLayer = (map: AreaMap): void => {
  syncAreaRegionLayerData(map);
};

const renderEditingOverlay = (map: AreaMap): void => {
  if (!edgeHitLayer || !areaLabel || !container) return;
  if (!editMode) {
    syncAreaEditLayerData(map);
    clearEditingUI();
    return;
  }

  ensureDefaultVertices(map);
  if (editVertices.length < 3) {
    syncAreaEditLayerData(map);
    clearEditingUI();
    return;
  }

  syncAreaEditLayerData(map);
  const points = editVertices.map((lngLat) => map.project(lngLat));
  const editingHex = normalizeAreaColor(editingColor);
  if (editPolygon) editPolygon.style.display = "none";

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
        renderEditingOverlay(map);
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
      touch-action: none;
      cursor: copy;
      background: rgba(0, 0, 0, 0);
    `;
    hit.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      insertVertexOnEdge(map, i);
    });
    edgeHitLayer.appendChild(hit);
  }

  const area = calculateGeodesicAreaSquareMeters(editVertices);
  const pixelArea = calculatePixelAreaSquare(editVertices);
  areaLabel.innerHTML = `${formatArea(area)}<br><span style="font-size: 10px; opacity: 0.8;">${formatPixelArea(pixelArea)}</span>`;
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
    editActionLayer.style.top = `${centerY + 26}px`;
  }
};

const renderAreaOverlayNow = (map: AreaMap): void => {
  if (!svg || !edgeHitLayer || !areaLabel || !container) {
    return;
  }

  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) return;

  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;
  svg.setAttribute(
    "viewBox",
    `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`,
  );

  renderRegionLayer(map);
  renderEditingOverlay(map);
};

const cancelAreaOverlayRender = (): void => {
  if (renderFrameId !== null) {
    window.cancelAnimationFrame(renderFrameId);
    renderFrameId = null;
  }
  pendingRenderMap = null;
};

const scheduleAreaOverlayRender = (map: AreaMap): void => {
  pendingRenderMap = map;
  if (renderFrameId !== null) return;

  renderFrameId = window.requestAnimationFrame(() => {
    renderFrameId = null;
    const nextMap = pendingRenderMap;
    pendingRenderMap = null;
    if (!nextMap || !areaEnabled) return;
    renderAreaOverlayNow(nextMap);
  });
};

const addAreaOverlay = (map: AreaMap): void => {
  if (container) return;

  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) {
    console.warn("🧑‍🎨 : Map container not found for area measure");
    return;
  }

  const existing = document.getElementById(AREA_CONTAINER_ID);
  if (existing) existing.remove();

  container = createOverlay();
  mapContainer.appendChild(container);
  cachedMapContainer = mapContainer;

  mapUpdateHandler = () => scheduleAreaOverlayRender(map);
  for (const eventName of MAP_UPDATE_EVENTS)
    map.on(eventName, mapUpdateHandler);

  scheduleAreaOverlayRender(map);
  console.log("🧑‍🎨 : Area measure added");
};

const removeAreaOverlay = (map: AreaMap): void => {
  cancelAreaOverlayRender();

  if (mapUpdateHandler) {
    for (const eventName of MAP_UPDATE_EVENTS)
      map.off(eventName, mapUpdateHandler);
    mapUpdateHandler = null;
  }

  stopVertexDrag();
  clearVertexElements();
  removeAreaMapLayers(map);

  container?.remove();
  container = null;
  svg = null;
  editPolygon = null;
  edgeHitLayer = null;
  areaLabel = null;
  editActionLayer = null;
  saveEditButton = null;
  cancelEditButton = null;
  activeMap = null;
  activeDragIndex = null;
  cachedMapContainer = null;

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
            color: normalizeAreaColor((region as { color?: unknown }).color),
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
  if (map && areaEnabled) scheduleAreaOverlayRender(map);

  console.log("🧑‍🎨 : Area regions synced:", areaRegions.length);
};

export const setAreaDisplayOptions = (
  options: Partial<AreaDisplayOptions> = {},
): void => {
  if ("fillOpacityPercent" in options) {
    areaFillOpacity = normalizeFillOpacityPercent(options.fillOpacityPercent);
  }
  if ("nameDisplayMode" in options) {
    areaNameDisplayMode = normalizeAreaNameDisplayMode(options.nameDisplayMode);
  }
  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (map && areaEnabled) scheduleAreaOverlayRender(map);

  console.log("🧑‍🎨 : Area display options updated", {
    opacity: areaFillOpacity,
    nameDisplayMode: areaNameDisplayMode,
  });
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
  editingColor = normalizeAreaColor(payload.color);
  editingSaveLabel = payload.saveLabel?.trim() || "Save";
  editingCancelLabel = payload.cancelLabel?.trim() || "Cancel";
  if (saveEditButton) saveEditButton.textContent = editingSaveLabel;
  if (cancelEditButton) cancelEditButton.textContent = editingCancelLabel;
  editVertices = sanitizeVertices(payload.vertices);
  ensureDefaultVertices(map);
  scheduleAreaOverlayRender(map);

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
  editingColor = DEFAULT_AREA_COLOR;
  editVertices = [];

  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (map && areaEnabled) scheduleAreaOverlayRender(map);

  console.log("🧑‍🎨 : Area edit stopped");
};

export const respondAreaRegionEditRequest = (data: {
  requestId?: string;
}): void => {
  if (!data.requestId) return;

  window.postMessage(
    {
      source: AREA_MESSAGE_SOURCE.REGION_EDIT_RESPONSE,
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
    scheduleAreaOverlayRender(map);
  };
  map.on("styledata", onStyleData);
  if (areaEnabled) addAreaOverlay(map);

  console.log("🧑‍🎨 : Area measure listener setup complete");
};
