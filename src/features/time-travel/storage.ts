import { storage } from "@/utils/browser-api";
import {
  sendSnapshotsToInject,
  getAllSnapshotMetadata,
  getSnapshotMetadataByTile,
} from "@/utils/inject-bridge";

// タイルスナップショットの visible 状態を localStorage に保存するかどうか
// true: 保存する（リロード後も描画状態を維持）
// false: 保存しない（リロード後は全て非表示）
const PERSIST_DRAW_STATE = true;

export interface TileSnapshotInfo {
  tileX: number;
  tileY: number;
  count: number;
  snapshots: SnapshotInfo[];
}

export interface SnapshotInfo {
  id: string;
  fullKey: string; // Deprecated: kept for backward compatibility
  timestamp: number;
  tileX: number;
  tileY: number;
  name?: string;
}

export interface SnapshotDrawState {
  fullKey: string;
  tileX: number;
  tileY: number;
  drawEnabled: boolean;
}

export class TimeTravelStorage {
  private static readonly DRAW_STATES_KEY = "timetravel_draw_states";

  // 全スナップショット保有タイル一覧取得（IndexedDBから via bridge）
  static async getAllTilesWithSnapshots(): Promise<TileSnapshotInfo[]> {
    console.time("getAllTilesWithSnapshots");

    const allMetadata = await getAllSnapshotMetadata();

    const tileMap = new Map<string, SnapshotInfo[]>();

    for (const metadata of allMetadata) {
      const tileKey = `${metadata.tileX}_${metadata.tileY}`;
      if (!tileMap.has(tileKey)) {
        tileMap.set(tileKey, []);
      }
      tileMap.get(tileKey)!.push({
        id: metadata.id,
        fullKey: `tile_snapshot_${metadata.id}`, // Legacy compatibility
        timestamp: metadata.timestamp,
        tileX: metadata.tileX,
        tileY: metadata.tileY,
        name: metadata.name,
      });
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

  // 特定タイルのスナップショット一覧取得（IndexedDBから via bridge）
  static async getSnapshotsForTile(
    tileX: number,
    tileY: number
  ): Promise<SnapshotInfo[]> {
    const metadata = await getSnapshotMetadataByTile(tileX, tileY);

    return metadata.map((m) => ({
      id: m.id,
      fullKey: `tile_snapshot_${m.id}`, // Legacy compatibility
      timestamp: m.timestamp,
      tileX: m.tileX,
      tileY: m.tileY,
      name: m.name,
    }));
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

    // 3. 描画に反映 - inject side に通知（削除も含めて inject side で処理される）
    await sendSnapshotsToInject();

    return newDrawEnabled;
  }
}
