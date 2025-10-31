import { WplaceCoords } from "../constants";

/**
 * Inject-safe version of splitImageOnTiles
 * Uses native Canvas API instead of WASM-based image-bitmap-compat
 */
export const splitImageOnTilesInject = async ({
  source,
  coords,
  tileSize,
}: {
  source: ImageBitmap | HTMLImageElement;
  coords: WplaceCoords;
  tileSize: number;
}): Promise<{ preparedOverlayImages: Record<string, ImageBitmap> }> => {
  // Get source dimensions
  const w = source instanceof ImageBitmap ? source.width : source.naturalWidth;
  const h = source instanceof ImageBitmap ? source.height : source.naturalHeight;
  const preparedOverlayImages: Record<string, ImageBitmap> = {};

  for (let py = coords[3]; py < h + coords[3]; ) {
    const drawH = Math.min(tileSize - (py % tileSize), h - (py - coords[3]));

    for (let px = coords[2]; px < w + coords[2]; ) {
      const drawW = Math.min(tileSize - (px % tileSize), w - (px - coords[2]));

      // Use native Canvas API for cropping (no WASM)
      const canvas = document.createElement('canvas');
      canvas.width = drawW;
      canvas.height = drawH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Draw the cropped portion
      ctx.drawImage(
        source,
        px - coords[2], // sx
        py - coords[3], // sy
        drawW,           // sw
        drawH,           // sh
        0,               // dx
        0,               // dy
        drawW,           // dw
        drawH            // dh
      );

      // Convert to ImageBitmap
      const cropped = await createImageBitmap(canvas);

      const tx = coords[0] + Math.floor(px / 1000);
      const ty = coords[1] + Math.floor(py / 1000);
      const tileName = `${tx.toString().padStart(4, "0")},${ty
        .toString()
        .padStart(4, "0")},${(px % 1000).toString().padStart(3, "0")},${(
        py % 1000
      )
        .toString()
        .padStart(3, "0")}`;

      preparedOverlayImages[tileName] = cropped;

      px += drawW;
    }
    py += drawH;
  }

  return { preparedOverlayImages };
};
