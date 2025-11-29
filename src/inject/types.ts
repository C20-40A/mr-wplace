export type TileProcessingCallback = (processedBlob: Blob) => void;

export interface TileProcessingQueue extends Map<string, TileProcessingCallback> {}

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

/**
 * Gallery image data sent from content script to inject context via postMessage
 * This is a subset of GalleryItem from content context
 */
export interface GalleryImage {
  key: string;
  dataUrl?: string; // Optional because it may be undefined for Doctor-cleaned items
  isThumbnail?: boolean; // True if dataUrl is a thumbnail (not suitable for drawing)
  drawPosition: { TLX: number; TLY: number; PxX: number; PxY: number };
  layerOrder: number;
  drawEnabled?: boolean; // False if image is disabled in gallery
  // Stored statistics for restoration after reload
  perTileColorStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >;
}

export interface SnapshotImage {
  key: string;
  dataUrl: string;
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
  selectedRGBs: number[][] | undefined;
  getEnhancedMode: () => "dot" | "cross" | "fill" | "none";
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

export interface MrWplaceGlobal {
  colorFilterManager?: ColorFilterState;
  layerRepository?: import("./db/layer-repository").LayerRepository;
  workerMessenger?: import("./workers/messaging").WorkerMessenger;
}

export interface WplaceMap {
  version: string;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
  jumpTo: (options: { center: [number, number]; zoom: number }) => void;
  setPaintProperty: (layer: string, property: string, value: any) => void;
  on: (event: string, handler: (e: any) => void) => void;
}

export interface WindowWithWplace extends Window {
  wplaceMap?: WplaceMap;
  tileProcessingQueue?: TileProcessingQueue;
  mrWplaceDataSaver?: DataSaverState;
  mrWplaceGalleryImages?: Map<string, GalleryImage>;
  mrWplaceGalleryImageKeys?: Set<string>;
  mrWplaceSnapshots?: Map<string, SnapshotImage>;
  mrWplaceSnapshotKeys?: Set<string>;
  mrWplaceTextLayers?: Map<string, TextLayer>;
  mrWplaceTextLayerKeys?: Set<string>;
  mrWplace?: MrWplaceGlobal;
  mrWplaceComputeDevice?: "gpu" | "cpu";
  mrWplaceShowUnplacedOnly?: boolean;
  mrWplaceTempPaintedByUser?: PaintedByUser;
}

declare global {
  interface Window {
    wplaceMap?: WplaceMap;
    tileProcessingQueue?: TileProcessingQueue;
    mrWplaceDataSaver?: DataSaverState;
    mrWplaceGalleryImages?: Map<string, GalleryImage>;
    mrWplaceGalleryImageKeys?: Set<string>;
    mrWplaceSnapshots?: Map<string, SnapshotImage>;
    mrWplaceSnapshotKeys?: Set<string>;
    mrWplaceTextLayers?: Map<string, TextLayer>;
    mrWplaceTextLayerKeys?: Set<string>;
    mrWplace?: MrWplaceGlobal;
    mrWplaceComputeDevice?: "gpu" | "cpu";
    mrWplaceShowUnplacedOnly?: boolean;
    mrWplaceTempPaintedByUser?: PaintedByUser;
  }
}
