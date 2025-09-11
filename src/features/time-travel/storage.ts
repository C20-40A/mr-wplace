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

interface SnapshotIndex {
  snapshots: SnapshotInfo[];
  lastUpdated: number;
}

export class TimeTravelStorage {
  private static readonly INDEX_KEY = "tile_snapshots_index";

  // 全スナップショット保有タイル一覧取得（インデックス最適化版）
  static async getAllTilesWithSnapshots(): Promise<TileSnapshotInfo[]> {
    console.time("getAllTilesWithSnapshots");

    // 1. インデックス取得
    const indexResult = await chrome.storage.local.get([this.INDEX_KEY]);

    // 2. インデックス未作成 → 従来方式で全取得+インデックス作成
    if (!indexResult[this.INDEX_KEY]) {
      return this.createIndexAndGetAll();
    }

    // 3. インデックスから高速構築
    const index: SnapshotIndex = indexResult[this.INDEX_KEY];
    const tileMap = new Map<string, SnapshotInfo[]>();

    for (const snapshot of index.snapshots) {
      const tileKey = `${snapshot.tileX}_${snapshot.tileY}`;
      if (!tileMap.has(tileKey)) {
        tileMap.set(tileKey, []);
      }
      tileMap.get(tileKey)!.push(snapshot);
    }

    const tiles: TileSnapshotInfo[] = [];
    for (const [tileKey, snapshots] of tileMap.entries()) {
      const [tileX, tileY] = tileKey.split("_").map(Number);
      snapshots.sort((a, b) => b.timestamp - a.timestamp);

      tiles.push({
        tileX,
        tileY,
        count: snapshots.length,
        snapshots,
      });
    }

    tiles.sort((a, b) => {
      if (a.tileX !== b.tileX) return a.tileX - b.tileX;
      return a.tileY - b.tileY;
    });

    console.timeEnd("getAllTilesWithSnapshots");
    return tiles;
  }

  private static async createIndexAndGetAll(): Promise<TileSnapshotInfo[]> {
    // 従来方式: 全キー取得（初回のみ）
    const result = await chrome.storage.local.get(null);
    const snapshotKeys = Object.keys(result).filter((key) =>
      key.startsWith("tile_snapshot_")
    );

    console.log(`Creating index from ${snapshotKeys.length} snapshots`);

    const snapshots: SnapshotInfo[] = [];
    const tileMap = new Map<string, SnapshotInfo[]>();

    for (const key of snapshotKeys) {
      const parts = key.split("_");
      if (parts.length >= 5) {
        const timestamp = parseInt(parts[2]);
        const tileX = parseInt(parts[3]);
        const tileY = parseInt(parts[4]);
        const tileKey = `${tileX}_${tileY}`;

        const snapshot: SnapshotInfo = {
          id: key.replace("tile_snapshot_", ""),
          fullKey: key,
          timestamp,
          tileX,
          tileY,
        };

        snapshots.push(snapshot);

        if (!tileMap.has(tileKey)) {
          tileMap.set(tileKey, []);
        }
        tileMap.get(tileKey)!.push(snapshot);
      }
    }

    // インデックス作成
    const index: SnapshotIndex = {
      snapshots: snapshots.sort((a, b) => b.timestamp - a.timestamp),
      lastUpdated: Date.now(),
    };
    await chrome.storage.local.set({ [this.INDEX_KEY]: index });

    // TileSnapshotInfo配列生成
    const tiles: TileSnapshotInfo[] = [];
    for (const [tileKey, snapshotList] of tileMap.entries()) {
      const [tileX, tileY] = tileKey.split("_").map(Number);
      snapshotList.sort((a, b) => b.timestamp - a.timestamp);

      tiles.push({
        tileX,
        tileY,
        count: snapshotList.length,
        snapshots: snapshotList,
      });
    }

    return tiles.sort((a, b) => {
      if (a.tileX !== b.tileX) return a.tileX - b.tileX;
      return a.tileY - b.tileY;
    });
  }

  // 特定タイルのスナップショット一覧取得（インデックス最適化版）
  static async getSnapshotsForTile(
    tileX: number,
    tileY: number
  ): Promise<SnapshotInfo[]> {
    const indexResult = await chrome.storage.local.get([this.INDEX_KEY]);

    if (!indexResult[this.INDEX_KEY]) {
      // インデックス未作成の場合は従来方式
      const result = await chrome.storage.local.get(null);
      const snapshots: SnapshotInfo[] = [];

      for (const [key, value] of Object.entries(result)) {
        if (
          key.startsWith("tile_snapshot_") &&
          key.includes(`_${tileX}_${tileY}`)
        ) {
          const timestamp = parseInt(key.split("_")[2]);
          snapshots.push({
            id: key.replace("tile_snapshot_", ""),
            fullKey: key,
            timestamp,
            tileX,
            tileY,
          });
        }
      }

      return snapshots.sort((a, b) => b.timestamp - a.timestamp);
    }

    // インデックスから高速取得
    const index: SnapshotIndex = indexResult[this.INDEX_KEY];
    return index.snapshots
      .filter(
        (snapshot) => snapshot.tileX === tileX && snapshot.tileY === tileY
      )
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // 新規スナップショット追加時のインデックス更新
  static async addSnapshotToIndex(snapshot: SnapshotInfo): Promise<void> {
    const indexResult = await chrome.storage.local.get([this.INDEX_KEY]);
    const index: SnapshotIndex = indexResult[this.INDEX_KEY] || {
      snapshots: [],
      lastUpdated: 0,
    };

    index.snapshots.unshift(snapshot);
    index.lastUpdated = Date.now();

    await chrome.storage.local.set({ [this.INDEX_KEY]: index });
  }

  // スナップショット削除時のインデックス更新
  static async removeSnapshotFromIndex(fullKey: string): Promise<void> {
    await chrome.storage.local.remove(fullKey);

    const indexResult = await chrome.storage.local.get([this.INDEX_KEY]);
    if (!indexResult[this.INDEX_KEY]) return;

    const index: SnapshotIndex = indexResult[this.INDEX_KEY];
    index.snapshots = index.snapshots.filter(
      (snapshot) => snapshot.fullKey !== fullKey
    );
    index.lastUpdated = Date.now();

    await chrome.storage.local.set({ [this.INDEX_KEY]: index });
  }
}
