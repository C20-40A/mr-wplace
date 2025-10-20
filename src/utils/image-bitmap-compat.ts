/**
 * ImageBitmap compatibility utilities
 * 
 * Provides wrapper functions for createImageBitmap with common options
 * and potential future fallback support for older browsers
 */

type ImageSource = 
  | HTMLImageElement 
  | Blob 
  | ImageData 
  | HTMLCanvasElement 
  | OffscreenCanvas
  | ImageBitmap;

interface ResizeOptions {
  width: number;
  height: number;
  quality?: "pixelated" | "low" | "medium" | "high";
}

interface CropOptions {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Standard ImageBitmap creation with premultiplyAlpha: "none"
 * Use this for all basic conversions to maintain color accuracy
 */
export const createCleanImageBitmap = async (
  source: ImageSource
): Promise<ImageBitmap> => {
  return await createImageBitmap(source, { premultiplyAlpha: "none" });
};

/**
 * Create ImageBitmap with resize
 * Common pattern for image scaling operations
 */
export const createResizedImageBitmap = async (
  source: Exclude<ImageSource, ImageBitmap>,
  options: ResizeOptions
): Promise<ImageBitmap> => {
  return await createImageBitmap(source, {
    resizeWidth: options.width,
    resizeHeight: options.height,
    resizeQuality: options.quality || "high",
    premultiplyAlpha: "none",
  });
};

/**
 * Create ImageBitmap with cropping
 * Common pattern for tile splitting operations
 */
export const createCroppedImageBitmap = async (
  source: ImageBitmap,
  options: CropOptions
): Promise<ImageBitmap> => {
  return await createImageBitmap(
    source,
    options.sx,
    options.sy,
    options.sw,
    options.sh,
    { premultiplyAlpha: "none" }
  );
};

/**
 * Ensure source is ImageBitmap
 * Converts File/Blob to ImageBitmap if needed
 */
export const ensureImageBitmap = async (
  source: File | Blob | ImageBitmap
): Promise<ImageBitmap> => {
  return source instanceof ImageBitmap 
    ? source 
    : await createCleanImageBitmap(source);
};

/**
 * Create ImageBitmap from ImageData
 * Common pattern for canvas processing results
 */
export const createImageBitmapFromImageData = async (
  imageData: ImageData
): Promise<ImageBitmap> => {
  return await createImageBitmap(imageData, { premultiplyAlpha: "none" });
};

/**
 * Create ImageBitmap from Canvas
 * Common pattern for final rendering results
 */
export const createImageBitmapFromCanvas = async (
  canvas: HTMLCanvasElement | OffscreenCanvas
): Promise<ImageBitmap> => {
  return await createImageBitmap(canvas, { premultiplyAlpha: "none" });
};
