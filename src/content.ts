// WPlace Studio - Main Content Script

import { WPlaceExtendedFavorites } from "./features/favorite/index";
import { injectFetchInterceptor } from "./features/fetch-interceptor/index";
import { TileOverlay } from "./features/tile-overlay/index";
import { ImageEditor } from "./features/image-editor/index";
import { Toolbar } from "./components/toolbar";

class WPlaceStudio {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return;
    }

    try {
      const toolbar = new Toolbar();
      
      injectFetchInterceptor();
      new WPlaceExtendedFavorites();
      new TileOverlay(toolbar);
      new ImageEditor(toolbar);
    } catch (error) {
      console.error("WPlace Studio initialization error:", error);
    }
  }
}

new WPlaceStudio();
