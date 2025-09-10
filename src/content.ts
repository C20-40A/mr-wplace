import { WPlaceExtendedFavorites } from "./features/favorite/index";
import { injectFetchInterceptor } from "./features/fetch-interceptor/index";
import { TileOverlay } from "./features/tile-overlay/index";
import { Gallery } from "./features/gallery";
import { I18nManager } from "./i18n/manager";
import { setLocale } from "./i18n/index";

class WPlaceStudio {
  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    if (typeof chrome === "undefined" || !chrome.storage) {
      return;
    }

    try {
      // i18n初期化（ストレージから読み込み）
      await I18nManager.init('ja');

      injectFetchInterceptor();
      const favorites = new WPlaceExtendedFavorites();
      const tileOverlay = new TileOverlay();
      const gallery = new Gallery();

      // Global access for ImageProcessor and Gallery
      (window as any).wplaceStudio = { gallery, tileOverlay, favorites };

      // popupからのメッセージ処理
      chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
        if (message.type === 'LOCALE_CHANGED') {
          await setLocale(message.locale);
          console.log('Locale changed to:', message.locale);
          // UI再描画は必要に応じて実装
        }
      });
    } catch (error) {
      console.error("WPlace Studio initialization error:", error);
    }
  }
}

new WPlaceStudio();
