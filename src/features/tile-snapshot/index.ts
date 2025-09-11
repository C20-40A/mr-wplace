export class TileSnapshot {
  // スナップショット削除（インデックス対応）
  async deleteSnapshot(snapshotId: string): Promise<void> {
    try {
      const snapshotKey = `${TileSnapshot.SNAPSHOT_PREFIX}${snapshotId}`;
      
      // 実画像データ削除
      await chrome.storage.local.remove(snapshotKey);
      
      // インデックス更新
      const { TimeTravelStorage } = await import('../time-travel/storage');
      await TimeTravelStorage.removeSnapshotFromIndex(snapshotKey);
      
      console.log(`Deleted snapshot: ${snapshotId}`);
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
      throw error;
    }
  }
  private static readonly TMP_PREFIX = 'tile_tmp_';
  private static readonly SNAPSHOT_PREFIX = 'tile_snapshot_';

  async saveTmpTile(tileX: number, tileY: number, blob: Blob): Promise<void> {
    try {
      const key = `${TileSnapshot.TMP_PREFIX}${tileX}_${tileY}`;
      const arrayBuffer = await blob.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));
      
      await chrome.storage.local.set({ [key]: data });
      console.log(`Saved tmp tile: ${tileX},${tileY}`);
    } catch (error) {
      console.error('Failed to save tmp tile:', error);
    }
  }

  async saveSnapshot(tileX: number, tileY: number): Promise<string> {
    try {
      const tmpKey = `${TileSnapshot.TMP_PREFIX}${tileX}_${tileY}`;
      const result = await chrome.storage.local.get(tmpKey);
      
      if (!result[tmpKey]) {
        throw new Error(`No tmp data found for tile ${tileX},${tileY}`);
      }

      const timestamp = Date.now();
      const snapshotId = `${timestamp}_${tileX}_${tileY}`;
      const snapshotKey = `${TileSnapshot.SNAPSHOT_PREFIX}${snapshotId}`;
      
      // 実画像データ保存
      await chrome.storage.local.set({ [snapshotKey]: result[tmpKey] });
      
      // インデックス更新
      const { TimeTravelStorage } = await import('../time-travel/storage');
      await TimeTravelStorage.addSnapshotToIndex({
        id: snapshotId,
        fullKey: snapshotKey,
        timestamp,
        tileX,
        tileY
      });
      
      console.log(`Saved snapshot: ${snapshotId}`);
      
      return snapshotId;
    } catch (error) {
      console.error('Failed to save snapshot:', error);
      throw error;
    }
  }

  async loadSnapshot(snapshotId: string): Promise<Blob> {
    try {
      const key = `${TileSnapshot.SNAPSHOT_PREFIX}${snapshotId}`;
      const result = await chrome.storage.local.get(key);
      
      if (!result[key]) {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }

      const uint8Array = new Uint8Array(result[key]);
      return new Blob([uint8Array], { type: 'image/png' });
    } catch (error) {
      console.error('Failed to load snapshot:', error);
      throw error;
    }
  }
}