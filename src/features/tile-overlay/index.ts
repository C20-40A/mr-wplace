import { llzToTilePixel } from "../../utils/coordinate";
import { TileDrawManager } from "../tile-draw";
import { ImageItem } from "../gallery/routes/list/components";
import { GalleryStorage } from "../gallery/storage";
import { ColorPaletteStorage } from "../../components/color-palette/storage";
import { storage } from "@/utils/browser-api";
import { createResizedImageBitmap } from "@/utils/image-bitmap-compat";

export class TileOverlay {
  public tileDrawManager: TileDrawManager;
  private galleryStorage: GalleryStorage;

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
    const response = await fetch(imageItem.dataUrl);
    const blob = await response.blob();

    await this.tileDrawManager.addImageToOverlayLayers(
      blob,
      [coords.TLX, coords.TLY, coords.PxX, coords.PxY],
      imageItem.key
    );

    await this.saveDrawPosition(imageItem.key, coords);
  }

  private async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    const images = await this.galleryStorage.getAll();
    const targetImages = images.filter(
      (img) =>
        img.drawEnabled &&
        img.drawPosition?.TLX === tileX &&
        img.drawPosition?.TLY === tileY
    );

    console.log(
      `🧑‍🎨 : drawPixelOnTile(${tileX},${tileY}) - found ${targetImages.length} images`
    );

    await this.restoreImagesOnTileWithCache(tileX, tileY, targetImages);

    const computeDevice = await ColorPaletteStorage.getComputeDevice();

    const result = await this.tileDrawManager.drawOverlayLayersOnTile(
      tileBlob,
      [tileX, tileY],
      computeDevice
    );

    await this.updateColorStatsForTileWithCache(targetImages);

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

  private async restoreImagesOnTileWithCache(
    tileX: number,
    tileY: number,
    targetImages: any[]
  ): Promise<void> {
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
      const snapshotData = await storage.get([
        activeSnapshot.fullKey,
      ]);
      const rawData = snapshotData[activeSnapshot.fullKey];

      if (rawData) {
        const uint8Array = new Uint8Array(rawData);
        const blob = new Blob([uint8Array], { type: "image/png" });

        const resizedImg = await createResizedImageBitmap(blob, {
          width: 1000,
          height: 1000,
          quality: "high"
        });

        const snapshotKey = `snapshot_${activeSnapshot.fullKey}`;
        await this.tileDrawManager.addImageToOverlayLayers(
          resizedImg,
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
    const response = await fetch(image.dataUrl);
    const blob = await response.blob();

    await this.tileDrawManager.addImageToOverlayLayers(
      blob,
      [
        image.drawPosition.TLX,
        image.drawPosition.TLY,
        image.drawPosition.PxX,
        image.drawPosition.PxY,
      ],
      image.key
    );

    // 統計復元
    if (image.perTileColorStats) {
      const tileStatsMap = new Map();
      for (const [tileKey, stats] of Object.entries(image.perTileColorStats)) {
        tileStatsMap.set(tileKey, {
          matched: new Map(Object.entries((stats as any).matched)),
          total: new Map(Object.entries((stats as any).total)),
        });
      }
      this.tileDrawManager.setPerTileColorStats(image.key, tileStatsMap);
    }
  }

  private async updateColorStatsForTileWithCache(
    targetImages: any[]
  ): Promise<void> {
    for (const image of targetImages) {
      const perTileStats = this.tileDrawManager.getPerTileColorStats(image.key);
      if (!perTileStats) continue;

      await this.galleryStorage.updateTileColorStats(image.key, perTileStats);
    }
  }
}
