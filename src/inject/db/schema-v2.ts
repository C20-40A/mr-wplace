/**
 * Gallery Database Schema v2
 *
 * 新しいIndexedDB構造:
 * - images: フルサイズ元画像
 * - splitTiles: タイル分割画像 (1000x1000に分割したオーバーレイ画像)
 * - metadata: メタデータ
 * - thumbnails: サムネイル
 *
 * NOTE: splitTilesは「画像をタイルサイズに分割したもの」であり、
 *       WPlaceのマップタイル（tiles/X/Y.png）とは別物
 */

export const DB_NAME_V2 = "mr-wplace-gallery-v2";
export const DB_VERSION_V2 = 2; // v2: renamed tiles -> splitTiles

export const STORES_V2 = {
  IMAGES: "images",
  SPLIT_TILES: "splitTiles", // タイル分割画像 (overlay用)
  METADATA: "metadata",
  THUMBNAILS: "thumbnails",
} as const;

/**
 * メタデータ型定義
 */
export interface GalleryMetadata {
  id: string; // "gallery_<timestamp>"
  title?: string;
  coords?: { TLX: number; TLY: number; PxX: number; PxY: number };
  width: number;
  height: number;
  affectedTiles: string[]; // ["5,3,0,0", "5,3,0,1", ...]
  visible: boolean;
  zIndex: number;
  timestamp: number;
  perTileStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >;
}

/**
 * フルサイズ画像データ
 */
export interface ImageRecord {
  id: string;
  blob: Blob;
}

/**
 * タイル分割画像データ
 */
export interface TileRecord {
  layerId: string;
  tileKey: string; // "TLX,TLY,PxX,PxY"
  blob: Blob;
}

/**
 * サムネイルデータ
 */
export interface ThumbnailRecord {
  id: string;
  blob: Blob;
}

/**
 * Open database v2
 */
export const openDatabaseV2 = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME_V2, DB_VERSION_V2);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      console.log("🧑‍🎨 : IndexedDB v2 opened successfully");
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      console.log(`🧑‍🎨 : IndexedDB v2 upgrade needed (v${event.oldVersion} -> v${DB_VERSION_V2})`);

      // Remove old "tiles" store if exists (renamed to splitTiles in v2)
      if (db.objectStoreNames.contains("tiles")) {
        db.deleteObjectStore("tiles");
        console.log('🧑‍🎨 : Deleted old "tiles" store');
      }

      // images store
      if (!db.objectStoreNames.contains(STORES_V2.IMAGES)) {
        db.createObjectStore(STORES_V2.IMAGES, { keyPath: "id" });
        console.log('🧑‍🎨 : Created "images" store');
      }

      // splitTiles store (composite key: layerId + tileKey)
      if (!db.objectStoreNames.contains(STORES_V2.SPLIT_TILES)) {
        const tilesStore = db.createObjectStore(STORES_V2.SPLIT_TILES, {
          keyPath: ["layerId", "tileKey"],
        });
        tilesStore.createIndex("layerId", "layerId", { unique: false });
        console.log('🧑‍🎨 : Created "splitTiles" store');
      }

      // metadata store
      if (!db.objectStoreNames.contains(STORES_V2.METADATA)) {
        const metadataStore = db.createObjectStore(STORES_V2.METADATA, {
          keyPath: "id",
        });
        metadataStore.createIndex("visible", "visible", { unique: false });
        metadataStore.createIndex("zIndex", "zIndex", { unique: false });
        console.log('🧑‍🎨 : Created "metadata" store');
      }

      // thumbnails store
      if (!db.objectStoreNames.contains(STORES_V2.THUMBNAILS)) {
        db.createObjectStore(STORES_V2.THUMBNAILS, { keyPath: "id" });
        console.log('🧑‍🎨 : Created "thumbnails" store');
      }

      console.log("🧑‍🎨 : IndexedDB v2 schema upgrade complete");
    };
  });
};

/**
 * Calculate affected tiles from coords and image dimensions
 */
export const calculateAffectedTiles = (
  coords: { TLX: number; TLY: number; PxX: number; PxY: number },
  width: number,
  height: number
): string[] => {
  const tiles: string[] = [];
  const TILE_SIZE = 1000;

  // Starting pixel position in global coordinates
  const startGlobalX = coords.TLX * TILE_SIZE + coords.PxX;
  const startGlobalY = coords.TLY * TILE_SIZE + coords.PxY;

  // Ending pixel position
  const endGlobalX = startGlobalX + width - 1;
  const endGlobalY = startGlobalY + height - 1;

  // Calculate tile range
  const startTileX = Math.floor(startGlobalX / TILE_SIZE);
  const startTileY = Math.floor(startGlobalY / TILE_SIZE);
  const endTileX = Math.floor(endGlobalX / TILE_SIZE);
  const endTileY = Math.floor(endGlobalY / TILE_SIZE);

  for (let ty = startTileY; ty <= endTileY; ty++) {
    for (let tx = startTileX; tx <= endTileX; tx++) {
      // Calculate pixel offset within this tile
      const pxX = tx === startTileX ? coords.PxX : 0;
      const pxY = ty === startTileY ? coords.PxY : 0;
      tiles.push(`${tx},${ty},${pxX},${pxY}`);
    }
  }

  return tiles;
};

/**
 * Check if IndexedDB v2 is available
 */
export const isIndexedDBV2Available = (): boolean => {
  return typeof indexedDB !== "undefined";
};
