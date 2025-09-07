import { llzToTilePixel } from "../../utils/coordinate";
import TemplateManager from "../blue-marble/templateManager";

// Simple overlay mock for TemplateManager compatibility
class SimpleOverlay {
  handleDisplayStatus(text: string): void {
    console.log("📊 Template Status:", text);
  }
  handleDisplayError(text: string): void {
    console.error("❌ Template Error:", text);
  }
}

export class TileOverlay {
  private templateManager: TemplateManager;
  private simpleOverlay: SimpleOverlay;

  constructor() {
    this.simpleOverlay = new SimpleOverlay();
    this.templateManager = new TemplateManager("WPlace Studio", "1.0.0", this.simpleOverlay);
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

  async drawImageAt(lat: number, lng: number, imageItem: any): Promise<void> {
    console.log("🖼️ Drawing image at:", lat, lng);

    // Convert coordinates
    const coords = llzToTilePixel(lat, lng);
    console.log("Tile coords:", coords);

    try {
      // Convert dataUrl to File for Template
      const response = await fetch(imageItem.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], imageItem.title || "template.png", { type: blob.type });

      // Create template using TemplateManager
      await this.templateManager.createTemplate(
        file, 
        imageItem.title || "Generated Template",
        [coords.TLX, coords.TLY, coords.PxX, coords.PxY]
      );

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
    return await this.templateManager.drawTemplateOnTile(tileBlob, [tileX, tileY]);
  }
}
