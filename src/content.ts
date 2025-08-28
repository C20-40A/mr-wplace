// WPlace Studio - Main Content Script

import { WPlaceExtendedFavorites } from "./features/favorite/index";
import { injectFetchInterceptor } from "./features/fetch-interceptor/index";
import { TileOverlay } from "./features/tile-overlay/index";

class WPlaceStudio {
  private tileOverlay: TileOverlay;

  constructor() {
    this.tileOverlay = new TileOverlay();
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return;
    }

    try {
      new WPlaceExtendedFavorites();
      injectFetchInterceptor();
      this.setupTileProcessing();
    } catch (error) {
      console.error("WPlace Studio initialization error:", error);
    }
  }

  private setupTileProcessing(): void {
    window.addEventListener('message', async (event) => {
      if (event.data.source === 'wplace-studio-tile') {
        const { blobID, tileBlob, tileX, tileY } = event.data;
        
        try {
          const processedBlob = await this.tileOverlay.drawPixelOnTile(tileBlob, tileX, tileY);
          
          // Send processed blob back to inject script
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
}

new WPlaceStudio();
