import JSZip from "jszip";
import type { GalleryItem, DrawPosition } from "@/features/gallery/storage";

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

  console.log(
    `🧑‍🎨 : Exporting ${itemsToExport.length} images to ZIP`
  );

  // Add images to ZIP
  for (const item of itemsToExport) {
    const { TLX, TLY, PxX, PxY } = item.drawPosition!;
    const layerOrder = item.layerOrder ?? 0;

    // Generate filename
    const titlePart = item.title ? sanitizeTitle(item.title) : "";
    const ext = getExtensionFromDataUrl(item.dataUrl);
    const filename = titlePart
      ? `${layerOrder}_${titlePart}_${TLX}_${TLY}_${PxX}_${PxY}.${ext}`
      : `${layerOrder}__${TLX}_${TLY}_${PxX}_${PxY}.${ext}`;

    // Convert dataUrl to blob
    const blob = await dataUrlToBlob(item.dataUrl);

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
): { title: string; drawPosition: DrawPosition; layerOrder?: number } | null => {
  // Remove directory path if present
  const basename = filename.split("/").pop()!;

  // Try pattern with layerOrder and NO title first: {number}__{number}_{number}_{number}_{number}.{ext}
  const patternNoTitle = /^(\d+)__(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
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
  const patternWithTitle = /^(\d+)_([^_]+)_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
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
  const patternOld = /^(.+?)_(-?\d+)_(-?\d+)_(-?\d+)_(-?\d+)\.(png|jpg|jpeg|webp)$/i;
  const matchOld = basename.match(patternOld);

  if (!matchOld) return null;

  const [, titlePart, TLX, TLY, PxX, PxY] = matchOld;

  // Clean up title (remove "image_N" if it was auto-generated)
  const title = titlePart.match(/^image_\d+$/) ? "" : titlePart.replace(/_/g, " ");

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
 * Import gallery items from a ZIP file
 * Returns array of items ready to be saved to storage
 */
export const importGalleryFromZip = async (
  zipFile: File
): Promise<
  Array<{
    dataUrl: string;
    title?: string;
    drawPosition: DrawPosition;
    layerOrder?: number;
  }>
> => {
  const zip = await JSZip.loadAsync(zipFile);

  const items: Array<{
    dataUrl: string;
    title?: string;
    drawPosition: DrawPosition;
    layerOrder?: number;
  }> = [];

  console.log(
    `🧑‍🎨 : Loading ZIP with ${Object.keys(zip.files).length} files`
  );

  // Process each file in ZIP
  for (const [filename, file] of Object.entries(zip.files)) {
    // Skip directories and hidden files
    if (file.dir || filename.startsWith(".") || filename.startsWith("__MACOSX")) {
      continue;
    }

    // Check if it's an image file
    if (!/\.(png|jpg|jpeg|webp)$/i.test(filename)) {
      console.warn(`🧑‍🎨 : Skipping non-image file: ${filename}`);
      continue;
    }

    // Parse filename to extract draw position
    const parsed = parseFilename(filename);
    if (!parsed) {
      console.warn(
        `🧑‍🎨 : Skipping file with invalid format: ${filename}`
      );
      continue;
    }

    // Read image data
    const blob = await file.async("blob");
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    items.push({
      dataUrl,
      title: parsed.title || undefined,
      drawPosition: parsed.drawPosition,
      layerOrder: parsed.layerOrder,
    });

    console.log(
      `🧑‍🎨 : Imported ${filename} → layerOrder: ${parsed.layerOrder ?? "auto"}, title: "${parsed.title}", pos: ${parsed.drawPosition.TLX},${parsed.drawPosition.TLY}`
    );
  }

  if (items.length === 0) {
    throw new Error("No valid images found in ZIP file");
  }

  // Sort by layerOrder if available
  items.sort((a, b) => {
    if (a.layerOrder !== undefined && b.layerOrder !== undefined) {
      return a.layerOrder - b.layerOrder;
    }
    // Items without layerOrder go to the end
    if (a.layerOrder === undefined && b.layerOrder !== undefined) return 1;
    if (a.layerOrder !== undefined && b.layerOrder === undefined) return -1;
    return 0;
  });

  console.log(`🧑‍🎨 : Successfully imported ${items.length} images`);

  return items;
};

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
