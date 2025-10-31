export type TileProcessingCallback = (processedBlob: Blob) => void;

export interface TileProcessingQueue extends Map<string, TileProcessingCallback> {}

export interface DataSaverState {
  enabled: boolean;
  tileCache: Map<string, Blob>;
}

export interface GalleryImage {
  key: string;
  dataUrl: string;
  drawPosition: { TLX: number; TLY: number; PxX: number; PxY: number };
  layerOrder: number;
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
}

declare global {
  interface Window {
    wplaceMap?: WplaceMap;
    tileProcessingQueue?: TileProcessingQueue;
    mrWplaceDataSaver?: DataSaverState;
    mrWplaceGalleryImages?: Map<string, GalleryImage>;
  }
}
