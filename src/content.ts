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
import { UserStatus } from "./features/user-status";
import { WPlaceUserData } from "./types/user-data";
import { ThemeToggleStorage } from "./features/theme-toggle/storage";

const runmrWplace = async (): Promise<void> => {
  console.log("🧑‍🎨: Starting initialization...");

  // Chrome拡張機能のストレージAPIが利用可能か確認
  if (typeof chrome === "undefined" || !chrome.storage)
    throw new Error("Chrome storage API is not available");

  // データをDOM属性で渡す（CSP safe）
  {
    const currentTheme = await ThemeToggleStorage.get();
    const jsonUrl = chrome.runtime.getURL("src/assets/mapDarkStyle.json");
    
    const dataElement = document.createElement("div");
    dataElement.id = "__mr_wplace_data__";
    dataElement.setAttribute("data-theme", currentTheme);
    dataElement.setAttribute("data-dark-style-url", jsonUrl);
    dataElement.style.display = "none";
    (document.head || document.documentElement).prepend(dataElement);
    console.log("🧑‍🎨: Injected data element with URLs");
  }

  // Fetchインターセプターの注入
  {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    (document.head || document.documentElement).appendChild(script);
    script.remove();
    console.log("🧑‍🎨: Injected fetch interceptor");
  }

  // Global instance初期化（inject.js message listener前）
  window.mrWplace = {} as any;

  // Listen for messages from inject.js
  window.addEventListener("message", async (event) => {
    if (event.data.source === "wplace-studio-snapshot-tmp") {
      const { tileBlob, tileX, tileY } = event.data;
      await tileSnapshot.saveTmpTile(tileX, tileY, tileBlob);

      // Record current tile for processing optimization
      if (window.mrWplace?.tileOverlay) {
        window.mrWplace.tileOverlay.addCurrentTile(tileX, tileY);
      }
    }

    // Listen for user data from inject.js
    if (event.data.source === "mr-wplace-me") {
      console.log("🧑‍🎨: Received user data:", event.data.userData);
      const userData = event.data.userData as WPlaceUserData;

      userStatus.updateFromUserData(userData);
    }
  });

  // DOM準備待機
  if (document.readyState === "loading") {
    await new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }
  console.log("🧑‍🎨: DOM ready, proceeding with initialization");

  // UserStatus初期化
  const userStatus = new UserStatus();
  userStatus.init();

  // i18n初期化（ブラウザ言語検出）
  await I18nManager.init(detectBrowserLanguage());

  const favorites = new ExtendedBookmarks();
  const tileOverlay = new TileOverlay();
  const gallery = new Gallery();
  const drawing = new Drawing();
  const tileSnapshot = new TileSnapshot();
  new TimeTravel();
  const drawingLoader = new DrawingLoader();
  const colorFilter = new ColorFilter();
  const colorFilterManager = new ColorFilterManager();

  // 初期化完了を待つ
  await colorFilterManager.init();

  // データは先行注入済みなので、ここでは何もしない

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
    drawingLoader,
    colorFilter,
    userStatus,
    colorFilterManager,
  };
};

// メッセージリスナー（言語切替・charge data要求）
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "LOCALE_CHANGED") {
    // i18nマネージャーの状態を更新
    await I18nManager.init(message.locale);
    return;
  }
});

// 実行
runmrWplace().catch((error) => {
  console.error("🧑‍🎨: Failed to initialize", error);
  Toast.error(`initialization error: ${error.message}`);
});
