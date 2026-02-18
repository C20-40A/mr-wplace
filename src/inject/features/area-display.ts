import { getMapInstanceFromWplace } from "./map-instance";
import { latLonToPixels } from "@/utils/geo-converter";

const SCALE_CONTAINER_ID = "mr-wplace-scale-display";
const SCALE_LINE_ID = "mr-wplace-scale-line";
const SCALE_LABEL_ID = "mr-wplace-scale-label";
const SCALE_PIN_A_ID = "mr-wplace-scale-pin-a";
const SCALE_PIN_B_ID = "mr-wplace-scale-pin-b";
const DEFAULT_PIN_OFFSET_PX = 140;
const MAP_UPDATE_EVENTS = ["move", "zoom", "rotate", "pitch", "resize"];

interface LngLat {
  lng: number;
  lat: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface ScaleMap {
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

type DragTarget = "A" | "B" | null;

let scaleEnabled = false;

let scaleContainer: HTMLDivElement | null = null;
let scaleLine: HTMLDivElement | null = null;
let scaleLabel: HTMLDivElement | null = null;
let pinAElement: HTMLDivElement | null = null;
let pinBElement: HTMLDivElement | null = null;

let pinALngLat: LngLat | null = null;
let pinBLngLat: LngLat | null = null;

let activeMap: ScaleMap | null = null;
let activeDragTarget: DragTarget = null;

let mapUpdateHandler: (() => void) | null = null;
let pinAPointerDownHandler: ((e: PointerEvent) => void) | null = null;
let pinBPointerDownHandler: ((e: PointerEvent) => void) | null = null;
let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
let pointerUpHandler: (() => void) | null = null;

const isValidLngLat = (value: unknown): value is LngLat => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.lng === "number" &&
    Number.isFinite(candidate.lng) &&
    typeof candidate.lat === "number" &&
    Number.isFinite(candidate.lat)
  );
};

const getMapContainer = (map: ScaleMap): HTMLElement | null => {
  const byApi = map.getContainer?.();
  if (byApi instanceof HTMLElement) return byApi;

  return (
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container")
  );
};

const createPinElement = (id: string, label: string, color: string): HTMLDivElement => {
  const pin = document.createElement("div");
  pin.id = id;
  pin.style.cssText = `
    position: absolute;
    width: 24px;
    height: 24px;
    transform: translate(-50%, -100%);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    cursor: grab;
    pointer-events: auto;
    user-select: none;
    touch-action: none;
    z-index: 2;
  `;

  const body = document.createElement("div");
  body.style.cssText = `
    width: 18px;
    height: 18px;
    border-radius: 50% 50% 50% 0;
    background: ${color};
    border: 2px solid #fff;
    transform: rotate(-45deg);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const text = document.createElement("span");
  text.textContent = label;
  text.style.cssText = `
    transform: rotate(45deg);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 10px;
    font-weight: 700;
  `;

  body.appendChild(text);
  pin.appendChild(body);
  return pin;
};

const createScaleContainer = (): HTMLDivElement => {
  const container = document.createElement("div");
  container.id = SCALE_CONTAINER_ID;
  container.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 650;
  `;

  const line = document.createElement("div");
  line.id = SCALE_LINE_ID;
  line.style.cssText = `
    position: absolute;
    height: 2px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(33, 33, 33, 0.65);
    transform-origin: 0 50%;
    box-sizing: border-box;
  `;

  const label = document.createElement("div");
  label.id = SCALE_LABEL_ID;
  label.style.cssText = `
    position: absolute;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.82);
    color: #fff;
    border-radius: 12px;
    padding: 4px 10px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    line-height: 1.3;
    text-align: center;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    pointer-events: none;
    z-index: 1;
  `;

  const pinA = createPinElement(SCALE_PIN_A_ID, "A", "#e74c3c");
  const pinB = createPinElement(SCALE_PIN_B_ID, "B", "#2980b9");

  container.appendChild(line);
  container.appendChild(label);
  container.appendChild(pinA);
  container.appendChild(pinB);

  scaleLine = line;
  scaleLabel = label;
  pinAElement = pinA;
  pinBElement = pinB;
  return container;
};

const getDefaultPins = (map: ScaleMap): { pinA: LngLat; pinB: LngLat } => {
  const center = map.getCenter();
  const centerPoint = map.project(center);
  const pinA = map.unproject({
    x: centerPoint.x - DEFAULT_PIN_OFFSET_PX,
    y: centerPoint.y,
  });
  const pinB = map.unproject({
    x: centerPoint.x + DEFAULT_PIN_OFFSET_PX,
    y: centerPoint.y,
  });
  return { pinA, pinB };
};

const toRadians = (value: number): number => (value * Math.PI) / 180;

const getDistanceMeters = (a: LngLat, b: LngLat): number => {
  const earthRadiusMeters = 6371008.8;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const haversine =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusMeters * centralAngle;
};

const formatDistance = (distanceMeters: number): string => {
  if (distanceMeters < 1000) {
    if (distanceMeters < 10) return `${distanceMeters.toFixed(2)} m`;
    if (distanceMeters < 100) return `${distanceMeters.toFixed(1)} m`;
    return `${Math.round(distanceMeters)} m`;
  }

  const km = distanceMeters / 1000;
  if (km < 10) return `${km.toFixed(2)} km`;
  if (km < 100) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

const applyPinScreenPosition = (
  pinElement: HTMLDivElement,
  map: ScaleMap,
  lngLat: LngLat,
): ScreenPoint => {
  const point = map.project(lngLat);
  pinElement.style.left = `${point.x}px`;
  pinElement.style.top = `${point.y}px`;
  return point;
};

const updateScaleDisplay = (map: ScaleMap): void => {
  if (
    !scaleLine ||
    !scaleLabel ||
    !pinAElement ||
    !pinBElement ||
    !pinALngLat ||
    !pinBLngLat
  ) {
    return;
  }

  const pointA = applyPinScreenPosition(pinAElement, map, pinALngLat);
  const pointB = applyPinScreenPosition(pinBElement, map, pinBLngLat);

  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const length = Math.hypot(dx, dy);

  scaleLine.style.left = `${pointA.x}px`;
  scaleLine.style.top = `${pointA.y}px`;
  scaleLine.style.width = `${Math.max(length, 1)}px`;
  scaleLine.style.transform = `translateY(-50%) rotate(${Math.atan2(dy, dx)}rad)`;

  // Calculate pixel distance
  const [px1, py1] = latLonToPixels(pinALngLat.lat, pinALngLat.lng);
  const [px2, py2] = latLonToPixels(pinBLngLat.lat, pinBLngLat.lng);
  const pixelDistance = Math.round(Math.hypot(px2 - px1, py2 - py1));

  const distanceText = formatDistance(getDistanceMeters(pinALngLat, pinBLngLat));
  scaleLabel.innerHTML = `${distanceText}<br><span style="font-size: 10px; opacity: 0.85;">${pixelDistance} px</span>`;
  scaleLabel.style.left = `${(pointA.x + pointB.x) / 2}px`;
  scaleLabel.style.top = `${(pointA.y + pointB.y) / 2 - 12}px`;
};

const setPinFromPointer = (map: ScaleMap, event: PointerEvent): void => {
  if (!activeDragTarget) return;

  const mapContainer = getMapContainer(map);
  if (!mapContainer) return;

  const rect = mapContainer.getBoundingClientRect();
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
  const lngLat = map.unproject({ x, y });

  if (activeDragTarget === "A") pinALngLat = lngLat;
  if (activeDragTarget === "B") pinBLngLat = lngLat;
  updateScaleDisplay(map);
};

const stopDragging = (): void => {
  if (!activeMap) return;

  pinAElement?.style.setProperty("cursor", "grab");
  pinBElement?.style.setProperty("cursor", "grab");
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

  activeDragTarget = null;
  updateScaleDisplay(activeMap);
};

const startDragging = (
  map: ScaleMap,
  target: Exclude<DragTarget, null>,
  event: PointerEvent,
): void => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (activeDragTarget) stopDragging();
  event.preventDefault();

  activeMap = map;
  activeDragTarget = target;
  map.dragPan?.disable();

  if (target === "A") pinAElement?.style.setProperty("cursor", "grabbing");
  if (target === "B") pinBElement?.style.setProperty("cursor", "grabbing");

  pointerMoveHandler = (moveEvent) => {
    if (!activeMap) return;
    setPinFromPointer(activeMap, moveEvent);
  };
  pointerUpHandler = () => stopDragging();

  window.addEventListener("pointermove", pointerMoveHandler, { passive: true });
  window.addEventListener("pointerup", pointerUpHandler, { passive: true });
  window.addEventListener("pointercancel", pointerUpHandler, { passive: true });

  setPinFromPointer(map, event);
};

const addScaleDisplay = (map: ScaleMap): void => {
  if (scaleContainer) return;

  const mapContainer = getMapContainer(map);
  if (!mapContainer) {
    console.warn("🧑‍🎨 : Map container not found for scale display");
    return;
  }

  const existingContainer = document.getElementById(SCALE_CONTAINER_ID);
  if (existingContainer) existingContainer.remove();

  scaleContainer = createScaleContainer();
  mapContainer.appendChild(scaleContainer);

  const defaultPins = getDefaultPins(map);
  if (!isValidLngLat(pinALngLat)) pinALngLat = defaultPins.pinA;
  if (!isValidLngLat(pinBLngLat)) pinBLngLat = defaultPins.pinB;

  pinAPointerDownHandler = (event) => startDragging(map, "A", event);
  pinBPointerDownHandler = (event) => startDragging(map, "B", event);
  pinAElement?.addEventListener("pointerdown", pinAPointerDownHandler);
  pinBElement?.addEventListener("pointerdown", pinBPointerDownHandler);

  mapUpdateHandler = () => updateScaleDisplay(map);
  for (const eventName of MAP_UPDATE_EVENTS) map.on(eventName, mapUpdateHandler);

  updateScaleDisplay(map);
  console.log("🧑‍🎨 : Scale display added (2 draggable pins)");
};

const removeScaleDisplay = (map: ScaleMap): void => {
  if (mapUpdateHandler) {
    for (const eventName of MAP_UPDATE_EVENTS) map.off(eventName, mapUpdateHandler);
    mapUpdateHandler = null;
  }

  stopDragging();

  if (pinAPointerDownHandler && pinAElement) {
    pinAElement.removeEventListener("pointerdown", pinAPointerDownHandler);
  }
  if (pinBPointerDownHandler && pinBElement) {
    pinBElement.removeEventListener("pointerdown", pinBPointerDownHandler);
  }
  pinAPointerDownHandler = null;
  pinBPointerDownHandler = null;

  scaleContainer?.remove();
  scaleContainer = null;
  scaleLine = null;
  scaleLabel = null;
  pinAElement = null;
  pinBElement = null;
  pinALngLat = null;
  pinBLngLat = null;
  activeMap = null;
  activeDragTarget = null;

  console.log("🧑‍🎨 : Scale display removed");
};

export const setScaleDisplayEnabled = (enabled: boolean): void => {
  scaleEnabled = enabled;
  const map = getMapInstanceFromWplace() as ScaleMap | null;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for scale display");
    return;
  }

  if (enabled) addScaleDisplay(map);
  else removeScaleDisplay(map);

  console.log("🧑‍🎨 : Scale display enabled:", enabled);
};

export const setupScaleDisplayOnMapReady = (mapInstance: unknown): void => {
  const map = mapInstance as ScaleMap;

  const onStyleData = () => {
    if (!scaleEnabled) return;
    updateScaleDisplay(map);
  };

  map.on("styledata", onStyleData);
  if (scaleEnabled) addScaleDisplay(map);

  console.log("🧑‍🎨 : Scale display listener setup complete");
};
