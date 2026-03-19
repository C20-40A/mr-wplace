export interface LngLat {
  lng: number;
  lat: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface AreaMap {
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
  setLayoutProperty?: (layer: string, property: string, value: unknown) => void;
  addImage?: (
    id: string,
    image: ImageData | { width: number; height: number; data: Uint8Array },
    options?: Record<string, unknown>,
  ) => void;
  hasImage?: (id: string) => boolean;
  on: (event: string, handler: () => void) => void;
  off: (event: string, handler: () => void) => void;
  dragPan?: {
    disable: () => void;
    enable: () => void;
  };
}

export interface AreaRegionEditStartPayload {
  regionId?: string | null;
  name?: string;
  color?: string;
  vertices?: { lng: number; lat: number }[];
  saveLabel?: string;
  cancelLabel?: string;
}

export const AREA_CONTAINER_ID = "mr-wplace-area-measure";
export const AREA_SVG_NS = "http://www.w3.org/2000/svg";
export const MAP_UPDATE_EVENTS = ["move", "zoom", "rotate", "pitch", "resize"];
export const DEFAULT_AREA_FILL_OPACITY = 0.14;
export const AREA_REGION_SYNC_BATCH_SIZE = 160;
export const AREA_REGION_SYNC_TIME_BUDGET_MS = 6;
export const AREA_REGION_RENDER_COMMIT_STEP = 640;
export const AREA_REGION_BEST_EFFORT_MAX = 2500;
