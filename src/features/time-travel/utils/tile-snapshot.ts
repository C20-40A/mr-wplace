export class TileSnapshot {
  // スナップショット削除（インデックス対応）
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const snapshotKey = `${TileSnapshot.SNAPSHOT_PREFIX}${snapshotId}`;

    // 実画像データ削除
    await chrome.storage.local.remove(snapshotKey);

    // インデックス更新
    const { TimeTravelStorage } = await import("../storage");
    await TimeTravelStorage.removeSnapshotFromIndex(snapshotKey);

    console.log(`Deleted snapshot: ${snapshotId}`);
  }
  private static readonly TMP_PREFIX = "tile_tmp_";
  private static readonly SNAPSHOT_PREFIX = "tile_snapshot_";

  async saveTmpTile(tileX: number, tileY: number, blob: Blob): Promise<void> {
    const key = `${TileSnapshot.TMP_PREFIX}${tileX}_${tileY}`;

    // Check image size and scale down if 3000x3000
    const processedBlob = await this.scaleDownIfNeeded(blob);

    const arrayBuffer = await processedBlob.arrayBuffer();
    const data = Array.from(new Uint8Array(arrayBuffer));

    await chrome.storage.local.set({ [key]: data });
  }

  /**
   * If the image is 3000x3000, scale it down to 1000x1000 to save storage space.
   * - skirk marbleなどと競合して、3000x3000の画像が保存されるケースがあるため。
   */
  private async scaleDownIfNeeded(blob: Blob): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.width === 3000 && img.height === 3000) {
          // Scale down to 1000x1000
          const canvas = document.createElement("canvas");
          canvas.width = 1000;
          canvas.height = 1000;
          const ctx = canvas.getContext("2d")!;
          // アンチエイリアシングを無効化する
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, 1000, 1000);
          canvas.toBlob((scaledBlob) => {
            resolve(scaledBlob || blob);
          }, "image/png");
        } else {
          resolve(blob);
        }
      };
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(blob);
    });
  }

  async saveSnapshot(
    tileX: number,
    tileY: number,
    name?: string
  ): Promise<string> {
    const tmpKey = `${TileSnapshot.TMP_PREFIX}${tileX}_${tileY}`;
    const result = await chrome.storage.local.get(tmpKey);

    if (!result[tmpKey])
      throw new Error(`No tmp data found for tile ${tileX},${tileY}`);

    const timestamp = Date.now();
    const snapshotId = `${timestamp}_${tileX}_${tileY}`;
    const snapshotKey = `${TileSnapshot.SNAPSHOT_PREFIX}${snapshotId}`;

    // 実画像データ保存
    await chrome.storage.local.set({ [snapshotKey]: result[tmpKey] });

    // インデックス更新
    const { TimeTravelStorage } = await import("../storage");
    await TimeTravelStorage.addSnapshotToIndex({
      id: snapshotId,
      fullKey: snapshotKey,
      timestamp,
      tileX,
      tileY,
      name,
    });

    console.log(`Saved snapshot: ${snapshotId}`);

    return snapshotId;
  }

  async loadSnapshot(snapshotId: string): Promise<Blob> {
    const key = `${TileSnapshot.SNAPSHOT_PREFIX}${snapshotId}`;
    const result = await chrome.storage.local.get(key);

    if (!result[key]) throw new Error(`Snapshot not found: ${snapshotId}`);

    const uint8Array = new Uint8Array(result[key]);
    return new Blob([uint8Array], { type: "image/png" });
  }

  async importSnapshot(
    file: File,
    tileX: number,
    tileY: number,
    timestamp: number,
    name?: string
  ): Promise<string> {
    // Scale down if needed
    const processedBlob = await this.scaleDownIfNeeded(file);
    
    // Convert to Uint8Array
    const arrayBuffer = await processedBlob.arrayBuffer();
    const data = Array.from(new Uint8Array(arrayBuffer));
    
    // Create snapshot ID and key
    const snapshotId = `${timestamp}_${tileX}_${tileY}`;
    const snapshotKey = `${TileSnapshot.SNAPSHOT_PREFIX}${snapshotId}`;
    
    // Save to storage
    await chrome.storage.local.set({ [snapshotKey]: data });
    
    // Update index
    const { TimeTravelStorage } = await import("../storage");
    await TimeTravelStorage.addSnapshotToIndex({
      id: snapshotId,
      fullKey: snapshotKey,
      timestamp,
      tileX,
      tileY,
      name,
    });
    
    console.log(`Imported snapshot: ${snapshotId}`);
    return snapshotId;
  }
}
