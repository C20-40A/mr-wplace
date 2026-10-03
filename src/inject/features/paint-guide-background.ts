import { blobToPixels } from "@/utils/pixel-converters";
import { getOriginalBlob } from "./tile-draw/last-modified-cache";
import type { CapturedPaintedCoordinate } from "@/inject/types";

// Share concurrent reads and retain at most four decoded background tiles.
const decodedTiles = new Map<Blob, ReturnType<typeof blobToPixels>>();

export const getBackgroundPixelRgbInt = async (
  { tileX, tileY, pixelX, pixelY }: Pick<
    CapturedPaintedCoordinate, "tileX" | "tileY" | "pixelX" | "pixelY"
  >,
): Promise<number | null> => {
  const tileKey = `${tileX},${tileY}`;
  const blob = getOriginalBlob(tileKey);
  if (!blob) return null;

  let decoded = decodedTiles.get(blob);
  if (!decoded) {
    decoded = blobToPixels(blob);
    if (decodedTiles.size >= 4)
      decodedTiles.delete(decodedTiles.keys().next().value!);
    decodedTiles.set(blob, decoded);
  }
  try {
    const { pixels, width, height } = await decoded;
    if (getOriginalBlob(tileKey) !== blob) return null;
    if (pixelX < 0 || pixelY < 0 || pixelX >= width || pixelY >= height)
      return null;
    const i = (pixelY * width + pixelX) * 4;
    if (pixels[i + 3] === 0) return null;
    return (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
  } catch {
    decodedTiles.delete(blob);
    return null;
  }
};
