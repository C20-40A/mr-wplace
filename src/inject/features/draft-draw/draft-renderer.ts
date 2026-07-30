import { TILE_DRAW_CONSTANTS } from "@/inject/features/tile-draw/constants";
import {
  overlayLayers,
  removeOverlayImageByKey,
} from "@/inject/features/tile-draw/states";
import { refreshFrontTileLayer } from "@/inject/features/map-instance";
import { getDraftTile, getDraftTileKeys } from "./draft-store";

/**
 * Draft overlay renderer
 *
 * 下書き pixel を tile 単位の ImageBitmap へ焼き、既存の overlayLayers 経路に載せる。
 * gallery / text-layer と同じパイプラインなので合成側の変更は不要。
 */

const TILE_SIZE = TILE_DRAW_CONSTANTS.TILE_SIZE;

/** overlay 上で下書きレイヤーを識別するための prefix */
const DRAFT_KEY_PREFIX = "mr-wplace-draft:";

export const toDraftImageKey = (tileKey: string): string =>
  `${DRAFT_KEY_PREFIX}${tileKey}`;

export const isDraftImageKey = (imageKey: string): boolean =>
  imageKey.startsWith(DRAFT_KEY_PREFIX);

/** 下書き由来の overlay レイヤーをすべて除去 */
export const removeAllDraftOverlays = (): void => {
  for (const layer of [...overlayLayers]) {
    if (isDraftImageKey(layer.imageKey)) removeOverlayImageByKey(layer.imageKey);
  }
};

const parseTileKey = (tileKey: string): [number, number] | null => {
  const [x, y] = tileKey.split(",");
  const tileX = Number(x);
  const tileY = Number(y);
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;
  return [tileX, tileY];
};

/**
 * 1 tile 分の下書きを ImageBitmap 化。
 * pixel が無ければ null。
 */
const renderTileBitmap = async (
  tileKey: string
): Promise<ImageBitmap | null> => {
  const tile = getDraftTile(tileKey);
  if (!tile || tile.size === 0) return null;

  const imageData = new ImageData(TILE_SIZE, TILE_SIZE);
  const data = imageData.data;

  for (const pixel of tile.values()) {
    const { pixelX, pixelY } = pixel;
    if (pixelX < 0 || pixelX >= TILE_SIZE) continue;
    if (pixelY < 0 || pixelY >= TILE_SIZE) continue;

    const offset = (pixelY * TILE_SIZE + pixelX) * 4;
    data[offset] = pixel.r;
    data[offset + 1] = pixel.g;
    data[offset + 2] = pixel.b;
    data[offset + 3] = 255;
  }

  return createImageBitmap(imageData);
};

/**
 * 指定 tile の下書き overlay を再構築。
 * 空になった tile は overlay から除去する。
 */
const syncTile = async (tileKey: string): Promise<void> => {
  const imageKey = toDraftImageKey(tileKey);
  const parsed = parseTileKey(tileKey);
  if (!parsed) return;

  const bitmap = await renderTileBitmap(tileKey);
  if (!bitmap) {
    removeOverlayImageByKey(imageKey);
    return;
  }

  const [tileX, tileY] = parsed;

  // tile 全面を 1 枚の bitmap として登録するので pixel offset は 0,0 固定。
  // split 処理を通さず直接差し込むことで、毎回の再分割コストを避ける。
  removeOverlayImageByKey(imageKey);
  overlayLayers.push({
    coords: [tileX, tileY, 0, 0],
    tiles: { [tileKey]: bitmap },
    imageKey,
    drawEnabled: true,
    affectedTiles: [tileKey],
    affectedTileSet: new Set([tileKey]),
  });
};

/** 変更のあった tile だけ再描画して front layer を更新 */
export const syncDraftTiles = async (tileKeys: string[]): Promise<void> => {
  if (tileKeys.length === 0) return;

  await Promise.all(tileKeys.map((tileKey) => syncTile(tileKey)));
  refreshFrontTileLayer();
};

/** 全下書きを描き直す (モード ON 時の復元用) */
export const syncAllDraftTiles = async (): Promise<void> => {
  await syncDraftTiles(getDraftTileKeys());
};
