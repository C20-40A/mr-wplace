/**
 * Gallery Export Worker
 *
 * Runs ZIP packaging off the main (inject) thread to avoid UI blocking.
 * - Opens "mr-wplace-gallery-v2" IndexedDB directly (Worker has IndexedDB access)
 * - Reads metadata + full-size images one by one (no full in-memory expansion)
 * - Packs into JSZip with STORE (no compression: images are already compressed)
 * - Streams generateAsync progress back to inject, then returns the final blob
 *
 * NOTE: DB name / store names are hardcoded here to keep the Worker self-contained.
 * Keep in sync with src/inject/db/schema-v2.ts and gallery-io.ts filename rules.
 */

import JSZip from "jszip";
import { tilePixelToLatLng } from "@/utils/coordinate";

const DB_NAME = "mr-wplace-gallery-v2";
const DB_VERSION = 2;
const STORE_IMAGES = "images";
const STORE_METADATA = "metadata";

type ExportFormat = "png" | "wplace";

interface GalleryMetadata {
  id: string;
  title?: string;
  coords?: { TLX: number; TLY: number; PxX: number; PxY: number };
  width: number;
  height: number;
  visible?: boolean;
  zIndex: number;
}

interface ImageRecord {
  id: string;
  blob?: Blob;
  dataUrl?: string;
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const getAllMetadata = (db: IDBDatabase): Promise<GalleryMetadata[]> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_METADATA], "readonly");
    const request = tx.objectStore(STORE_METADATA).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

const getImageRecord = (
  db: IDBDatabase,
  id: string
): Promise<ImageRecord | null> =>
  new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_IMAGES], "readonly");
    const request = tx.objectStore(STORE_IMAGES).get(id);
    request.onsuccess = () => resolve((request.result as ImageRecord) || null);
    request.onerror = () => reject(request.error);
  });

// images may be stored as Blob (preferred) or dataUrl fallback (Safari/Private)
const recordToBlob = async (record: ImageRecord): Promise<Blob | null> => {
  if (record.blob) return record.blob;
  if (record.dataUrl) return (await fetch(record.dataUrl)).blob();
  return null;
};

const getExtension = (blob: Blob): string => {
  const type = blob.type;
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
};

const sanitizeTitle = (title: string): string =>
  title
    .replace(/[/:*?"<>|\\]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);

// Compatible with gallery-io importer:
//   {zIndex}_{title}_{TLX}_{TLY}_{PxX}_{PxY}.{ext}  (with title)
//   {zIndex}__{TLX}_{TLY}_{PxX}_{PxY}.{ext}         (no title)
const buildFilename = (meta: GalleryMetadata, blob: Blob): string => {
  const { TLX, TLY, PxX, PxY } = meta.coords!;
  const ext = getExtension(blob);
  const titlePart = meta.title ? sanitizeTitle(meta.title) : "";
  return titlePart
    ? `${meta.zIndex}_${titlePart}_${TLX}_${TLY}_${PxX}_${PxY}.${ext}`
    : `${meta.zIndex}__${TLX}_${TLY}_${PxX}_${PxY}.${ext}`;
};

// .wplace 用 png風内部ファイル名（単体エクスポート createPngFilename と互換）
const buildWplaceImageName = (meta: GalleryMetadata): string => {
  const { TLX, TLY, PxX, PxY } = meta.coords!;
  const coords = `${TLX}-${TLY}-${PxX}-${PxY}`;
  const base = meta.title ? `${meta.title}_${coords}` : coords;
  return sanitizeTitle(base) + ".png";
};

const buildWplaceFilename = (meta: GalleryMetadata): string => {
  const base = meta.title || `image_${meta.zIndex}`;
  return sanitizeTitle(base) + ".wplace";
};

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

// 単体エクスポート downloadWplaceFile と同じ .wplace payload を生成
const buildWplacePayload = async (
  meta: GalleryMetadata,
  blob: Blob
): Promise<unknown> => {
  const { TLX, TLY, PxX, PxY } = meta.coords!;
  const northWest = tilePixelToLatLng(TLX, TLY, PxX, PxY);
  const southEast = tilePixelToLatLng(
    TLX,
    TLY,
    PxX + meta.width,
    PxY + meta.height
  );
  const dataUrl = await blobToDataUrl(blob);

  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `mr-wplace-${Date.now()}-${meta.zIndex}`,
    schemaVersion: "1",
    name: buildWplaceImageName(meta),
    opacity: 1,
    image: { dataUrl, width: meta.width, height: meta.height },
    bounds: {
      north: northWest.lat,
      south: southEast.lat,
      west: northWest.lng,
      east: southEast.lng,
    },
    colorMetric: "lab",
    dithering: false,
    order: meta.zIndex,
    locked: false,
    hasPlaced: true,
    visible: meta.visible !== false,
  };
};

const runExport = async (format: ExportFormat): Promise<void> => {
  const db = await openDatabase();

  const allMetadata = await getAllMetadata(db);
  const targets = allMetadata
    .filter((m) => m.coords)
    .sort((a, b) => a.zIndex - b.zIndex);

  if (targets.length === 0) {
    self.postMessage({ type: "empty" });
    return;
  }

  const zip = new JSZip();
  let added = 0;

  for (const meta of targets) {
    const record = await getImageRecord(db, meta.id);
    if (!record) continue;
    const blob = await recordToBlob(record);
    if (!blob) continue;

    if (format === "wplace") {
      const payload = await buildWplacePayload(meta, blob);
      zip.file(buildWplaceFilename(meta), JSON.stringify(payload, null, 2), {
        compression: "DEFLATE",
      });
    } else {
      zip.file(buildFilename(meta, blob), blob, { compression: "STORE" });
    }
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

  // .wplace は base64 JSON テキストなので DEFLATE で圧縮、png は元々圧縮済みなので STORE
  const zipBlob = await zip.generateAsync(
    {
      type: "blob",
      compression: format === "wplace" ? "DEFLATE" : "STORE",
      streamFiles: true,
    },
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

self.onmessage = async (event: MessageEvent<{ format?: ExportFormat }>) => {
  const format: ExportFormat = event.data?.format === "wplace" ? "wplace" : "png";
  try {
    await runExport(format);
  } catch (error) {
    self.postMessage({
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
