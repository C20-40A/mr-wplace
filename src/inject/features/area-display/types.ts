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

export interface GeoJsonPolygonFeatureCollection {
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

export const AREA_CONTAINER_ID = "mr-wplace-area-measure";
export const AREA_SVG_NS = "http://www.w3.org/2000/svg";
export const MAP_UPDATE_EVENTS = ["move", "zoom", "rotate", "pitch", "resize"];
export const DEFAULT_AREA_FILL_OPACITY = 0.14;
export const AREA_REGION_SOURCE_ID = "mr-wplace-area-regions-source";
export const AREA_REGION_FILL_LAYER_ID = "mr-wplace-area-regions-fill";
export const AREA_REGION_LINE_LAYER_ID = "mr-wplace-area-regions-line";
export const AREA_REGION_LABEL_LAYER_ID = "mr-wplace-area-regions-label";
export const AREA_REGION_BADGE_LABEL_LAYER_ID =
  "mr-wplace-area-regions-label-badge";
export const AREA_EDIT_SOURCE_ID = "mr-wplace-area-edit-source";
export const AREA_EDIT_FILL_LAYER_ID = "mr-wplace-area-edit-fill";
export const AREA_EDIT_LINE_LAYER_ID = "mr-wplace-area-edit-line";
export const AREA_LABEL_BADGE_IMAGE_ID_PREFIX = "mr-wplace-area-label-badge-";
export const AREA_REGION_SYNC_BATCH_SIZE = 160;
export const AREA_REGION_SYNC_TIME_BUDGET_MS = 6;
export const AREA_REGION_RENDER_COMMIT_STEP = 640;
export const AREA_REGION_BEST_EFFORT_MAX = 2500;

export const EMPTY_POLYGON_FEATURE_COLLECTION: GeoJsonPolygonFeatureCollection =
  {
    type: "FeatureCollection",
    features: [],
  };
