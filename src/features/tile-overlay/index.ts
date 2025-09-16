import { llzToTilePixel } from "../../utils/coordinate";
import { TemplateManager } from "../template";
import { ImageItem } from "../gallery/routes/list/components";
import { GalleryStorage } from "../gallery/storage";
export class TileOverlay {
  private templateManager: TemplateManager;
  private galleryStorage: GalleryStorage;

  constructor() {
    this.templateManager = new TemplateManager();
    this.galleryStorage = new GalleryStorage();
    this.init();
  }

  private init(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.setupTileProcessing()
      );
    } else {
      this.setupTileProcessing();
    }
  }

  private setupTileProcessing(): void {
    window.addEventListener("message", async (event) => {
      if (event.data.source !== "wplace-studio-tile") return;
      const { blobID, tileBlob, tileX, tileY } = event.data;

      const processedBlob = await this.drawPixelOnTile(tileBlob, tileX, tileY);

      window.postMessage(
        {
          source: "wplace-studio-processed",
          blobID: blobID,
          processedBlob: processedBlob,
        },
        "*"
      );
    });

    console.log("Tile processing listener setup complete");
  }

  async drawImageAt(
    lat: number,
    lng: number,
    imageItem: ImageItem
  ): Promise<void> {
    console.log("🖼️ Drawing image at:", lat, lng);

    // 描画開始通知
    window.postMessage(
      {
        source: "wplace-studio-drawing-start",
      },
      "*"
    );

    // Convert coordinates
    const coords = llzToTilePixel(lat, lng);
    console.log("Tile coords:", coords);

    await this.drawImageWithCoords(coords, imageItem);
  }

  async drawImageWithCoords(
    coords: {
      TLX: number;
      TLY: number;
      PxX: number;
      PxY: number;
    },
    imageItem: ImageItem
  ): Promise<void> {
    console.log("🖼️ Drawing image with coords:", coords);

    // Convert dataUrl to File for Template
    const response = await fetch(imageItem.dataUrl);
    const blob = await response.blob();
    const file = new File([blob], imageItem.title || "template.png", {
      type: blob.type,
    });

    // Create template using TemplateManager
    await this.templateManager.createTemplate(file, [
      coords.TLX,
      coords.TLY,
      coords.PxX,
      coords.PxY,
    ]);

    // 描画完了後に位置情報を保存
    console.log("🔄 Saving draw position:", imageItem.key, coords);
    await this.saveDrawPosition(imageItem.key, coords);
    console.log("✅ Template created and position saved");
  }

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    // 保存済み画像をチェックして復元
    await this.restoreImagesOnTile(tileX, tileY);

    // Use TemplateManager's drawing method
    return await this.templateManager.drawTemplateOnTile(tileBlob, [
      tileX,
      tileY,
    ]);
  }

  /**
   * 描画位置情報を保存
   */
  private async saveDrawPosition(
    imageKey: string,
    coords: { TLX: number; TLY: number; PxX: number; PxY: number }
  ): Promise<void> {
    console.log("🔍 Starting save for:", imageKey, coords);

    const items = await this.galleryStorage.getAll();

    const item = items.find((i) => i.key === imageKey);
    if (!item) {
      console.error("Image not found:", imageKey);
      return;
    }

    console.log("🖼️ Found item:", item);

    const updatedItem = {
      ...item,
      drawPosition: coords,
      drawEnabled: true,
    };

    console.log("🔄 Updated item:", updatedItem);

    await this.galleryStorage.save(updatedItem);
    console.log("💾 Save completed");

    // 保存後の確認
    const itemsAfter = await this.galleryStorage.getAll();
    const savedItem = itemsAfter.find((i) => i.key === imageKey);
    console.log("🔍 Verification - saved item:", savedItem);
  }

  /**
   * タイル上の保存済み画像を復元
   */
  private async restoreImagesOnTile(
    tileX: number,
    tileY: number
  ): Promise<void> {
    try {
      // 該当タイルの全テンプレートをクリア
      this.templateManager.clearAllTemplates();

      const items = await this.galleryStorage.getAll();

      const enabledItems = items.filter((item) => {
        const hasPosition = !!item.drawPosition;
        const isEnabled = item.drawEnabled;
        const matchesTile =
          item.drawPosition?.TLX === tileX && item.drawPosition?.TLY === tileY;

        return isEnabled && hasPosition && matchesTile;
      });

      if (enabledItems.length === 0) return;

      for (const item of enabledItems) {
        await this.restoreImageOnTile(item);
      }
    } catch (error) {
      console.error("Failed to restore images:", error);
    }
  }

  /**
   * 画像の描画状態を切り替える
   */
  async toggleImageDrawState(imageKey: string): Promise<boolean> {
    const galleryStorage = new GalleryStorage();
    const items = await galleryStorage.getAll();

    const item = items.find((i) => i.key === imageKey);
    if (!item) {
      console.warn(`Image not found: ${imageKey}`);
      return false;
    }

    const updatedItem = {
      ...item,
      drawEnabled: !item.drawEnabled,
    };

    await galleryStorage.save(updatedItem);
    return updatedItem.drawEnabled;
  }

  /**
   * 単一画像をタイル上に復元
   */
  private async restoreImageOnTile(item: any): Promise<void> {
    const response = await fetch(item.dataUrl);
    const blob = await response.blob();
    const file = new File([blob], "restored.png", { type: blob.type });

    await this.templateManager.createTemplate(file, [
      item.drawPosition.TLX,
      item.drawPosition.TLY,
      item.drawPosition.PxX,
      item.drawPosition.PxY,
    ]);
  }
}
