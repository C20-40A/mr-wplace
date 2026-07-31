import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";
import { getOriginalBlob } from "@/inject/features/tile-draw/last-modified-cache";

/**
 * Draft base layer reader
 *
 * バケツ塗りの「壁」として wplace 本体のタイル (下地) を参照するための読み取り口。
 *
 * 設計上の要点:
 * - flood fill 本体は **同期** のままにしたい (履歴/描画の呼び出し経路を変えないため)。
 *   そこで「塗る前に必要なタイルだけ先に decode しておき、以降は同期で引く」形にする。
 * - decode 済みタイルは module 内にキャッシュする。1タイル 1000x1000 = 4MB なので
 *   枚数は絞る (MAX_DECODED_TILES)。
 * - 下地タイルが未取得 (画面外/未 fetch) の場合は null。呼び出し側は
 *   「下地なし = 壁でもない」として扱う。
 */

const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;

/** decode 済みタイルの保持枚数。1枚 4MB なので増やしすぎない */
const MAX_DECODED_TILES = 9;

type DecodedTile = {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

/** tileKey = "tx,ty" */
const decoded = new Map<string, DecodedTile>();

const toTileKey = (tileX: number, tileY: number): string => `${tileX},${tileY}`;

const decodeTile = async (blob: Blob): Promise<DecodedTile> => {
  const bitmap = await createImageBitmap(blob);
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : Object.assign(document.createElement("canvas"), {
          width: bitmap.width,
          height: bitmap.height,
        });

  const ctx = canvas.getContext("2d") as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;
  if (!ctx) {
    bitmap.close();
    throw new Error("Failed to get base tile context");
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return {
    width: canvas.width,
    height: canvas.height,
    pixels: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  };
};

/**
 * 指定タイル群を decode してキャッシュに載せる。
 * バケツ塗りの直前に1回だけ呼ぶ想定 (以降の参照は同期)。
 * 取得できないタイル (未 fetch など) は黙って諦める。
 */
export const prepareBaseTiles = async (
  tiles: Array<{ tileX: number; tileY: number }>,
): Promise<void> => {
  await Promise.all(
    tiles.map(async ({ tileX, tileY }) => {
      const tileKey = toTileKey(tileX, tileY);
      if (decoded.has(tileKey)) return;

      const blob = getOriginalBlob(tileKey);
      if (!blob) return;

      try {
        const tile = await decodeTile(blob);
        // LRU: 一番古いものから落とす
        if (decoded.size >= MAX_DECODED_TILES) {
          const oldest = decoded.keys().next().value;
          if (oldest) decoded.delete(oldest);
        }
        decoded.set(tileKey, tile);
      } catch (error) {
        console.log("🧑‍🎨 : Failed to decode base tile", tileKey, error);
      }
    }),
  );
};

/**
 * world pixel の下地色を **同期** で返す。
 * 未 decode / 未取得 / 透明ピクセルなら null。
 */
export const getBaseColorAtWorld = (
  worldX: number,
  worldY: number,
): { r: number; g: number; b: number } | null => {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  const tile = decoded.get(toTileKey(tileX, tileY));
  if (!tile) return null;

  const pixelX = worldX - tileX * TILE_SIZE;
  const pixelY = worldY - tileY * TILE_SIZE;
  if (pixelX < 0 || pixelY < 0 || pixelX >= tile.width || pixelY >= tile.height)
    return null;

  const offset = (pixelY * tile.width + pixelX) * 4;
  // 透明は「下地なし」と同じ扱いにする (塗れる空白)
  if (tile.pixels[offset + 3] === 0) return null;

  return {
    r: tile.pixels[offset],
    g: tile.pixels[offset + 1],
    b: tile.pixels[offset + 2],
  };
};

/** 下書きモード終了時に解放する (1枚 4MB を抱えたままにしない) */
export const clearBaseTileCache = (): void => decoded.clear();
