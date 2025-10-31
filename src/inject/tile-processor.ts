/**
 * Tile overlay processor running in page context
 * Handles image overlay rendering using Canvas API to avoid Firefox extension context security issues
 */

import type { GalleryImage } from "./types";

/**
 * Process tile with overlay images in page context
 * This avoids Firefox extension context ImageBitmap security issues
 */
export const processTileWithOverlay = async (
  tileBlob: Blob,
  tileX: number,
  tileY: number
): Promise<Blob> => {
  const galleryImages = window.mrWplaceGalleryImages;

  if (!galleryImages || galleryImages.size === 0) {
    return tileBlob;
  }

  // Find images that overlay this tile
  const targetImages: GalleryImage[] = [];
  for (const [key, img] of galleryImages.entries()) {
    if (img.drawPosition.TLX === tileX && img.drawPosition.TLY === tileY) {
      targetImages.push(img);
    }
  }

  if (targetImages.length === 0) {
    return tileBlob;
  }

  // Sort by layer order
  targetImages.sort((a, b) => a.layerOrder - b.layerOrder);

  console.log(`🧑‍🎨 : Processing tile (${tileX},${tileY}) with ${targetImages.length} overlays`);

  // Create canvas for compositing
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1000;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingEnabled = false;

  // Draw base tile
  const tileImg = await createImageBitmap(tileBlob);
  ctx.drawImage(tileImg, 0, 0, canvas.width, canvas.height);

  // Draw overlay images
  for (const img of targetImages) {
    try {
      // dataUrl is already a base64 data URL or blob URL, load directly as image
      const overlayImg = new Image();
      overlayImg.src = img.dataUrl;

      // Wait for image to load
      await new Promise<void>((resolve, reject) => {
        overlayImg.onload = () => resolve();
        overlayImg.onerror = () => reject(new Error(`Failed to load image ${img.key}`));
      });

      const x = img.drawPosition.PxX;
      const y = img.drawPosition.PxY;

      ctx.drawImage(overlayImg, x, y);

      console.log(`🧑‍🎨 : Drew overlay ${img.key} at (${x}, ${y})`);
    } catch (error) {
      console.error(`🧑‍🎨 : Failed to draw overlay ${img.key}:`, error);
    }
  }

  // Convert canvas to blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert canvas to blob'));
      }
    }, 'image/png');
  });
};
