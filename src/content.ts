// WPlace Studio - Main Content Script

import { WPlaceExtendedFavorites } from "./features/favorite/index";
import { injectFetchInterceptor } from "./features/fetch-interceptor/index";

class WPlaceStudio {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return;
    }

    try {
      new WPlaceExtendedFavorites();
      injectFetchInterceptor();
    } catch (error) {
      console.error("WPlace Studio initialization error:", error);
    }
  }
}

new WPlaceStudio();
