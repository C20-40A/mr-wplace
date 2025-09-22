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
import { ColorFilter } from "./features/color-filter";
import { ColorFilterManager } from "./utils/color-filter-manager";
import { NextLevelBadge } from "./features/next-level-badge";
import { WPlaceUserData } from "./types/user-data";
import { TimeTravelStorage } from "./features/time-travel/storage";

const runmrWplace = async (): Promise<void> => {
  // Chrome拡張機能のストレージAPIが利用可能か確認
  if (typeof chrome === "undefined" || !chrome.storage)
    throw new Error("Chrome storage API is not available");

  // Fetchインターセプターの注入
  injectFetchInterceptor();

  // i18n初期化（ブラウザ言語検出）
  await I18nManager.init(detectBrowserLanguage());

  const favorites = new ExtendedBookmarks();
  const tileOverlay = new TileOverlay();
  await (tileOverlay as any).init(); // 明示的初期化
  const gallery = new Gallery();
  const drawing = new Drawing();
  const tileSnapshot = new TileSnapshot();
  const timeTravel = new TimeTravel();
  const drawingLoader = new DrawingLoader();
  const colorFilter = new ColorFilter();
  const colorFilterManager = new ColorFilterManager();
  const nextLevelBadge = new NextLevelBadge();

  // ColorFilterManager初期化完了を待つ
  await colorFilterManager.init();

  // NextLevelBadge初期化
  nextLevelBadge.init();

  // GalleryとTileOverlayの連携設定
  gallery.setDrawToggleCallback(async (imageKey: string) => {
    return await tileOverlay.toggleImageDrawState(imageKey);
  });

  // Global access for ImageProcessor and Gallery
  window.mrWplace = {
    gallery,
    tileOverlay,
    favorites,
    drawing,
    tileSnapshot,
    timeTravel,
    drawingLoader,
    colorFilter,
    nextLevelBadge,
  };

  // ColorFilterManager 直接登録（TemplateManagerからアクセス用）
  window.colorFilterManager = colorFilterManager;

  // Listen for snapshot tmp save messages from inject.js
  window.addEventListener("message", async (event) => {
    if (event.data.source === "wplace-studio-snapshot-tmp") {
      const { tileBlob, tileX, tileY } = event.data;
      await tileSnapshot.saveTmpTile(tileX, tileY, tileBlob);
    }

    // Listen for user data from inject.js
    if (event.data.source === "wplace-studio-userdata") {
      console.log("🧑‍🎨: Received user data:", event.data.userData);
      const userData = event.data.userData as WPlaceUserData;

      nextLevelBadge.updateFromUserData(userData);
    }
  });
};

// 言語切替メッセージリスナー
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === "LOCALE_CHANGED") {
    // i18nマネージャーの状態を更新
    await I18nManager.init(message.locale);
  }
});

// 実行
runmrWplace().catch((error) => {
  console.error("🧑‍🎨: Failed to initialize", error);
  Toast.error(`initialization error: ${error.message}`);
});
