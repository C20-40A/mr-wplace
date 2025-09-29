import { llzToTilePixel } from "../../utils/coordinate";
import { TileDrawManager } from "../tile-draw";
import { ImageItem } from "../gallery/routes/list/components";
import { GalleryStorage } from "../gallery/storage";

export class TileOverlay {
  private templateManager: TileDrawManager;
  private galleryStorage: GalleryStorage;

  constructor() {
    this.templateManager = new TileDrawManager();
    this.galleryStorage = new GalleryStorage();
    this.init();
  }

  private async init(): Promise<void> {
    this.setupTileProcessing();
    await this.restoreAllDrawnImages();
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
      imageItem.title || "template.png"
    );

    await this.templateManager.createTemplate(
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
    return await this.templateManager.drawTemplateOnTile(tileBlob, [
      tileX,
      tileY,
    ]);
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

  private async restoreImagesOnTile(
    tileX: number,
    tileY: number
  ): Promise<void> {
    try {
      const images = await this.galleryStorage.getAll();
      const targetImages = images.filter(
        (img) =>
          img.drawEnabled &&
          img.drawPosition?.TLX === tileX &&
          img.drawPosition?.TLY === tileY
      );

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
          const file = new File([blob], "snapshot.png", { type: "image/png" });

          await this.templateManager.createTemplate(
            file,
            [tileX, tileY, 0, 0],
            `snapshot_${activeSnapshot.fullKey}`
          );
        }
      }
    } catch (error) {
      console.error("🧑‍🎨 : Failed to restore images:", error);
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
    this.templateManager.toggleDrawEnabled(imageKey);

    return updatedImage.drawEnabled;
  }

  private async restoreAllDrawnImages(): Promise<void> {
    const images = await this.galleryStorage.getAll();
    const drawnImages = images.filter(
      (img) => img.drawEnabled && img.drawPosition
    );

    for (const image of drawnImages) {
      await this.restoreImage(image);
    }
  }

  private async restoreImage(image: any): Promise<void> {
    const file = await this.dataUrlToFile(image.dataUrl, "restored.png");

    await this.templateManager.createTemplate(
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
}
