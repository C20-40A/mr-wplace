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

let areaEnabled = false;

let container: HTMLDivElement | null = null;
let svg: SVGSVGElement | null = null;
let polygon: SVGPolygonElement | null = null;
let edgeHitGroup: SVGGElement | null = null;
let areaLabel: HTMLDivElement | null = null;

let vertices: LngLat[] = [];
let vertexElements: HTMLDivElement[] = [];

let activeMap: AreaMap | null = null;
let activeDragIndex: number | null = null;
let mapUpdateHandler: (() => void) | null = null;
let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
let pointerUpHandler: (() => void) | null = null;

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
    background: #16a34a;
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
    z-index: 649;
  `;

  const svgRoot = document.createElementNS(AREA_SVG_NS, "svg");
  svgRoot.setAttribute("width", "100%");
  svgRoot.setAttribute("height", "100%");
  svgRoot.setAttribute("viewBox", "0 0 1 1");
  svgRoot.style.pointerEvents = "auto";

  const polygonShape = document.createElementNS(AREA_SVG_NS, "polygon");
  polygonShape.setAttribute("fill", "rgba(34, 197, 94, 0.18)");
  polygonShape.setAttribute("stroke", "rgba(34, 197, 94, 0.95)");
  polygonShape.setAttribute("stroke-width", "2");
  polygonShape.setAttribute("vector-effect", "non-scaling-stroke");
  polygonShape.style.pointerEvents = "none";

  const hitGroup = document.createElementNS(AREA_SVG_NS, "g");

  svgRoot.appendChild(polygonShape);
  svgRoot.appendChild(hitGroup);

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
  `;

  root.appendChild(svgRoot);
  root.appendChild(label);

  svg = svgRoot;
  polygon = polygonShape;
  edgeHitGroup = hitGroup;
  areaLabel = label;

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
  if (vertices.length >= 3) return;

  const center = map.getCenter();
  const centerPoint = map.project(center);
  const offsets = [
    { x: -120, y: 40 },
    { x: 0, y: -110 },
    { x: 120, y: 40 },
  ];
  vertices = offsets.map((offset) =>
    map.unproject({
      x: centerPoint.x + offset.x,
      y: centerPoint.y + offset.y,
    }),
  );
};

const clearEdgeHitLines = (): void => {
  if (!edgeHitGroup) return;
  while (edgeHitGroup.firstChild) edgeHitGroup.removeChild(edgeHitGroup.firstChild);
};

const syncVertexElements = (): void => {
  if (!container) return;

  while (vertexElements.length < vertices.length) {
    const vertex = createVertexElement();
    vertexElements.push(vertex);
    container.appendChild(vertex);
  }

  while (vertexElements.length > vertices.length) {
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
  vertices[activeDragIndex] = map.unproject({ x, y });
  renderAreaOverlay(map);
};

const stopVertexDrag = (): void => {
  if (!activeMap) return;

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
  activeMap.dragPan?.enable();
  activeDragIndex = null;
  renderAreaOverlay(activeMap);
};

const startVertexDrag = (map: AreaMap, index: number, event: PointerEvent): void => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (activeDragIndex !== null) stopVertexDrag();
  event.preventDefault();
  event.stopPropagation();

  activeMap = map;
  activeDragIndex = index;
  map.dragPan?.disable();
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
  const current = map.project(vertices[edgeIndex]);
  const next = map.project(vertices[(edgeIndex + 1) % vertices.length]);
  const midpoint = map.unproject({
    x: (current.x + next.x) / 2,
    y: (current.y + next.y) / 2,
  });

  vertices.splice(edgeIndex + 1, 0, midpoint);
  renderAreaOverlay(map);
};

const renderAreaOverlay = (map: AreaMap): void => {
  if (!svg || !polygon || !edgeHitGroup || !areaLabel || !container) return;
  if (vertices.length < 3) return;

  const mapContainer = getMapContainer(map);
  if (!mapContainer) return;

  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`);

  const points = vertices.map((lngLat) => map.project(lngLat));
  polygon.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));

  syncVertexElements();
  for (let i = 0; i < vertexElements.length; i++) {
    const point = points[i];
    const vertex = vertexElements[i];
    vertex.style.left = `${point.x}px`;
    vertex.style.top = `${point.y}px`;
    vertex.dataset.index = String(i);
    if (!(vertex as any)._mrAreaEventsBound) {
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
        if (vertices.length <= 3) return;
        vertices.splice(index, 1);
        renderAreaOverlay(map);
      };
      vertex.addEventListener("pointerdown", onPointerDown);
      vertex.addEventListener("dblclick", onDoubleClick);
      (vertex as any)._mrAreaEventsBound = true;
    }
  }

  clearEdgeHitLines();
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    const hit = document.createElementNS(AREA_SVG_NS, "line");
    hit.setAttribute("x1", String(current.x));
    hit.setAttribute("y1", String(current.y));
    hit.setAttribute("x2", String(next.x));
    hit.setAttribute("y2", String(next.y));
    hit.setAttribute("stroke", "rgba(0,0,0,0)");
    hit.setAttribute("stroke-width", "18");
    hit.style.pointerEvents = "stroke";
    hit.style.cursor = "copy";
    hit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      insertVertexOnEdge(map, i);
    });
    edgeHitGroup.appendChild(hit);
  }

  const area = calculateAreaSquareMeters(vertices);
  areaLabel.textContent = `${formatArea(area)} (${vertices.length} pts)`;

  const centerX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const centerY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  areaLabel.style.left = `${centerX}px`;
  areaLabel.style.top = `${centerY}px`;
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

  ensureDefaultVertices(map);

  mapUpdateHandler = () => renderAreaOverlay(map);
  for (const eventName of MAP_UPDATE_EVENTS) map.on(eventName, mapUpdateHandler);

  renderAreaOverlay(map);
  console.log("🧑‍🎨 : Area measure added");
};

const removeAreaOverlay = (map: AreaMap): void => {
  if (mapUpdateHandler) {
    for (const eventName of MAP_UPDATE_EVENTS) map.off(eventName, mapUpdateHandler);
    mapUpdateHandler = null;
  }

  stopVertexDrag();

  for (const vertex of vertexElements) vertex.remove();
  vertexElements = [];

  container?.remove();
  container = null;
  svg = null;
  polygon = null;
  edgeHitGroup = null;
  areaLabel = null;
  activeMap = null;
  activeDragIndex = null;

  console.log("🧑‍🎨 : Area measure removed");
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
