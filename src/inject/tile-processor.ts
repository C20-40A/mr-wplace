/**
 * Tile overlay processor running in page context
 * Handles image overlay rendering using Canvas API to avoid Firefox extension context security issues
 */

import type { GalleryImage } from "./types";

const TILE_SIZE = 1000;

/**
 * Check if an image overlaps with a specific tile
 */
const imageOverlapsTile = (
  img: GalleryImage,
  tileX: number,
  tileY: number,
  imgWidth: number,
  imgHeight: number
): boolean => {
  const imgStartX = img.drawPosition.TLX;
  const imgStartY = img.drawPosition.TLY;
  const imgStartPxX = img.drawPosition.PxX;
  const imgStartPxY = img.drawPosition.PxY;

  // Calculate which tiles this image spans
  const imgEndPx = imgStartPxX + imgWidth;
  const imgEndPy = imgStartPxY + imgHeight;
  const imgEndTileX = imgStartX + Math.floor(imgEndPx / TILE_SIZE);
  const imgEndTileY = imgStartY + Math.floor(imgEndPy / TILE_SIZE);

  // Check if this tile is within the image's tile range
  return (
    tileX >= imgStartX &&
    tileX <= imgEndTileX &&
    tileY >= imgStartY &&
    tileY <= imgEndTileY
  );
};

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

  // Load all images first to get their dimensions
  const imageDataMap = new Map<string, { img: HTMLImageElement; data: GalleryImage }>();

  for (const [key, imgData] of galleryImages.entries()) {
    const img = new Image();
    img.src = imgData.dataUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image ${key}`));
    });

    imageDataMap.set(key, { img, data: imgData });
  }

  // Find images that overlap with this tile
  const targetImages: Array<{
    key: string;
    img: HTMLImageElement;
    data: GalleryImage;
  }> = [];

  for (const [key, { img, data }] of imageDataMap.entries()) {
    if (imageOverlapsTile(data, tileX, tileY, img.width, img.height)) {
      targetImages.push({ key, img, data });
    }
  }

  if (targetImages.length === 0) {
    return tileBlob;
  }

  // Sort by layer order
  targetImages.sort((a, b) => a.data.layerOrder - b.data.layerOrder);

  console.log(`🧑‍🎨 : Processing tile (${tileX},${tileY}) with ${targetImages.length} overlays`);

  // Create canvas for compositing
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.imageSmoothingEnabled = false;

  // Draw base tile
  const tileImg = await createImageBitmap(tileBlob);
  ctx.drawImage(tileImg, 0, 0, canvas.width, canvas.height);

  // Draw overlay images
  for (const { key, img: overlayImg, data } of targetImages) {
    try {
      // Calculate the portion of the image to draw on this tile
      const imgStartX = data.drawPosition.TLX;
      const imgStartY = data.drawPosition.TLY;
      const imgStartPxX = data.drawPosition.PxX;
      const imgStartPxY = data.drawPosition.PxY;

      // Calculate absolute pixel position of the image
      const absoluteImgX = imgStartX * TILE_SIZE + imgStartPxX;
      const absoluteImgY = imgStartY * TILE_SIZE + imgStartPxY;

      // Calculate absolute pixel position of this tile
      const absoluteTileX = tileX * TILE_SIZE;
      const absoluteTileY = tileY * TILE_SIZE;

      // Calculate the source rectangle from the image
      const srcX = Math.max(0, absoluteTileX - absoluteImgX);
      const srcY = Math.max(0, absoluteTileY - absoluteImgY);
      const srcW = Math.min(overlayImg.width - srcX, TILE_SIZE);
      const srcH = Math.min(overlayImg.height - srcY, TILE_SIZE);

      // Calculate the destination position on the canvas
      const destX = Math.max(0, absoluteImgX - absoluteTileX);
      const destY = Math.max(0, absoluteImgY - absoluteTileY);

      // Draw the cropped portion of the image
      ctx.drawImage(
        overlayImg,
        srcX, srcY, srcW, srcH,  // source rectangle
        destX, destY, srcW, srcH  // destination rectangle
      );

      console.log(`🧑‍🎨 : Drew overlay ${key} at tile (${tileX},${tileY}), src: (${srcX},${srcY},${srcW},${srcH}), dest: (${destX},${destY})`);
    } catch (error) {
      console.error(`🧑‍🎨 : Failed to draw overlay ${key}:`, error);
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
