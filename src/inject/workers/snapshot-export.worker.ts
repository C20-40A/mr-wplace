/**
 * Snapshot Export Worker
 *
 * Runs ZIP packaging off the main (inject) thread to avoid UI blocking.
 * - Opens "mr-wplace-snapshots" IndexedDB directly (Worker has IndexedDB access)
 * - Reads metadata + blobs one by one via cursor (no full in-memory expansion)
 * - Packs into JSZip with STORE (no compression: PNG is already compressed)
 * - Streams generateAsync progress back to inject, then returns the final blob
 *
 * NOTE: DB name / store names are hardcoded here to keep the Worker self-contained.
 * Keep in sync with src/inject/db/snapshot-repository.ts
 */

import JSZip from "jszip";

const DB_NAME = "mr-wplace-snapshots";
const DB_VERSION = 1;
const STORE_SNAPSHOTS = "snapshots";
const STORE_METADATA = "metadata";

interface SnapshotMetadata {
  id: string;
  timestamp: number;
  tileX: number;
  tileY: number;
  name?: string;
}

type ExportScope =
  | { scope: "all" }
  | { scope: "tile"; tileX: number; tileY: number };

interface ExportRequest extends Partial<ExportScope> {
  scope: "all" | "tile";
  tileX?: number;
  tileY?: number;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const getAllMetadata = (db: IDBDatabase): Promise<SnapshotMetadata[]> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_METADATA], "readonly");
    const request = tx.objectStore(STORE_METADATA).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

const getSnapshotBlob = (db: IDBDatabase, id: string): Promise<Blob | null> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_SNAPSHOTS], "readonly");
    const request = tx.objectStore(STORE_SNAPSHOTS).get(id);
    request.onsuccess = () => {
      const record = request.result as { id: string; blob: Blob } | undefined;
      resolve(record?.blob || null);
    };
    request.onerror = () => reject(request.error);
  });

// Compatible with import-snapshot parser: {tileX}-{tileY}-{timestamp}.snapshot.png
const buildFilename = (meta: SnapshotMetadata): string =>
  `${meta.tileX}-${meta.tileY}-${meta.timestamp}.snapshot.png`;

const runExport = async (req: ExportRequest): Promise<void> => {
  const db = await openDatabase();

  const allMetadata = await getAllMetadata(db);
  const targets =
    req.scope === "tile"
      ? allMetadata.filter(
          (m) => m.tileX === req.tileX && m.tileY === req.tileY
        )
      : allMetadata;

  if (targets.length === 0) {
    self.postMessage({ type: "empty" });
    return;
  }

  const zip = new JSZip();
  let added = 0;

  // Read blobs one by one and add with STORE (no compression)
  for (const meta of targets) {
    const blob = await getSnapshotBlob(db, meta.id);
    if (!blob) continue;

    zip.file(buildFilename(meta), blob, { compression: "STORE" });
    added++;

    self.postMessage({
      type: "progress",
      phase: "read",
      current: added,
      total: targets.length,
    });
  }

  if (added === 0) {
    self.postMessage({ type: "empty" });
    return;
  }

  const zipBlob = await zip.generateAsync(
    { type: "blob", compression: "STORE", streamFiles: true },
    (metadata) => {
      self.postMessage({
        type: "progress",
        phase: "pack",
        percent: metadata.percent,
      });
    }
  );

  self.postMessage({ type: "done", blob: zipBlob, count: added });
};

self.onmessage = async (event: MessageEvent<ExportRequest>) => {
  try {
    await runExport(event.data);
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
