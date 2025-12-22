import type { GalleryItem } from "../states/galleryStorage";

export type TileProcessingCallback = (processedBlob: Blob) => void;

export interface TileProcessingQueue
  extends Map<string, TileProcessingCallback> {}

export interface DataSaverState {
  enabled: boolean;
  tileCache: Map<string, Blob>;
  maxCacheSize: number;
  tileCacheDB?: {
    getCachedTile: (key: string) => Promise<Blob | null>;
    setCachedTile: (key: string, blob: Blob, maxSize: number) => Promise<void>;
    clearCache: () => Promise<void>;
    getCacheSize: () => Promise<number>;
    deleteTile: (key: string) => Promise<void>;
  };
}

export interface SnapshotImage {
  key: string;
  tileX: number;
  tileY: number;
}

export interface TextLayer {
  key: string;
  text: string;
  font: string;
  coords: {
    TLX: number;
    TLY: number;
    PxX: number;
    PxY: number;
  };
  dataUrl: string;
  timestamp: number;
}

export interface ColorFilterState {
  isFilterActive: () => boolean;
  selectedRGBs: [number, number, number][] | undefined;
  getEnhancedMode: () => "dot" | "cross" | "fill" | "none";
  setExtraColorsBitmap?: (bitmap: ImageBitmap | null) => void;
}

export interface PaintedByUser {
  id: number;
  name: string;
  allianceId?: number;
  allianceName?: string;
  equippedFlag: number;
  picture?: string;
  discord?: string;
  discordId?: string;
}

export interface WplaceMap {
  version: string;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
  jumpTo: (options: { center: [number, number]; zoom: number }) => void;
  setPaintProperty: (layer: string, property: string, value: any) => void;
  on: (event: string, handler: (e: any) => void) => void;
  showTileBoundaries: boolean;
}

declare global {
  interface Window {
    wplaceMap?: WplaceMap;
    tileProcessingQueue?: TileProcessingQueue;
    mrWplaceDataSaver?: DataSaverState;
    mrWplaceGalleryImages?: Map<string, GalleryItem>;
    mrWplaceGalleryImageKeys?: Set<string>;
    mrWplaceSnapshots?: Map<string, SnapshotImage>;
    mrWplaceSnapshotKeys?: Set<string>;
    mrWplaceTextLayers?: Map<string, TextLayer>;
    mrWplaceTextLayerKeys?: Set<string>;
    mrWplaceComputeDevice?: "gpu" | "cpu";
    mrWplaceShowUnplacedOnly?: boolean;
    mrWplaceLayerSortEnabled?: boolean;
    mrWplaceTempPaintedByUser?: PaintedByUser;
    selectedColor?: string; // WPlace's selected color (e.g., "#FF0000")
  }
}

interface FavoriteLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

interface Charges {
  cooldownMs: number;
  count: number;
  max: number;
}

interface Experiments {
  "2025-09_discord_linking": {
    enabled: boolean;
  };
  "2025-09_pawtect": {
    variant: "koala" | string; // variantは文字列かもしれませんが、例示の値から'koala'を含めました
  };
  [key: string]: { [key: string]: any }; // 他の実験が追加される可能性を考慮
}

export interface WplaceUserData {
  allianceId: number;
  allianceRole: "member" | string; // 他のロールも考えられます
  charges: Charges;
  country: string; // ISO 3166-1 alpha-2 code (例: "JP")
  discord: string;
  discordId: string;
  droplets: number;
  equippedFlag: number;
  experiments: Experiments;
  extraColorsBitmap: number;
  favoriteLocations: FavoriteLocation[];
  flagsBitmap: string; // Base64 or similar string
  id: number;
  isCustomer: boolean;
  level: number;
  maxFavoriteLocations: number;
  name: string;
  needsPhoneVerification: boolean;
  picture: string; // Base64 encoded image string (data URL)
  pixelsPainted: number;
  role: "user" | string; // 他のロールも考えられます
  showLastPixel: boolean;
  timeoutUntil: string; // ISO 8601 Date String (例: "1970-01-01T00:00:00Z")
}
