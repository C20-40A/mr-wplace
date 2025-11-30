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
    mrWplaceTempPaintedByUser?: PaintedByUser;
  }
}
