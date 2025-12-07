/**
 * Thumbnail generation utilities
 */

/**
 * Generate a 128x128 thumbnail from a blob
 */
export const generateThumbnail = async (
  blob: Blob,
  size: number = 128
): Promise<string> => {
  // Create ImageBitmap from blob
  const bitmap = await createImageBitmap(blob);

  // Calculate aspect ratio
  const aspectRatio = bitmap.width / bitmap.height;
  let targetWidth = size;
  let targetHeight = size;

  if (aspectRatio > 1) {
    // Landscape
    targetHeight = Math.round(size / aspectRatio);
  } else {
    // Portrait
    targetWidth = Math.round(size * aspectRatio);
  }

  // Create canvas for thumbnail
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    bitmap.close();
    throw new Error("Failed to get 2d context");
  }

  // Draw scaled image
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  // Convert to data URL
  return canvas.toDataURL("image/png");
};

/**
 * Generate thumbnail from data URL
 */
export const generateThumbnailFromDataUrl = async (
  dataUrl: string,
  size: number = 128
): Promise<string> => {
  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  return generateThumbnail(blob, size);
};
