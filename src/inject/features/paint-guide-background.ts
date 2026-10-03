import { blobToPixels } from "@/utils/pixel-converters";
import { getOriginalBlob } from "./tile-draw/last-modified-cache";
import type { CapturedPaintedCoordinate } from "@/inject/types";

// Share concurrent reads and retain at most four decoded background tiles.
const decodedTiles = new Map<Blob, ReturnType<typeof blobToPixels>>();
// decode 完了済みの結果（同期参照用。decodedTiles と同じ Blob をキーに持つ）
const resolvedTiles = new WeakMap<Blob, Awaited<ReturnType<typeof blobToPixels>>>();

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
    decoded.then((result) => resolvedTiles.set(blob, result), () => {});
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

/**
 * 同期版。decode 済みなら色 (透明/範囲外は null)、未 decode なら undefined を返し decode を開始する
 */
export const peekBackgroundPixelRgbInt = (
  coord: Pick<CapturedPaintedCoordinate, "tileX" | "tileY" | "pixelX" | "pixelY">,
): number | null | undefined => {
  const blob = getOriginalBlob(`${coord.tileX},${coord.tileY}`);
  if (!blob) return null;
  const resolved = resolvedTiles.get(blob);
  if (!resolved) {
    void getBackgroundPixelRgbInt(coord);
    return undefined;
  }
  const { pixels, width, height } = resolved;
  const { pixelX, pixelY } = coord;
  if (pixelX < 0 || pixelY < 0 || pixelX >= width || pixelY >= height) return null;
  const i = (pixelY * width + pixelX) * 4;
  if (pixels[i + 3] === 0) return null;
  return (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
};
