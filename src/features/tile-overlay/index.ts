import { TileOverlayUI } from './ui';

export class TileOverlay {
  private readonly TILE_SIZE = 1000;
  private enabled = true;
  private ui: TileOverlayUI | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.observeAndInit());
    } else {
      this.observeAndInit();
    }
  }

  private observeAndInit(): void {
    this.setupTileProcessing();
    this.startUIObserver();
  }

  private startUIObserver(): void {
    const ensureUI = () => {
      if (!this.ui) {
        const container = document.querySelector('.flex.flex-col.items-center.gap-3');
        if (container) {
          this.ui = new TileOverlayUI((enabled) => {
            this.setEnabled(enabled);
          });
        }
      }
    };

    const observer = new MutationObserver(() => {
      ensureUI();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    ensureUI();
  }

  private setupTileProcessing(): void {
    window.addEventListener('message', async (event) => {
      if (event.data.source === 'wplace-studio-tile') {
        const { blobID, tileBlob, tileX, tileY } = event.data;
        
        try {
          const processedBlob = await this.drawPixelOnTile(tileBlob, tileX, tileY);
          
          window.postMessage({
            source: 'wplace-studio-processed',
            blobID: blobID,
            processedBlob: processedBlob
          }, '*');
        } catch (error) {
          console.error('Failed to process tile:', error);
        }
      }
    });
    
    console.log('Tile processing listener setup complete');
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`Tile overlay: ${enabled ? 'ON' : 'OFF'}`);
  }

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    // Return original tile if disabled
    if (!this.enabled) {
      return tileBlob;
    }

    // Only process tile 1803,802
    if (tileX !== 1803 || tileY !== 802) {
      return tileBlob;
    }

    console.log(`Processing tile ${tileX},${tileY}`);

    // Create canvas for drawing
    const canvas = new OffscreenCanvas(this.TILE_SIZE, this.TILE_SIZE);
    const context = canvas.getContext("2d");

    if (!context) {
      console.warn("Failed to get canvas context");
      return tileBlob;
    }

    // Draw original tile
    const tileBitmap = await createImageBitmap(tileBlob);
    context.drawImage(tileBitmap, 0, 0);

    // Draw red pixel at (345, 497)
    context.fillStyle = "red";
    context.fillRect(345, 497, 1, 1);

    console.log("Drew red pixel at (345, 497)");

    // Return modified blob
    return await canvas.convertToBlob({ type: "image/png" });
  }
}
