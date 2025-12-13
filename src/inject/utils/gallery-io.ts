/**
 * Gallery Import/Export utilities
 * All gallery I/O operations run in inject context (page origin)
 */

import JSZip from "jszip";
import { initGalleryRepository } from "@/inject/db/gallery-repository";
import type { GalleryMetadata } from "@/inject/db/schema-v2";

// ============================================
// Filename parsing
// ============================================

interface DrawPosition {
  TLX: number;
  TLY: number;
  PxX: number;
  PxY: number;
}

const sanitizeTitle = (title: string): string =>
  title
    .replace(/[/:*?"<>|\\]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);

const getExtensionFromBlob = (blob: Blob): string => {
  const type = blob.type;
  if (type.includes("png")) return "png";
  if (type.includes("jpeg") || type.includes("jpg")) return "jpg";
  if (type.includes("webp")) return "webp";
  return "png";
};

const parseFilename = (
  filename: string
): { title: string; drawPosition: DrawPosition; layerOrder?: number } | null => {
  const basename = filename.split("/").pop()!;

  // Pattern: {layerOrder}__{TLX}_{TLY}_{PxX}_{PxY}.{ext} (no title)
  const noTitle = /^(\d+)__(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
  const matchNoTitle = basename.match(noTitle);
  if (matchNoTitle) {
    const [, layerOrder, TLX, TLY, PxX, PxY] = matchNoTitle;
    return {
      title: "",
      drawPosition: {
        TLX: parseInt(TLX),
        TLY: parseInt(TLY),
        PxX: parseInt(PxX),
        PxY: parseInt(PxY),
      },
      layerOrder: parseInt(layerOrder),
    };
  }

  // Pattern: {layerOrder}_{title}_{TLX}_{TLY}_{PxX}_{PxY}.{ext}
  const withTitle =
    /^(\d+)_([^_]+)_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
  const matchWithTitle = basename.match(withTitle);
  if (matchWithTitle) {
    const [, layerOrder, titlePart, TLX, TLY, PxX, PxY] = matchWithTitle;
    return {
      title: titlePart.replace(/_/g, " "),
      drawPosition: {
        TLX: parseInt(TLX),
        TLY: parseInt(TLY),
        PxX: parseInt(PxX),
        PxY: parseInt(PxY),
      },
      layerOrder: parseInt(layerOrder),
    };
  }

  // Old format: {anything}_{TLX}_{TLY}_{PxX}_{PxY}.{ext}
  const old = /^(.+?)_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
  const matchOld = basename.match(old);
  if (matchOld) {
    const [, titlePart, TLX, TLY, PxX, PxY] = matchOld;
    const title = titlePart.match(/^image_\d+$/)
      ? ""
      : titlePart.replace(/_/g, " ");
    return {
      title,
      drawPosition: {
        TLX: parseInt(TLX),
        TLY: parseInt(TLY),
        PxX: parseInt(PxX),
        PxY: parseInt(PxY),
      },
    };
  }

  return null;
};

// ============================================
// Import
// ============================================

export const importGalleryFromZip = async (
  zipFile: File
): Promise<{ success: number; failed: number }> => {
  const repo = await initGalleryRepository();
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.entries(zip.files);

  console.log(`🧑‍🎨 : Loading ZIP with ${entries.length} files`);

  const items: Array<{
    filename: string;
    file: JSZip.JSZipObject;
    parsed: ReturnType<typeof parseFilename>;
  }> = [];

  for (const [filename, file] of entries) {
    if (file.dir || filename.startsWith(".") || filename.startsWith("__MACOSX"))
      continue;
    if (!/\.(png|jpg|jpeg|webp)$/i.test(filename)) continue;

    const parsed = parseFilename(filename);
    if (!parsed) {
      console.warn(`🧑‍🎨 : Skipping invalid format: ${filename}`);
      continue;
    }

    items.push({ filename, file, parsed });
  }

  if (items.length === 0) return { success: 0, failed: 0 };

  // Sort by layerOrder (best effort)
  items.sort((a, b) => {
    const aLayer = a.parsed?.layerOrder ?? Infinity;
    const bLayer = b.parsed?.layerOrder ?? Infinity;
    return aLayer - bLayer;
  });

  console.log(`🧑‍🎨 : Found ${items.length} valid images`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const { filename, file, parsed } = items[i];

    try {
      const blob = await file.async("blob");
      const timestamp = Date.now();
      const key = `gallery_${timestamp}_${Math.random().toString(36).slice(2, 9)}`;

      await repo.saveGalleryItem(key, blob, {
        title: parsed?.title,
        coords: parsed?.drawPosition,
        visible: true,
        zIndex: i,
        timestamp,
      });

      success++;
      console.log(`🧑‍🎨 : Imported ${filename}`);
    } catch (error) {
      failed++;
      console.error(`🧑‍🎨 : Failed to import ${filename}:`, error);
    }
  }

  console.log(`🧑‍🎨 : Import complete: ${success} success, ${failed} failed`);

  if (success > 0 || failed > 0) {
    const msg = failed > 0 ? `Imported ${success} images (${failed} failed)` : `Imported ${success} images`;
    alert(msg);
  }

  return { success, failed };
};

// ============================================
// Export
// ============================================

export const exportGalleryToZip = async (): Promise<Blob> => {
  const repo = await initGalleryRepository();
  const zip = new JSZip();

  const allMetadata = await repo.getAllMetadata();
  const itemsToExport = allMetadata
    .filter((m) => m.coords)
    .sort((a, b) => a.zIndex - b.zIndex);

  if (itemsToExport.length === 0) {
    throw new Error("No images with draw position to export");
  }

  console.log(`🧑‍🎨 : Exporting ${itemsToExport.length} images to ZIP`);

  for (const meta of itemsToExport) {
    const imageBlob = await repo.getImage(meta.id);
    if (!imageBlob) {
      console.warn(`🧑‍🎨 : Skipping ${meta.id} - no image`);
      continue;
    }

    const { TLX, TLY, PxX, PxY } = meta.coords!;
    const ext = getExtensionFromBlob(imageBlob);
    const titlePart = meta.title ? sanitizeTitle(meta.title) : "";
    const filename = titlePart
      ? `${meta.zIndex}_${titlePart}_${TLX}_${TLY}_${PxX}_${PxY}.${ext}`
      : `${meta.zIndex}__${TLX}_${TLY}_${PxX}_${PxY}.${ext}`;

    zip.file(filename, imageBlob);
    console.log(`🧑‍🎨 : Added ${filename}`);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  console.log(`🧑‍🎨 : ZIP size: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`);

  return zipBlob;
};

// ============================================
// File picker + Import (called from inject)
// ============================================

export const openFilePickerAndImport = (): Promise<{ success: number; failed: number }> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip";
    input.style.display = "none";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ success: 0, failed: 0 });
        return;
      }

      try {
        const result = await importGalleryFromZip(file);
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        input.remove();
      }
    };

    input.oncancel = () => {
      resolve({ success: 0, failed: 0 });
      input.remove();
    };

    document.body.appendChild(input);
    input.click();
  });
};

// ============================================
// Export + Download (called from inject)
// ============================================

export const exportAndDownload = async (): Promise<void> => {
  const zipBlob = await exportGalleryToZip();

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `wplace_gallery_${timestamp}.zip`;

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ============================================
// Reset (delete all)
// ============================================

export const resetGallery = async (): Promise<number> => {
  const repo = await initGalleryRepository();
  const allMetadata = await repo.getAllMetadata();

  let count = 0;
  for (const meta of allMetadata) {
    try {
      await repo.deleteGalleryItem(meta.id);
      count++;
    } catch (error) {
      console.error(`🧑‍🎨 : Failed to delete ${meta.id}:`, error);
    }
  }

  console.log(`🧑‍🎨 : Reset ${count} gallery items`);
  return count;
};
