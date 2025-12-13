import JSZip from "jszip";
import type { GalleryItem, DrawPosition } from "@/states/galleryStorage";
import { initGalleryRepository } from "@/inject/db/gallery-repository";

/**
 * Sanitize title for use in filename
 * Removes filesystem-unsafe characters
 */
const sanitizeTitle = (title: string): string => {
  return title
    .replace(/[/:*?"<>|\\]/g, "_") // Replace unsafe chars
    .replace(/\s+/g, "_") // Replace spaces with underscore
    .replace(/_+/g, "_") // Collapse multiple underscores
    .substring(0, 50); // Limit length
};

/**
 * Convert dataUrl to Blob
 */
const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

/**
 * Get file extension from dataUrl
 */
const getExtensionFromDataUrl = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp)/i);
  if (!match) return "png";
  return match[1] === "jpeg" ? "jpg" : match[1];
};

/**
 * Export gallery items with drawPosition to a ZIP file
 * Filename format: {layerOrder}_{title}_{TLX}_{TLY}_{PxX}_{PxY}.{ext}
 * If title is empty: {layerOrder}__{TLX}_{TLY}_{PxX}_{PxY}.{ext}
 */
export const exportGalleryToZip = async (
  items: GalleryItem[]
): Promise<Blob> => {
  const zip = new JSZip();

  // Filter items with drawPosition and sort by layerOrder
  const itemsToExport = items
    .filter((item) => item.drawPosition)
    .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0));

  if (itemsToExport.length === 0) {
    throw new Error("No images with draw position to export");
  }

  console.log(`🧑‍🎨 : Exporting ${itemsToExport.length} images to ZIP`);

  // Add images to ZIP
  for (const item of itemsToExport) {
    const { TLX, TLY, PxX, PxY } = item.drawPosition!;
    const layerOrder = item.layerOrder ?? 0;

    // Get dataUrl (from storage or IndexedDB)
    const { getFullImageDataUrl } = await import("./indexed-db-bridge");
    const dataUrl = await getFullImageDataUrl(item, {
      logContext: "gallery export",
    });

    if (!dataUrl) {
      console.warn(`🧑‍🎨 : Skipping ${item.key} - no dataUrl available`);
      continue;
    }

    // Generate filename
    const titlePart = item.title ? sanitizeTitle(item.title) : "";
    const ext = getExtensionFromDataUrl(dataUrl);
    const filename = titlePart
      ? `${layerOrder}_${titlePart}_${TLX}_${TLY}_${PxX}_${PxY}.${ext}`
      : `${layerOrder}__${TLX}_${TLY}_${PxX}_${PxY}.${ext}`;

    // Convert dataUrl to blob
    const blob = await dataUrlToBlob(dataUrl);

    // Add to ZIP
    zip.file(filename, blob);

    console.log(`🧑‍🎨 : Added ${filename} to ZIP`);
  }

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({ type: "blob" });

  console.log(
    `🧑‍🎨 : ZIP generated, size: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`
  );

  return zipBlob;
};

/**
 * Parse filename to extract layerOrder, draw position and title
 * Expected format: {layerOrder}_{title}_{TLX}_{TLY}_{PxX}_{PxY}.{ext}
 * Empty title format: {layerOrder}__{TLX}_{TLY}_{PxX}_{PxY}.{ext}
 */
const parseFilename = (
  filename: string
): {
  title: string;
  drawPosition: DrawPosition;
  layerOrder?: number;
} | null => {
  // Remove directory path if present
  const basename = filename.split("/").pop()!;

  // Try pattern with layerOrder and NO title first: {number}__{number}_{number}_{number}_{number}.{ext}
  const patternNoTitle =
    /^(\d+)__(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
  const matchNoTitle = basename.match(patternNoTitle);

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

  // Try pattern with layerOrder and title: {number}_{non-underscore-chars}_{number}_{number}_{number}_{number}.{ext}
  const patternWithTitle =
    /^(\d+)_([^_]+)_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
  const matchWithTitle = basename.match(patternWithTitle);

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

  // Fallback: Old format without layerOrder: {anything}_{number}_{number}_{number}_{number}.{ext}
  const patternOld =
    /^(.+?)_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
  const matchOld = basename.match(patternOld);

  if (!matchOld) return null;

  const [, titlePart, TLX, TLY, PxX, PxY] = matchOld;

  // Clean up title (remove "image_N" if it was auto-generated)
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
    // No layerOrder for old format
  };
};

/**
 * Import gallery items from ZIP and save to IndexedDB directly
 * Simple, error-tolerant, memory-safe
 */
export const importGalleryFromZip = async (
  zipFile: File
): Promise<{ success: number; failed: number }> => {
  const repo = await initGalleryRepository();
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.entries(zip.files);

  console.log(`🧑‍🎨 : Loading ZIP with ${entries.length} files`);

  // Collect valid items with metadata (no dataUrl yet)
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

  // Process one by one, continue on error
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
  return { success, failed };
}

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
