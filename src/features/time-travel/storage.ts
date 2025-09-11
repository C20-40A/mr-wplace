export interface TileSnapshotInfo {
  tileX: number;
  tileY: number;
  count: number;
  snapshots: SnapshotInfo[];
}

export interface SnapshotInfo {
  id: string;
  fullKey: string;
  timestamp: number;
  tileX: number;
  tileY: number;
}

export class TimeTravelStorage {
  // 全スナップショット保有タイル一覧取得（最適化版）
  static async getAllTilesWithSnapshots(): Promise<TileSnapshotInfo[]> {
    console.time('getAllTilesWithSnapshots');
    
    // スナップショットキーのみ取得（最適化）
    const result = await chrome.storage.local.get(null);
    const snapshotKeys = Object.keys(result).filter(key => key.startsWith('tile_snapshot_'));
    
    console.log(`Found ${snapshotKeys.length} snapshot keys out of ${Object.keys(result).length} total keys`);
    
    const tileMap = new Map<string, SnapshotInfo[]>();
    
    // スナップショットキー検索（フィルター済み）
    for (const key of snapshotKeys) {
      const parts = key.split('_');
      if (parts.length >= 5) {
        const timestamp = parseInt(parts[2]);
        const tileX = parseInt(parts[3]);
        const tileY = parseInt(parts[4]);
        const tileKey = `${tileX}_${tileY}`;
        
        const snapshot: SnapshotInfo = {
          id: key.replace('tile_snapshot_', ''),
          fullKey: key,
          timestamp,
          tileX,
          tileY
        };
        
        if (!tileMap.has(tileKey)) {
          tileMap.set(tileKey, []);
        }
        tileMap.get(tileKey)!.push(snapshot);
      }
    }
    
    // TileSnapshotInfo配列生成
    const tiles: TileSnapshotInfo[] = [];
    for (const [tileKey, snapshots] of tileMap.entries()) {
      const [tileX, tileY] = tileKey.split('_').map(Number);
      snapshots.sort((a, b) => b.timestamp - a.timestamp); // 新しい順
      
      tiles.push({
        tileX,
        tileY,
        count: snapshots.length,
        snapshots
      });
    }
    
    // タイル座標順でソート
    tiles.sort((a, b) => {
      if (a.tileX !== b.tileX) return a.tileX - b.tileX;
      return a.tileY - b.tileY;
    });
    
    console.timeEnd('getAllTilesWithSnapshots');
    return tiles;
  }

  // 特定タイルのスナップショット一覧取得（既存関数流用・整理）
  static async getSnapshotsForTile(tileX: number, tileY: number): Promise<SnapshotInfo[]> {
    const result = await chrome.storage.local.get(null);
    const snapshots: SnapshotInfo[] = [];
    
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith('tile_snapshot_') && key.includes(`_${tileX}_${tileY}`)) {
        const timestamp = parseInt(key.split('_')[2]);
        snapshots.push({
          id: key.replace('tile_snapshot_', ''),
          fullKey: key,
          timestamp,
          tileX,
          tileY
        });
      }
    }
    
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }
}
