import { injectFetchInterceptor } from "./features/fetch-interceptor";
import { I18nManager } from "./i18n/manager";
import { detectBrowserLanguage } from "./i18n/index";
import { Toast } from "./components/toast";
import { ExtendedBookmarks } from "./features/bookmark";
import { TileOverlay } from "./features/tile-overlay";
import { Gallery } from "./features/gallery";
import { Drawing } from "./features/drawing";
import { TileSnapshot } from "./features/time-travel/utils/tile-snapshot";
import { TimeTravel } from "./features/time-travel";
import { DrawingLoader } from "./features/drawing-loader";

const runWPlaceStudio = async (): Promise<void> => {
  // Chrome拡張機能のストレージAPIが利用可能か確認
  if (typeof chrome === "undefined" || !chrome.storage)
    throw new Error("Chrome storage API is not available");

  // Fetchインターセプターの注入
  injectFetchInterceptor();

  // i18n初期化（ブラウザ言語検出）
  await I18nManager.init(detectBrowserLanguage());

  const favorites = new ExtendedBookmarks();
  const tileOverlay = new TileOverlay();
  const gallery = new Gallery();
  const drawing = new Drawing();
  const tileSnapshot = new TileSnapshot();
  const timeTravel = new TimeTravel();
  const drawingLoader = new DrawingLoader();

  // GalleryとTileOverlayの連携設定
  gallery.setDrawToggleCallback(async (imageKey: string) => {
    return await tileOverlay.toggleImageDrawState(imageKey);
  });

  // Global access for ImageProcessor and Gallery
  (window as any).wplaceStudio = {
    gallery,
    tileOverlay,
    favorites,
    drawing,
    tileSnapshot,
    timeTravel,
    drawingLoader,
  };

  // Listen for snapshot tmp save messages from inject.js
  window.addEventListener("message", async (event) => {
    if (event.data.source === "wplace-studio-snapshot-tmp") {
      const { tileBlob, tileX, tileY } = event.data;
      await tileSnapshot.saveTmpTile(tileX, tileY, tileBlob);
    }
  });
};

// 言語切替メッセージリスナー
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'LOCALE_CHANGED') {
    // i18nマネージャーの状態を更新
    await I18nManager.init(message.locale);
  }
});

// 実行
runWPlaceStudio().catch((error) => {
  console.error("Failed to initialize WPlace Studio:", error);
  Toast.error(`WPlace Studio initialization error: ${error.message}`);
});
