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
import { friendsBookAPI } from "@/features/friends-book";
import { ColorFilter } from "@/features/color-filter";
import { ColorFilterManager } from "@/utils/color-filter-manager";
import { ThemeToggleStorage } from "@/features/theme-toggle/storage";
import { NotificationModal } from "@/features/user-status/ui/notification-modal";
import { textDrawAPI } from "@/features/text-draw";
import {
  darkThemeAPI,
  highContrastAPI,
  dataSaverAPI,
} from "@/features/map-filter";
import { AutoSpoit } from "@/features/developer";
import { ColorIsolate } from "@/features/color-isolate";
import { PositionInfo } from "@/features/position-info";
import { initPaintStats } from "@/features/paint-stats";
import { PaletteToggle } from "@/features/palette-toggle";
import { ShowUnplacedOnly } from "@/features/show-unplaced-only";
import { colorpalette } from "@/constants/colors";
import { addCurrentTile } from "@/states/currentTile";
import { di } from "@/core/di";
import { runtime } from "@/utils/browser-api";
import {
  getOverlayPixelColor,
  sendSnapshotsToInject,
} from "@/utils/inject-bridge";

/**
 * Send gallery images to inject side for tile processing
 * IMPORTANT: Call this after any gallery image changes (add, move, toggle, delete)
 * Also sends stored statistics for restoration after reload
 */
export const sendGalleryImagesToInject = async () => {
  const { GalleryStorage } = await import("@/features/gallery/storage");
  const galleryStorage = new GalleryStorage();
  const images = await galleryStorage.getAll();

  const enabledImages = images
    .filter((img) => img.drawEnabled && img.drawPosition)
    .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0))
    .map((img) => ({
      key: img.key,
      dataUrl: img.dataUrl,
      drawPosition: img.drawPosition!,
      layerOrder: img.layerOrder ?? 0,
      // Include stored statistics for restoration
      perTileColorStats: img.perTileColorStats,
    }));

  const messageData = {
    source: "mr-wplace-gallery-images",
    images: enabledImages,
  };

  // Log data size for performance monitoring
  const dataSize = JSON.stringify(messageData).length;
  const dataSizeMB = (dataSize / 1024 / 1024).toFixed(2);
  console.log(
    `🧑‍🎨 : Sending ${enabledImages.length} gallery images to inject side (${dataSizeMB}MB)`
  );

  window.postMessage(messageData, "*");

  console.log(
    `🧑‍🎨 : Sent ${enabledImages.length} gallery images to inject side`
  );
};

/**
 * Send compute device setting to inject side
 */
export const sendComputeDeviceToInject = async () => {
  const { ColorPaletteStorage } = await import(
    "@/components/color-palette/storage"
  );
  const device = await ColorPaletteStorage.getComputeDevice();

  window.postMessage(
    {
      source: "mr-wplace-compute-device",
      device,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent compute device to inject side: ${device}`);
};

/**
 * Send show unplaced only setting to inject side
 * Note: This is a transient state, not persisted to storage
 */
export const sendShowUnplacedOnlyToInject = (enabled: boolean) => {
  window.postMessage(
    {
      source: "mr-wplace-show-unplaced-only",
      enabled,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent show unplaced only to inject side: ${enabled}`);
};

/**
 * Send color filter state to inject side
 */
export const sendColorFilterToInject = (
  colorFilterManager: ColorFilterManager
) => {
  window.postMessage(
    {
      source: "mr-wplace-color-filter",
      isFilterActive: colorFilterManager.isFilterActive(),
      selectedRGBs: colorFilterManager.selectedRGBs,
      enhancedMode: colorFilterManager.getEnhancedMode(),
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent color filter state to inject side`);
};

/**
 * Send cache size setting to inject side
 */
export const sendCacheSizeToInject = async () => {
  const { DataSaverStorage } = await import("@/features/data-saver/storage");
  const maxCacheSize = await DataSaverStorage.getMaxCacheSize();

  window.postMessage(
    {
      source: "mr-wplace-cache-size-update",
      maxCacheSize,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent cache size to inject side: ${maxCacheSize}`);
};

/**
 * Handle stats computation notification from inject side
 * Save computed stats to storage
 */
const handleStatsComputed = async (
  imageKey: string,
  tileStatsMap: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >
) => {
  try {
    const { GalleryStorage } = await import("@/features/gallery/storage");
    const galleryStorage = new GalleryStorage();

    // Convert object back to Map
    const statsMap = new Map<
      string,
      { matched: Map<string, number>; total: Map<string, number> }
    >();
    for (const [tileKey, stats] of Object.entries(tileStatsMap)) {
      statsMap.set(tileKey, {
        matched: new Map(Object.entries(stats.matched).map(([k, v]) => [k, v])),
        total: new Map(Object.entries(stats.total).map(([k, v]) => [k, v])),
      });
    }

    await galleryStorage.updateTileColorStats(imageKey, statsMap);
    console.log(`🧑‍🎨 : Saved stats for ${imageKey} to storage`);
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save stats for ${imageKey}:`, error);
  }
};

/**
 * Handle total stats computation notification from inject side
 * Save total stats only (for images without position)
 */
const handleTotalStatsComputed = async (
  imageKey: string,
  totalColorStats: Record<string, number>
) => {
  try {
    const { GalleryStorage } = await import("@/features/gallery/storage");
    const galleryStorage = new GalleryStorage();

    const image = await galleryStorage.get(imageKey);
    if (!image) {
      console.warn(`🧑‍🎨 : Image not found for stats update: ${imageKey}`);
      return;
    }

    // Save total stats only
    await galleryStorage.save({
      ...image,
      totalColorStats,
    });

    console.log(`🧑‍🎨 : Saved total stats for ${imageKey} to storage`);
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save total stats for ${imageKey}:`, error);
  }
};

/**
 * Request total stats computation for a newly saved image
 * Called after image is saved to storage
 */
export const requestTotalStatsComputation = (
  imageKey: string,
  dataUrl: string
) => {
  window.postMessage(
    {
      source: "mr-wplace-compute-total-stats",
      imageKey,
      dataUrl,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Requested total stats computation for ${imageKey}`);
};

/**
 * Send text layers to inject side for overlay rendering
 */
export const sendTextLayersToInject = async () => {
  const { TextLayerStorage } = await import(
    "@/features/text-draw/text-layer-storage"
  );
  const textLayerStorage = new TextLayerStorage();
  const textLayers = await textLayerStorage.getAll();

  window.postMessage(
    {
      source: "mr-wplace-text-layers",
      textLayers,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent ${textLayers.length} text layers to inject side`);
};

/**
 * Send tile boundaries visibility to inject side
 */
export const sendTileBoundariesToInject = async () => {
  const { loadTileBoundariesFromStorage, getTileBoundaries } = await import(
    "@/states/tile-boundaries"
  );
  await loadTileBoundariesFromStorage();
  const visible = getTileBoundaries();

  window.postMessage(
    {
      source: "mr-wplace-tile-boundaries-update",
      visible,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent tile boundaries visibility to inject side: ${visible}`
  );
};

(async () => {
  try {
    // Log initial memory usage (Chrome only)
    const initialMemory = (performance as any).memory?.usedJSHeapSize;
    if (initialMemory) {
      console.log(`🧑‍🎨: Initial memory usage: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
    }

    console.log("🧑‍🎨: Starting initialization...");

    // Fetchインターセプターの注入
    {
      const script = document.createElement("script");
      script.src = runtime.getURL("dist/inject.js");
      // scriptタグをheadの先頭に挿入
      (document.head || document.documentElement).prepend(script);

      // Wait for inject script to load and setup fetch interceptor
      await new Promise<void>((resolve) => {
        script.onload = () => {
          script.remove();
          // Add a small delay to ensure synchronous code in inject.js has executed
          setTimeout(resolve, 10);
        };
        script.onerror = () => {
          console.error("🧑‍🎨: Failed to load inject.js");
          resolve(); // Continue anyway
        };
      });

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

    // TileSnapshot initialization (needed for message listener)
    const tileSnapshot = new TileSnapshot();

    // NotificationModal initialization (for user status modal)
    const notificationModal = new NotificationModal();

    // Listen for messages from inject.js
    let lastPixelClickColorId: number | null = null;

    window.addEventListener("message", async (event) => {
      // console.log("🧑‍🎨: event", event.data.source);
      if (event.data.source === "wplace-studio-snapshot") {
        const { tileBlob, tileX, tileY } = event.data;
        await tileSnapshot.saveTmpTile(tileX, tileY, tileBlob);

        // Record current tile for processing optimization
        addCurrentTile(tileX, tileY);
      }

      // User data is now handled directly in inject context
      // But we still handle modal open requests
      if (event.data.source === "mr-wplace-open-user-modal") {
        const userData = event.data.userData;
        notificationModal.show(userData);
      }

      // Listen for stats update from inject.js (after tile rendering)
      // This is called when a tile is rendered and statistics are computed
      // Statistics are saved to storage for persistence across reloads
      if (event.data.source === "mr-wplace-stats-updated") {
        const { imageKey, tileStatsMap } = event.data;
        await handleStatsComputed(imageKey, tileStatsMap);
      }

      // Listen for total stats computation from inject.js
      if (event.data.source === "mr-wplace-total-stats-computed") {
        const { imageKey, totalColorStats } = event.data;
        await handleTotalStatsComputed(imageKey, totalColorStats);
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

    // i18n初期化（ブラウザ言語検出）
    await I18nManager.init(detectBrowserLanguage());

    // DI Container登録
    di.register("gallery", galleryAPI);
    di.register("textDraw", textDrawAPI);
    di.register("bookmark", bookmarkAPI);
    di.register("drawingLoader", drawingLoaderAPI);
    di.register("timeTravel", timeTravelAPI);
    di.register("friendsBook", friendsBookAPI);

    // Feature初期化
    bookmarkAPI.initBookmark(); // 1. Bookmark (最後に表示)
    friendsBookAPI.initFriendsBook(); // Friends book
    const tileOverlay = new TileOverlay();
    timeTravelAPI.initTimeTravel(); // 2. TimeTravel
    galleryAPI.initGallery();
    new Drawing(); // 4. Drawing (最初に表示)
    drawingLoaderAPI.initDrawingLoader();
    new ColorFilter();
    const colorFilterManager = new ColorFilterManager();
    const colorIsolate = new ColorIsolate();
    const autoSpoit = new AutoSpoit(colorFilterManager, colorIsolate);
    new PositionInfo();
    new PaletteToggle();
    new ShowUnplacedOnly();
    initPaintStats();

    // Initialize async features in parallel
    await Promise.all([
      textDrawAPI.initTextDraw(), // 3. TextDraw
      darkThemeAPI.initDarkTheme(), // 5. DarkTheme
      highContrastAPI.initHighContrast(), // 6. HighContrast
      dataSaverAPI.initDataSaver(), // 7. DataSaver
    ]);

    // 初期化完了を待つ
    await colorFilterManager.init();

    // GalleryとTileOverlayの連携設定（DI経由）
    galleryAPI.setDrawToggleCallback(async (imageKey: string) => {
      const result = await tileOverlay.toggleImageDrawState(imageKey);
      // Send updated gallery images to inject side
      await sendGalleryImagesToInject();
      return result;
    });

    // Send initial data to inject side (in parallel)
    await Promise.all([
      sendGalleryImagesToInject(),
      sendSnapshotsToInject(),
      sendComputeDeviceToInject(),
      sendTileBoundariesToInject(),
      sendCacheSizeToInject(),
    ]);
    sendColorFilterToInject(colorFilterManager);

    // Global access for ImageProcessor and Gallery
    // IMPORTANT: Use Object.assign to preserve existing properties (e.g., wplaceChargeData)
    Object.assign(window.mrWplace, {
      colorFilterManager,
      tileOverlay,
      tileSnapshot,
      autoSpoit,
    });

    // Log final memory usage (Chrome only)
    const finalMemory = (performance as any).memory?.usedJSHeapSize;
    if (finalMemory && initialMemory) {
      const memoryIncrease = finalMemory - initialMemory;
      console.log(`🧑‍🎨: Final memory usage: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`🧑‍🎨: Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }
  } catch (error) {
    console.error("🧑‍🎨: Failed to initialize", error);
    if (error instanceof Error) {
      Toast.error(`initialization error: ${error.message}`);
    } else {
      Toast.error(`initialization error: ${String(error)}`);
    }
  }
})();

// メッセージリスナー（言語切替、ギャラリー更新）
runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "LOCALE_CHANGED") {
    // i18nマネージャーの状態を更新
    await I18nManager.init(message.locale);
    return;
  }

  if (message.type === "GALLERY_UPDATED") {
    // ギャラリーデータが更新されたらinject側に同期
    await sendGalleryImagesToInject();
    return;
  }

  if (message.type === "TILE_BOUNDARIES_CHANGED") {
    // タイル境界表示設定が変更されたらinject側に通知
    await sendTileBoundariesToInject();
    return;
  }
});
