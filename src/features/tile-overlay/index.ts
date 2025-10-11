import { llzToTilePixel } from "../../utils/coordinate";
import { TileDrawManager } from "../tile-draw";
import { ImageItem } from "../gallery/routes/list/components";
import { GalleryStorage } from "../gallery/storage";

export class TileOverlay {
  public tileDrawManager: TileDrawManager;
  private galleryStorage: GalleryStorage;
  private currentTiles: Set<string> = new Set();
  private readonly MAX_TILE_HISTORY = 50;

  constructor() {
    this.tileDrawManager = new TileDrawManager();
    this.galleryStorage = new GalleryStorage();
    this.init();
  }

  private async init(): Promise<void> {
    this.setupTileProcessing();
  }

  private setupTileProcessing(): void {
    window.addEventListener("message", async (event) => {
      if (event.data.source !== "wplace-studio-tile") return;
      const { blobID, tileBlob, tileX, tileY } = event.data;

      const processedBlob = await this.drawPixelOnTile(tileBlob, tileX, tileY);

      window.postMessage(
        {
          source: "mr-wplace-processed",
          blobID,
          processedBlob,
        },
        "*"
      );
    });

    console.log("🧑‍🎨 : Tile processing listener setup complete");
  }

  async drawImageAt(
    lat: number,
    lng: number,
    imageItem: ImageItem
  ): Promise<void> {
    window.postMessage({ source: "wplace-studio-drawing-start" }, "*");

    const coords = llzToTilePixel(lat, lng);
    await this.drawImageWithCoords(coords, imageItem);
  }

  async drawImageWithCoords(
    coords: { TLX: number; TLY: number; PxX: number; PxY: number },
    imageItem: ImageItem
  ): Promise<void> {
    const file = await this.dataUrlToFile(
      imageItem.dataUrl,
      imageItem.title || "wplace.png"
    );

    await this.tileDrawManager.addImageToOverlayLayers(
      file,
      [coords.TLX, coords.TLY, coords.PxX, coords.PxY],
      imageItem.key
    );

    await this.saveDrawPosition(imageItem.key, coords);
  }

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    await this.restoreImagesOnTile(tileX, tileY);
    const result = await this.tileDrawManager.drawOverlayLayersOnTile(tileBlob, [
      tileX,
      tileY,
    ]);
    
    await this.updateColorStatsForTile(tileX, tileY);
    
    return result;
  }

  private async saveDrawPosition(
    imageKey: string,
    coords: { TLX: number; TLY: number; PxX: number; PxY: number }
  ): Promise<void> {
    const images = await this.galleryStorage.getAll();
    const image = images.find((i) => i.key === imageKey);
    if (!image) throw new Error(`Image not found: ${imageKey}`);

    await this.galleryStorage.save({
      ...image,
      drawPosition: coords,
      drawEnabled: true,
    });
  }

  addCurrentTile(tileX: number, tileY: number): void {
    const tileKey = `${tileX},${tileY}`;
    this.currentTiles.add(tileKey);

    if (this.currentTiles.size > this.MAX_TILE_HISTORY) {
      const firstTile = this.currentTiles.values().next().value!;
      this.currentTiles.delete(firstTile);
    }
  }

  private async restoreImagesOnTile(
    tileX: number,
    tileY: number
  ): Promise<void> {
    // Ensure tile is recorded (fix timing issue)
    this.addCurrentTile(tileX, tileY);

    const tileKey = `${tileX},${tileY}`;
    if (!this.currentTiles.has(tileKey)) {
      console.log(`🧑‍🎨 : Skip tile ${tileKey} - not in current view`);
      return;
    }

    const images = await this.galleryStorage.getAll();
    const targetImages = images.filter(
      (img) =>
        img.drawEnabled &&
        img.drawPosition?.TLX === tileX &&
        img.drawPosition?.TLY === tileY
    );

    console.log(
      `🧑‍🎨 : restoreImagesOnTile(${tileX},${tileY}) - found ${targetImages.length} images`
    );
    targetImages.forEach((img) => console.log(`  - imageKey: ${img.key}`));

    for (const image of targetImages) {
      await this.restoreImage(image);
    }

    const { TimeTravelStorage } = await import("../time-travel/storage");
    const activeSnapshot = await TimeTravelStorage.getActiveSnapshotForTile(
      tileX,
      tileY
    );

    if (activeSnapshot) {
      const snapshotData = await chrome.storage.local.get([
        activeSnapshot.fullKey,
      ]);
      const rawData = snapshotData[activeSnapshot.fullKey];

      if (rawData) {
        const uint8Array = new Uint8Array(rawData);
        const blob = new Blob([uint8Array], { type: "image/png" });

        // renderScale=3で拡大済みなので1000x1000pxにリサイズ
        const img = await createImageBitmap(blob);

        const resizedImg = await createImageBitmap(img, {
          resizeWidth: 1000,
          resizeHeight: 1000,
          resizeQuality: "high",
        });

        // リサイズ済み画像をBlobに変換
        const canvas = new OffscreenCanvas(1000, 1000);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get canvas context");
        ctx.drawImage(resizedImg, 0, 0);
        const resizedBlob = await canvas.convertToBlob({ type: "image/png" });

        const file = new File([resizedBlob], "snapshot.png", {
          type: "image/png",
        });

        const snapshotKey = `snapshot_${activeSnapshot.fullKey}`;
        await this.tileDrawManager.addImageToOverlayLayers(
          file,
          [tileX, tileY, 0, 0],
          snapshotKey
        );
      }
    }
  }

  async toggleImageDrawState(imageKey: string): Promise<boolean> {
    const images = await this.galleryStorage.getAll();
    const image = images.find((i) => i.key === imageKey);

    if (!image) {
      console.warn(`🧑‍🎨 : Image not found: ${imageKey}`);
      return false;
    }

    const updatedImage = {
      ...image,
      drawEnabled: !image.drawEnabled,
    };

    await this.galleryStorage.save(updatedImage);
    this.tileDrawManager.toggleDrawEnabled(imageKey);

    return updatedImage.drawEnabled;
  }

  private async restoreImage(image: any): Promise<void> {
    const file = await this.dataUrlToFile(image.dataUrl, "restored.png");

    await this.tileDrawManager.addImageToOverlayLayers(
      file,
      [
        image.drawPosition.TLX,
        image.drawPosition.TLY,
        image.drawPosition.PxX,
        image.drawPosition.PxY,
      ],
      image.key
    );
  }

  private async dataUrlToFile(
    dataUrl: string,
    filename: string
  ): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  }

  private async updateColorStatsForTile(tileX: number, tileY: number): Promise<void> {
    console.log(`🧑‍🎨 : updateColorStatsForTile(${tileX}, ${tileY})`);
    
    const images = await this.galleryStorage.getAll();
    const targetImages = images.filter(
      (img) =>
        img.drawEnabled &&
        img.drawPosition?.TLX === tileX &&
        img.drawPosition?.TLY === tileY
    );

    console.log(`🧑‍🎨 : Found ${targetImages.length} target images`);

    for (const image of targetImages) {
      const stats = this.tileDrawManager.getColorStats(image.key);
      if (!stats) {
        console.log(`🧑‍🎨 : No stats for ${image.key}`);
        continue;
      }

      console.log(`🧑‍🎨 : Saving stats for ${image.key}`, stats);
      await this.galleryStorage.save({
        ...image,
        currentColorStats: stats.matched,
        totalColorStats: stats.total
      });
    }
  }
}
