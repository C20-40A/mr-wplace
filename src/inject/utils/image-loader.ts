/**
 * Common image loading utilities for inject context
 */

/**
 * Load image from dataUrl and convert to ImageBitmap
 * @param dataUrl - Image data URL
 * @param key - Image key for error messages
 * @param timeout - Timeout in milliseconds (default: 5000)
 * @returns ImageBitmap
 */
export const loadImageBitmap = async (
  dataUrl: string,
  key: string,
  timeout = 5000
): Promise<ImageBitmap> => {
  const imageElement = new Image();
  imageElement.src = dataUrl;

  await new Promise<void>((resolve, reject) => {
    imageElement.onload = () => resolve();
    imageElement.onerror = (e) => reject(new Error(`Failed to load image ${key}: ${e}`));
    setTimeout(() => reject(new Error(`Timeout loading image ${key}`)), timeout);
  });

  return createImageBitmap(imageElement);
};
