// WPlace Studio - Main Content Script

import { WPlaceExtendedFavorites } from "./features/favorite/index";
import { injectFetchInterceptor } from "./features/fetch-interceptor/index";
import { TileOverlay } from "./features/tile-overlay/index";

class WPlaceStudio {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return;
    }

    try {
      injectFetchInterceptor();
      new WPlaceExtendedFavorites();
      new TileOverlay();
    } catch (error) {
      console.error("WPlace Studio initialization error:", error);
    }
  }
}

new WPlaceStudio();
