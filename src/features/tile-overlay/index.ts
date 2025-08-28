import { TileOverlayUI, OverlayMode } from './ui';

export class TileOverlay {
  private readonly TILE_SIZE = 1000;
  private mode = OverlayMode.ON;
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
        this.ui = new TileOverlayUI((mode) => {
          this.setMode(mode);
        });
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

  setMode(mode: OverlayMode): void {
    this.mode = mode;
    console.log(`Tile overlay: ${mode}`);
  }

  async drawPixelOnTile(
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ): Promise<Blob> {
    // Return original tile if off
    if (this.mode === OverlayMode.OFF) {
      return tileBlob;
    }

    // Only process tile 1803,802
    if (tileX !== 1803 || tileY !== 802) {
      return tileBlob;
    }

    console.log(`Processing tile ${tileX},${tileY} in ${this.mode} mode`);

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

    // Draw red pixel with appropriate opacity
    if (this.mode === OverlayMode.TRANSPARENT) {
      context.globalAlpha = 0.5;
    }
    context.fillStyle = "red";
    context.fillRect(345, 497, 1, 1);
    context.globalAlpha = 1.0; // Reset

    console.log(`Drew red pixel at (345, 497) with ${this.mode} mode`);

    // Return modified blob
    return await canvas.convertToBlob({ type: "image/png" });
  }
}
