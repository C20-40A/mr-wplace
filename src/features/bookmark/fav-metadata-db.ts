/**
 * Official Favorite Locations - Local Metadata & Image DB
 *
 * Stores user-local data (thumbnail, notes, etc.) for official favorites.
 * NOT synced to server.
 *
 * DB: mr-wplace-fav-metadata
 *   thumbnails: { id: number (favoriteLocation.id), dataUrl: string }
 *   metadata:   { id: number, [future fields...] }
 */

const DB_NAME = "mr-wplace-fav-metadata";
const DB_VERSION = 1;

const STORES = {
  THUMBNAILS: "thumbnails",
  METADATA: "metadata",
} as const;

export interface FavThumbnailRecord {
  id: number;
  dataUrl: string;
}

export interface FavMetadataRecord {
  id: number;
  thumbnailId?: number; // reference to thumbnails store
  lastAccessedDate?: string; // ISO string
}

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.THUMBNAILS)) {
        db.createObjectStore(STORES.THUMBNAILS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: "id" });
      }
      console.log("🧑‍🎨 : fav-metadata DB created");
    };
  });
  return dbPromise;
};

const tx = (
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
): IDBObjectStore => db.transaction(store, mode).objectStore(store);

export const saveFavThumbnail = async (id: number, dataUrl: string): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORES.THUMBNAILS, "readwrite").put({ id, dataUrl });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getFavThumbnail = async (id: number): Promise<string | null> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORES.THUMBNAILS, "readonly").get(id);
    req.onsuccess = () =>
      resolve((req.result as FavThumbnailRecord | undefined)?.dataUrl ?? null);
    req.onerror = () => reject(req.error);
  });
};

export const getAllFavThumbnails = async (): Promise<Map<number, string>> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const map = new Map<number, string>();
    const req = tx(db, STORES.THUMBNAILS, "readonly").openCursor();
    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null;
      if (cursor) {
        const rec = cursor.value as FavThumbnailRecord;
        map.set(rec.id, rec.dataUrl);
        cursor.continue();
      } else {
        resolve(map);
      }
    };
    req.onerror = () => reject(req.error);
  });
};

export const deleteFavThumbnail = async (id: number): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = tx(db, STORES.THUMBNAILS, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const saveFavMetadata = async (
  id: number,
  patch: Partial<Omit<FavMetadataRecord, "id">>,
): Promise<void> => {
  const db = await openDb();
  const store = tx(db, STORES.METADATA, "readwrite");
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = (getReq.result as FavMetadataRecord | undefined) ?? { id };
      const putReq = store.put({ ...existing, ...patch });
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
};

export const getAllFavMetadata = async (): Promise<Map<number, FavMetadataRecord>> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const map = new Map<number, FavMetadataRecord>();
    const req = tx(db, STORES.METADATA, "readonly").openCursor();
    req.onsuccess = () => {
      const cursor = req.result as IDBCursorWithValue | null;
      if (cursor) {
        const rec = cursor.value as FavMetadataRecord;
        map.set(rec.id, rec);
        cursor.continue();
      } else {
        resolve(map);
      }
    };
    req.onerror = () => reject(req.error);
  });
};
