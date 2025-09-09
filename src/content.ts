import { WPlaceExtendedFavorites } from "./features/favorite/index";
import { injectFetchInterceptor } from "./features/fetch-interceptor/index";
import { TileOverlay } from "./features/tile-overlay/index";
import { Toolbar } from "./components/toolbar";
import { Gallery } from "./features/gallery";

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
      const tileOverlay = new TileOverlay();
      const gallery = new Gallery(toolbar);

      // Global access for ImageProcessor and Gallery
      (window as any).wplaceStudio = { gallery, tileOverlay };
    } catch (error) {
      console.error("WPlace Studio initialization error:", error);
    }
  }
}

new WPlaceStudio();
