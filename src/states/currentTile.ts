import { MAX_TMP_TILE_TRACK_SIZE } from "@/constants/time-travel";

// Snapshot captureで取得したタイル座標を一時保持する。
// TmpTileBoardが表示候補を列挙するために参照する。
// TileSnapshot.tmpTileCache と同じ上限でLRU的に古い座標を破棄し、
// 無制限にキーが増えて探索コストが悪化するのを防ぐ。

const currentTiles: Set<string> = new Set();

export const addCurrentTile = (tileX: number, tileY: number): void => {
  const tileKey = `${tileX},${tileY}`;

  // Refresh insertion order so this key becomes most-recent.
  if (currentTiles.has(tileKey)) currentTiles.delete(tileKey);
  currentTiles.add(tileKey);

  while (currentTiles.size > MAX_TMP_TILE_TRACK_SIZE) {
    const oldestKey = currentTiles.keys().next().value;
    if (!oldestKey) break;
    currentTiles.delete(oldestKey);
  }
};

export const getCurrentTiles = (): Set<string> => {
  return new Set(currentTiles);
};
