import { drawOverlayLayersOnTile, getOriginalBlob } from "../../tile-draw";
import { markFrontTileComparisonPending } from "./index";

const FAKE_TILE_PROTOCOL = "mr-wplace-overlay";

/**
 * Handle custom protocol tile requests for front layer
 * Pattern: mr-wplace-overlay://{z}/{x}/{y}.png
 */
export const handleFrontLayerTileRequest = async (
  url: string
): Promise<Response> => {
  // Extract z, x, y from URL
  const tileMatch = url.match(/(\d+)\/(\d+)\/(\d+)\.png/);
  if (!tileMatch) {
    return createEmptyTileResponse();
  }

  const z = parseInt(tileMatch[1], 10);
  const x = parseInt(tileMatch[2], 10);
  const y = parseInt(tileMatch[3], 10);

  // Only support zoom level 11
  if (z !== 11) {
    return createEmptyTileResponse();
  }

  try {
    // Create transparent background blob (1000x1000)
    const emptyBlob = await createTransparentTileBlob();
    const cacheKey = `${x},${y}`;
    const comparisonTileBlob = getOriginalBlob(cacheKey);

    // Comparison background is not ready yet.
    // Defer rendering for this tile until original tile arrives.
    if (!comparisonTileBlob) {
      markFrontTileComparisonPending(x, y);
      return createTransparentTileResponse(emptyBlob);
    }

    // Render on transparent layer, but compare against the original tile if available
    const blob = await drawOverlayLayersOnTile(emptyBlob, [x, y], "gpu", {
      comparisonTileBlob,
    });

    return new Response(blob, {
      status: 200,
      headers: new Headers({
        "Content-Type": "image/png",
        "Cache-Control": "no-cache",
      }),
    });
  } catch (error) {
    console.error("🧑‍🎨 : Failed to render front layer tile:", error);
    return createEmptyTileResponse();
  }
};

/**
 * Create transparent 1000x1000 tile blob for background
 */
const createTransparentTileBlob = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(1000, 1000);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");

  // Fill with transparent
  ctx.clearRect(0, 0, 1000, 1000);

  return await canvas.convertToBlob({ type: "image/png" });
};

const createTransparentTileResponse = (blob: Blob): Response => {
  return new Response(blob, {
    status: 200,
    headers: new Headers({
      "Content-Type": "image/png",
      "Cache-Control": "no-cache",
    }),
  });
};

/**
 * Create empty transparent tile response (1x1 fallback)
 */
const createEmptyTileResponse = (): Response => {
  // 1x1 transparent PNG
  const emptyPng = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
    0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84,
    120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 46, 180, 0, 0, 0, 0, 73, 69, 78,
    68, 174, 66, 96, 130,
  ]);

  return new Response(emptyPng.buffer, {
    status: 200,
    headers: new Headers({
      "Content-Type": "image/png",
      "Cache-Control": "no-cache",
    }),
  });
};

/**
 * Check if URL is a front layer tile request
 */
export const isFrontLayerTileRequest = (url: string): boolean => {
  return url.startsWith(`${FAKE_TILE_PROTOCOL}://`);
};
