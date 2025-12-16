import { getSnapshotRepository } from "@/inject/db/snapshot-repository";

export class TileSnapshot {
  // インメモリキャッシュ（永続化しない）
  private tmpTileCache = new Map<string, Blob>();

  // スナップショット削除
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const repository = getSnapshotRepository();
    await repository.deleteSnapshotWithMetadata(snapshotId);

    console.log(`🧑‍🎨 : Deleted snapshot: ${snapshotId}`);
  }

  async saveTmpTile(tileX: number, tileY: number, blob: Blob): Promise<void> {
    const key = `${tileX}_${tileY}`;

    // Check image size and scale down if 3000x3000
    const processedBlob = await this.scaleDownIfNeeded(blob);

    // インメモリに保存（永続化しない）
    this.tmpTileCache.set(key, processedBlob);
  }

  async getTmpTile(tileX: number, tileY: number): Promise<Blob | null> {
    const key = `${tileX}_${tileY}`;
    return this.tmpTileCache.get(key) || null;
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
    const tmpKey = `${tileX}_${tileY}`;
    const tmpBlob = this.tmpTileCache.get(tmpKey);

    if (!tmpBlob)
      throw new Error(`No tmp data found for tile ${tileX},${tileY}`);

    const timestamp = Date.now();
    const snapshotId = `${timestamp}_${tileX}_${tileY}`;

    // IndexedDBに保存
    const repository = getSnapshotRepository();
    await repository.saveSnapshotWithMetadata(snapshotId, tmpBlob, {
      id: snapshotId,
      timestamp,
      tileX,
      tileY,
      name,
    });

    console.log(`🧑‍🎨 : Saved snapshot: ${snapshotId}`);

    return snapshotId;
  }

  async loadSnapshot(snapshotId: string): Promise<Blob> {
    const repository = getSnapshotRepository();
    const blob = await repository.getSnapshot(snapshotId);

    if (!blob) throw new Error(`Snapshot not found: ${snapshotId}`);

    return blob;
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

    // Create snapshot ID
    const snapshotId = `${timestamp}_${tileX}_${tileY}`;

    // Save to IndexedDB
    const repository = getSnapshotRepository();
    await repository.saveSnapshotWithMetadata(snapshotId, processedBlob, {
      id: snapshotId,
      timestamp,
      tileX,
      tileY,
      name,
    });

    console.log(`🧑‍🎨 : Imported snapshot: ${snapshotId}`);
    return snapshotId;
  }
}
