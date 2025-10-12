// タイルを取得したら、ここに保持する
// 描画対象を決めるためだと思うが、効果は不明

const currentTiles: Set<string> = new Set();
//  readonly MAX_TILE_HISTORY = 50;

export const addCurrentTile = (tileX: number, tileY: number): void => {
  const tileKey = `${tileX},${tileY}`;
  currentTiles.add(tileKey);
};

export const getCurrentTiles = (): Set<string> => {
  return new Set(currentTiles);
};
