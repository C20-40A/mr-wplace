import { injectFetchInterceptor } from "./features/fetch-interceptor";
import { I18nManager } from "./i18n/manager";
import { ExtendedBookmarks } from "./features/bookmark";
import { TileOverlay } from "./features/tile-overlay";
import { Gallery } from "./features/gallery";
import { Drawing } from "./features/drawing";
import { TileSnapshot } from "./features/tile-snapshot";
import { TimeTravel } from "./features/time-travel";
import { DrawingLoader } from "./features/drawing-loader";

const initializeWPlaceStudio = async (): Promise<void> => {
  // Chrome拡張機能のストレージAPIが利用可能か確認
  if (typeof chrome === "undefined" || !chrome.storage)
    throw new Error("Chrome storage API is not available");

  // Fetchインターセプターの注入
  injectFetchInterceptor();

  // i18n初期化（ストレージから読み込み）
  await I18nManager.init("ja");

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

// 実行
initializeWPlaceStudio().catch((error) => {
  console.error("Failed to initialize WPlace Studio:", error);
  alert(`WPlace Studio initialization error: ${error.message}`);
});
