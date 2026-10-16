/**
 * Snapshot Repository
 *
 * IndexedDB for tile snapshots storage
 * - snapshots: snapshot image blobs
 * - metadata: snapshot metadata (timestamp, tileX, tileY, name, etc.)
 * - thumbnails: small preview blobs (optional / best-effort, keyed by id)
 */

const DB_NAME = "mr-wplace-snapshots";
const DB_VERSION = 2;

export const SNAPSHOT_STORES = {
  SNAPSHOTS: "snapshots",
  METADATA: "metadata",
  THUMBNAILS: "thumbnails",
} as const;

export interface SnapshotThumbnailRecord {
  id: string;
  blob: Blob;
}

export interface SnapshotMetadata {
  id: string;
  timestamp: number;
  tileX: number;
  tileY: number;
  name?: string;
}

export interface SnapshotRecord {
  id: string;
  blob: Blob;
}

/**
 * Open IndexedDB for snapshots
 */
const openSnapshotDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onblocked = () => {
      // 旧バージョンの接続が残っている。閉じられるまで待機する（致命的ではない）
      console.warn(
        "🧑‍🎨 [Snapshot] IndexedDB upgrade blocked by another connection",
      );
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Snapshots store: { id: string, blob: Blob }
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.SNAPSHOTS)) {
        db.createObjectStore(SNAPSHOT_STORES.SNAPSHOTS, { keyPath: "id" });
      }

      // Metadata store: { id, timestamp, tileX, tileY, name }
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.METADATA)) {
        const metadataStore = db.createObjectStore(SNAPSHOT_STORES.METADATA, {
          keyPath: "id",
        });
        metadataStore.createIndex("timestamp", "timestamp", { unique: false });
        metadataStore.createIndex("tile", ["tileX", "tileY"], {
          unique: false,
        });
      }

      // Thumbnails store: { id, blob } (v2, additive migration)
      if (!db.objectStoreNames.contains(SNAPSHOT_STORES.THUMBNAILS)) {
        db.createObjectStore(SNAPSHOT_STORES.THUMBNAILS, { keyPath: "id" });
      }
    };
  });
};

export class SnapshotRepository {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const db = await openSnapshotDatabase();
      // 他タブが新しいバージョンへ更新しようとしたら、この接続を閉じて邪魔しない
      db.onversionchange = () => {
        db.close();
        if (this.db === db) {
          this.db = null;
          this.initPromise = null;
        }
      };
      this.db = db;
    })();

    return this.initPromise;
  }

  private getDb(): IDBDatabase {
    if (!this.db) throw new Error("SnapshotRepository not initialized");
    return this.db;
  }

  // ============================================
  // Metadata Operations
  // ============================================

  async getMetadata(id: string): Promise<SnapshotMetadata | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.METADATA], "readonly");
      const store = tx.objectStore(SNAPSHOT_STORES.METADATA);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMetadata(): Promise<SnapshotMetadata[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.METADATA], "readonly");
      const store = tx.objectStore(SNAPSHOT_STORES.METADATA);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadataByTile(
    tileX: number,
    tileY: number
  ): Promise<SnapshotMetadata[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.METADATA], "readonly");
      const store = tx.objectStore(SNAPSHOT_STORES.METADATA);
      const index = store.index("tile");
      const request = index.getAll(IDBKeyRange.only([tileX, tileY]));

      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveMetadata(metadata: SnapshotMetadata): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.METADATA], "readwrite");
      const store = tx.objectStore(SNAPSHOT_STORES.METADATA);
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateMetadata(
    id: string,
    updates: Partial<Omit<SnapshotMetadata, "id">>
  ): Promise<void> {
    const current = await this.getMetadata(id);
    if (!current) throw new Error(`Snapshot metadata not found: ${id}`);

    await this.saveMetadata({
      ...current,
      ...updates,
      id,
    });
  }

  async deleteMetadata(id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.METADATA], "readwrite");
      const store = tx.objectStore(SNAPSHOT_STORES.METADATA);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Snapshot Blob Operations
  // ============================================

  async getSnapshot(id: string): Promise<Blob | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.SNAPSHOTS], "readonly");
      const store = tx.objectStore(SNAPSHOT_STORES.SNAPSHOTS);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as SnapshotRecord | undefined;
        resolve(record?.blob || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveSnapshot(id: string, blob: Blob): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.SNAPSHOTS], "readwrite");
      const store = tx.objectStore(SNAPSHOT_STORES.SNAPSHOTS);
      const record: SnapshotRecord = { id, blob };
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteSnapshot(id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.SNAPSHOTS], "readwrite");
      const store = tx.objectStore(SNAPSHOT_STORES.SNAPSHOTS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Snapshot Thumbnail Operations (best-effort)
  // ============================================

  async getThumbnail(id: string): Promise<Blob | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.THUMBNAILS], "readonly");
      const store = tx.objectStore(SNAPSHOT_STORES.THUMBNAILS);
      const request = store.get(id);

      request.onsuccess = () => {
        const record = request.result as SnapshotThumbnailRecord | undefined;
        resolve(record?.blob || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveThumbnail(id: string, blob: Blob): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SNAPSHOT_STORES.THUMBNAILS], "readwrite");
      const store = tx.objectStore(SNAPSHOT_STORES.THUMBNAILS);
      const record: SnapshotThumbnailRecord = { id, blob };
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Bulk Operations
  // ============================================

  async saveSnapshotWithMetadata(
    id: string,
    blob: Blob,
    metadata: SnapshotMetadata,
    thumbnail?: Blob | null
  ): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const storeNames = thumbnail
        ? [
            SNAPSHOT_STORES.SNAPSHOTS,
            SNAPSHOT_STORES.METADATA,
            SNAPSHOT_STORES.THUMBNAILS,
          ]
        : [SNAPSHOT_STORES.SNAPSHOTS, SNAPSHOT_STORES.METADATA];
      const tx = db.transaction(storeNames, "readwrite");

      const snapshotStore = tx.objectStore(SNAPSHOT_STORES.SNAPSHOTS);
      const metadataStore = tx.objectStore(SNAPSHOT_STORES.METADATA);

      const snapshotRecord: SnapshotRecord = { id, blob };
      snapshotStore.put(snapshotRecord);
      metadataStore.put(metadata);

      if (thumbnail) {
        const thumbnailStore = tx.objectStore(SNAPSHOT_STORES.THUMBNAILS);
        const thumbnailRecord: SnapshotThumbnailRecord = { id, blob: thumbnail };
        thumbnailStore.put(thumbnailRecord);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteSnapshotWithMetadata(id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [
          SNAPSHOT_STORES.SNAPSHOTS,
          SNAPSHOT_STORES.METADATA,
          SNAPSHOT_STORES.THUMBNAILS,
        ],
        "readwrite"
      );

      const snapshotStore = tx.objectStore(SNAPSHOT_STORES.SNAPSHOTS);
      const metadataStore = tx.objectStore(SNAPSHOT_STORES.METADATA);
      const thumbnailStore = tx.objectStore(SNAPSHOT_STORES.THUMBNAILS);

      snapshotStore.delete(id);
      metadataStore.delete(id);
      thumbnailStore.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Singleton instance
let repositoryInstance: SnapshotRepository | null = null;

export const initSnapshotRepository = async (): Promise<SnapshotRepository> => {
  if (!repositoryInstance) {
    repositoryInstance = new SnapshotRepository();
    await repositoryInstance.init();
  }
  return repositoryInstance;
};

export const getSnapshotRepository = (): SnapshotRepository => {
  if (!repositoryInstance) {
    throw new Error("SnapshotRepository not initialized. Call initSnapshotRepository first.");
  }
  return repositoryInstance;
};
