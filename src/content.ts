import { I18nManager } from "@/i18n/manager";
import { detectBrowserLanguage } from "@/i18n/index";
import { Toast } from "@/components/toast";
import { bookmarkAPI } from "@/features/bookmark";
import { TileOverlay } from "@/features/tile-overlay";
import { galleryAPI } from "@/features/gallery";
import { Drawing } from "@/features/drawing";
import { TileSnapshot } from "@/features/time-travel/utils/tile-snapshot";
import { timeTravelAPI } from "@/features/time-travel";
import { drawingLoaderAPI } from "@/features/drawing-loader";
import { ColorFilter } from "@/features/color-filter";
import { ColorFilterManager } from "@/utils/color-filter-manager";
import { UserStatus } from "@/features/user-status";
import { WPlaceUserData } from "@/types/user-data";
import { ThemeToggleStorage } from "@/features/theme-toggle/storage";
import { textDrawAPI } from "@/features/text-draw";
import { AutoSpoit } from "@/features/auto-spoit";
import { PositionInfo } from "@/features/position-info";
import { initPaintStats } from "@/features/paint-stats";
import { colorpalette } from "@/constants/colors";
import { addCurrentTile } from "@/states/currentTile";
import { di } from "@/core/di";
import { runtime } from "@/utils/browser-api";
import { getOverlayPixelColor } from "@/features/tile-draw";

(async () => {
  try {
    console.log("🧑‍🎨: Starting initialization...");

    // Fetchインターセプターの注入
    {
      const script = document.createElement("script");
      script.src = runtime.getURL("inject.js");
      // scriptタグをheadの先頭に挿入
      (document.head || document.documentElement).prepend(script);
      // 読み込まれたら即削除
      script.onload = () => script.remove();
      console.log("🧑‍🎨: Injected fetch interceptor");
    }

    // データをDOM属性で渡す（CSP safe）
    {
      const currentTheme = await ThemeToggleStorage.get();

      const dataElement = document.createElement("div");
      dataElement.id = "__mr_wplace_data__";
      dataElement.setAttribute("data-theme", currentTheme);
      dataElement.style.display = "none";
      (document.head || document.documentElement).prepend(dataElement);
      console.log("🧑‍🎨: Injected data element");
    }

    // Global instance初期化（inject.js message listener前）
    window.mrWplace = {} as any;

    // Listen for messages from inject.js
    let lastPixelClickColorId: number | null = null;

    window.addEventListener("message", async (event) => {
      // console.log("🧑‍🎨: event", event.data.source);
      if (event.data.source === "wplace-studio-snapshot-tmp") {
        const { tileBlob, tileX, tileY } = event.data;
        await tileSnapshot.saveTmpTile(tileX, tileY, tileBlob);

        // Record current tile for processing optimization
        addCurrentTile(tileX, tileY);
      }

      // Listen for user data from inject.js
      if (event.data.source === "mr-wplace-me") {
        console.log("🧑‍🎨: Received user data:", event.data.userData);
        const userData = event.data.userData as WPlaceUserData;

        userStatus.updateFromUserData(userData);
      }

      // Listen for pixel click from inject.js
      if (event.data.source === "wplace-studio-pixel-click") {
        // autoSpoit dev modeがoffまたは無効時は処理しない
        if (!window.mrWplace?.autoSpoit?.isDevModeEnabled()) return;
        if (!window.mrWplace?.autoSpoit?.isEnabled()) return;

        const { lat, lng } = event.data;
        const color = await getOverlayPixelColor(lat, lng);

        console.log("🧑‍🎨 : Overlay pixel color (before check):", color, {
          lat,
          lng,
        });
        if (!color || color.a === 0) return;

        console.log("🧑‍🎨 : Overlay pixel color:", color, { lat, lng });

        // find color id
        const targetColor = colorpalette.find(
          (c) =>
            c.rgb[0] === color.r && c.rgb[1] === color.g && c.rgb[2] === color.b
        );
        if (!targetColor) return;

        // selectColor
        const el = document.getElementById(`color-${targetColor.id}`);
        if (el) {
          console.log("🧑‍🎨 : Selecting color ID:", targetColor.id);
          el.click();
          lastPixelClickColorId = targetColor.id;
        }
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

    // DI Container登録
    di.register("gallery", galleryAPI);
    di.register("textDraw", textDrawAPI);
    di.register("bookmark", bookmarkAPI);
    di.register("drawingLoader", drawingLoaderAPI);
    di.register("timeTravel", timeTravelAPI);

    // Feature初期化
    bookmarkAPI.initBookmark(); // 1. Bookmark (最後に表示)
    const tileOverlay = new TileOverlay();
    const tileSnapshot = new TileSnapshot();
    timeTravelAPI.initTimeTravel(); // 2. TimeTravel
    textDrawAPI.initTextDraw(); // 3. TextDraw
    galleryAPI.initGallery();
    new Drawing(); // 4. Drawing (最初に表示)
    drawingLoaderAPI.initDrawingLoader();
    new ColorFilter();
    const colorFilterManager = new ColorFilterManager();
    const autoSpoit = new AutoSpoit();
    new PositionInfo();
    initPaintStats();

    // 初期化完了を待つ
    await colorFilterManager.init();

    // GalleryとTileOverlayの連携設定（DI経由）
    galleryAPI.setDrawToggleCallback(async (imageKey: string) => {
      return await tileOverlay.toggleImageDrawState(imageKey);
    });

    // Global access for ImageProcessor and Gallery
    window.mrWplace = {
      colorFilterManager,
      tileOverlay,
      tileSnapshot,
      autoSpoit,
    };
  } catch (error) {
    console.error("🧑‍🎨: Failed to initialize", error);
    if (error instanceof Error) {
      Toast.error(`initialization error: ${error.message}`);
    } else {
      Toast.error(`initialization error: ${String(error)}`);
    }
  }
})();

// メッセージリスナー（言語切替・テーマ切替）
runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "LOCALE_CHANGED") {
    // i18nマネージャーの状態を更新
    await I18nManager.init(message.locale);
    return;
  }

  if (message.type === "THEME_CHANGED") {
    const newTheme = message.theme as "light" | "dark";
    console.log("🧑‍🎨 : Theme changed to:", newTheme);

    // data elementの属性更新
    const dataElement = document.getElementById("__mr_wplace_data__");
    if (dataElement) {
      dataElement.setAttribute("data-theme", newTheme);
    }

    // inject.jsにテーマ変更を通知
    window.postMessage(
      {
        source: "mr-wplace-theme-update",
        theme: newTheme,
      },
      "*"
    );
    return;
  }
});
