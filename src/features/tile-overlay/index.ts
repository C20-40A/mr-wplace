import { llzToTilePixel } from "../../utils/coordinate";
import TemplateManager from "../blue-marble/templateManager";
import { ImageItem } from "../gallery/routes/list/components";
export class TileOverlay {
  private templateManager: TemplateManager;

  constructor() {
    this.templateManager = new TemplateManager();
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
      if (event.data.source === "wplace-studio-tile") {
        const { blobID, tileBlob, tileX, tileY } = event.data;

        try {
          const processedBlob = await this.drawPixelOnTile(
            tileBlob,
            tileX,
            tileY
          );

          window.postMessage(
            {
              source: "wplace-studio-processed",
              blobID: blobID,
              processedBlob: processedBlob,
            },
            "*"
          );
        } catch (error) {
          console.error("Failed to process tile:", error);
        }
      }
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
    window.postMessage({
      source: "wplace-studio-drawing-start"
    }, "*");

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

    try {
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

      console.log("✅ Template created and ready for drawing");
    } catch (error) {
      console.error("❌ Failed to create template:", error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    // Use TemplateManager's drawing method
    return await this.templateManager.drawTemplateOnTile(tileBlob, [
      tileX,
      tileY,
    ]);
  }
}
