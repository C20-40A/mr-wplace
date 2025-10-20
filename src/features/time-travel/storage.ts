import { storage } from "@/utils/browser-api";

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
  name?: string;
}

interface SnapshotIndex {
  snapshots: SnapshotInfo[];
  lastUpdated: number;
}

export interface SnapshotDrawState {
  fullKey: string;
  tileX: number;
  tileY: number;
  drawEnabled: boolean;
}

export class TimeTravelStorage {
  private static readonly INDEX_KEY = "tile_snapshots_index";
  private static readonly DRAW_STATES_KEY = "timetravel_draw_states";

  // 全スナップショット保有タイル一覧取得（インデックス最適化版）
  static async getAllTilesWithSnapshots(): Promise<TileSnapshotInfo[]> {
    console.time("getAllTilesWithSnapshots");

    // 1. インデックス取得
    const indexResult = await storage.get([this.INDEX_KEY]);

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
    const result = await storage.get(null);
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
    await storage.set({ [this.INDEX_KEY]: index });

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
    const indexResult = await storage.get([this.INDEX_KEY]);

    if (!indexResult[this.INDEX_KEY]) {
      // インデックス未作成の場合は従来方式
      const result = await storage.get(null);
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
    const indexResult = await storage.get([this.INDEX_KEY]);
    const index: SnapshotIndex = indexResult[this.INDEX_KEY] || {
      snapshots: [],
      lastUpdated: 0,
    };

    index.snapshots.unshift(snapshot);
    index.lastUpdated = Date.now();

    await storage.set({ [this.INDEX_KEY]: index });
  }

  // スナップショット削除時のインデックス更新
  static async removeSnapshotFromIndex(fullKey: string): Promise<void> {
    await storage.remove(fullKey);

    const indexResult = await storage.get([this.INDEX_KEY]);
    if (!indexResult[this.INDEX_KEY]) return;

    const index: SnapshotIndex = indexResult[this.INDEX_KEY];
    index.snapshots = index.snapshots.filter(
      (snapshot) => snapshot.fullKey !== fullKey
    );
    index.lastUpdated = Date.now();

    await storage.set({ [this.INDEX_KEY]: index });
  }

  // 描画状態管理
  static async getDrawStates(): Promise<SnapshotDrawState[]> {
    const result = await storage.get([this.DRAW_STATES_KEY]);
    return result[this.DRAW_STATES_KEY] || [];
  }

  static async setDrawState(drawState: SnapshotDrawState): Promise<void> {
    const states = await this.getDrawStates();
    const index = states.findIndex((s) => s.fullKey === drawState.fullKey);

    if (index >= 0) {
      states[index] = drawState;
    } else {
      states.push(drawState);
    }

    await storage.set({ [this.DRAW_STATES_KEY]: states });
  }

  static async getActiveSnapshotForTile(
    tileX: number,
    tileY: number
  ): Promise<SnapshotDrawState | null> {
    const states = await this.getDrawStates();
    return (
      states.find(
        (s) => s.tileX === tileX && s.tileY === tileY && s.drawEnabled
      ) || null
    );
  }

  static async toggleDrawState(fullKey: string): Promise<boolean> {
    const states = await this.getDrawStates();
    const state = states.find((s) => s.fullKey === fullKey);

    if (!state) return false;

    state.drawEnabled = !state.drawEnabled;
    await storage.set({ [this.DRAW_STATES_KEY]: states });
    return state.drawEnabled;
  }

  static async restoreDrawStates(): Promise<void> {
    console.log("🧑‍🎨 : Restoring TimeTravel draw states");
    const tileOverlay = window.mrWplace?.tileOverlay;
    if (!tileOverlay?.tileDrawManager) return;

    const states = await this.getDrawStates();
    const enabledStates = states.filter((s) => s.drawEnabled);

    for (const state of enabledStates) {
      const snapshotData = await storage.get([state.fullKey]);
      const rawData = snapshotData[state.fullKey];
      if (rawData) {
        // Uint8Array → File変換
        const uint8Array = new Uint8Array(rawData);
        const blob = new Blob([uint8Array], { type: "image/png" });
        const file = new File([blob], "snapshot.png", { type: "image/png" });

        const imageKey = `snapshot_${state.fullKey}`;
        await tileOverlay.tileDrawManager.addImageToOverlayLayers(
          file,
          [state.tileX, state.tileY, 0, 0],
          imageKey
        );
      }
    }
  }

  static async isSnapshotDrawing(fullKey: string): Promise<boolean> {
    const states = await this.getDrawStates();
    const state = states.find((s) => s.fullKey === fullKey);
    return state?.drawEnabled || false;
  }

  static async drawSnapshotOnTile(
    tileX: number,
    tileY: number,
    file: File,
    fullKey: string
  ): Promise<boolean> {
    // 1. 既存の描画状態をチェックしてトグル
    const currentState = await this.getActiveSnapshotForTile(tileX, tileY);
    let newDrawEnabled: boolean;

    if (currentState && currentState.fullKey === fullKey) {
      // 同じスナップショットが既に描画中 → OFF
      newDrawEnabled = false;
    } else {
      // 別のスナップショットが描画中 OR 何も描画されていない → ON
      if (currentState) {
        // 既存の描画を削除
        const tileOverlay = window.mrWplace?.tileOverlay;
        const oldImageKey = `snapshot_${currentState.fullKey}`;
        tileOverlay?.tileDrawManager?.removePreparedOverlayImageByKey(
          oldImageKey
        );

        // 古い状態をOFFに
        await this.setDrawState({
          ...currentState,
          drawEnabled: false,
        });
      }
      newDrawEnabled = true;
    }

    // 2. 新しい描画状態を設定
    await this.setDrawState({
      fullKey,
      tileX,
      tileY,
      drawEnabled: newDrawEnabled,
    });

    // 3. TileDrawManagerに反映
    const tileOverlay = window.mrWplace?.tileOverlay;
    const imageKey = `snapshot_${fullKey}`;

    if (newDrawEnabled) {
      // 描画ON
      await tileOverlay?.tileDrawManager?.addImageToOverlayLayers(
        file,
        [tileX, tileY, 0, 0],
        imageKey
      );
    } else {
      // 描画OFF
      tileOverlay?.tileDrawManager?.removePreparedOverlayImageByKey(imageKey);
    }

    return newDrawEnabled;
  }
}
