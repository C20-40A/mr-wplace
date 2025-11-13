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
import {
  darkThemeAPI,
  highContrastAPI,
  dataSaverAPI,
} from "@/features/map-filter";
import { AutoSpoit } from "@/features/auto-spoit";
import { ColorIsolate } from "@/features/color-isolate";
import { PositionInfo } from "@/features/position-info";
import { initPaintStats } from "@/features/paint-stats";
import { PaletteToggle } from "@/features/palette-toggle";
import { colorpalette } from "@/constants/colors";
import { addCurrentTile } from "@/states/currentTile";
import { di } from "@/core/di";
import { runtime } from "@/utils/browser-api";
import { getOverlayPixelColor } from "@/utils/inject-bridge";

/**
 * Send gallery images to inject side for tile processing
 * IMPORTANT: Call this after any gallery image changes (add, move, toggle, delete)
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
    }));

  window.postMessage(
    {
      source: "mr-wplace-gallery-images",
      images: enabledImages,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent ${enabledImages.length} gallery images to inject side`);
};

/**
 * Send compute device setting to inject side
 */
export const sendComputeDeviceToInject = async () => {
  const { ColorPaletteStorage } = await import("@/components/color-palette/storage");
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
 * Send color filter state to inject side
 */
export const sendColorFilterToInject = (colorFilterManager: ColorFilterManager) => {
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
 * Send active snapshots to inject side for overlay rendering
 */
export const sendSnapshotsToInject = async () => {
  const { TimeTravelStorage } = await import("@/features/time-travel/storage");
  const { storage } = await import("@/utils/browser-api");

  const drawStates = await TimeTravelStorage.getDrawStates();
  const enabledStates = drawStates.filter((s) => s.drawEnabled);

  // Convert snapshots in parallel
  const snapshots = await Promise.all(
    enabledStates.map(async (state) => {
      const snapshotData = await storage.get([state.fullKey]);
      const rawData = snapshotData[state.fullKey];

      if (!rawData) return null;

      // Convert Uint8Array to blob to dataUrl
      const uint8Array = new Uint8Array(rawData);
      const blob = new Blob([uint8Array], { type: "image/png" });

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      return {
        key: `snapshot_${state.fullKey}`,
        dataUrl,
        tileX: state.tileX,
        tileY: state.tileY,
      };
    })
  ).then((results) => results.filter((s): s is NonNullable<typeof s> => s !== null));

  window.postMessage(
    {
      source: "mr-wplace-snapshots",
      snapshots,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent ${snapshots.length} snapshots to inject side`);
};

/**
 * Handle stats computation notification from inject side
 * Save computed stats to storage
 */
const handleStatsComputed = async (
  imageKey: string,
  tileStatsMap: Record<string, { matched: Record<string, number>; total: Record<string, number> }>
) => {
  try {
    const { GalleryStorage } = await import("@/features/gallery/storage");
    const galleryStorage = new GalleryStorage();

    // Convert object back to Map
    const statsMap = new Map<string, { matched: Map<string, number>; total: Map<string, number> }>();
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
export const requestTotalStatsComputation = (imageKey: string, dataUrl: string) => {
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
  const { TextLayerStorage } = await import("@/features/text-draw/text-layer-storage");
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
  const { loadTileBoundariesFromStorage, getTileBoundaries } = await import("@/states/tile-boundaries");
  await loadTileBoundariesFromStorage();
  const visible = getTileBoundaries();

  window.postMessage(
    {
      source: "mr-wplace-tile-boundaries-update",
      visible,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent tile boundaries visibility to inject side: ${visible}`);
};

(async () => {
  try {
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

      // Listen for user data from inject.js
      if (event.data.source === "mr-wplace-me") {
        console.log("🧑‍🎨: Received user data:", event.data.userData);
        const userData = event.data.userData as WPlaceUserData;

        userStatus.updateFromUserData(userData);
      }

      // Listen for stats computation from inject.js
      if (event.data.source === "mr-wplace-stats-computed") {
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
    galleryAPI.initGallery();
    new Drawing(); // 4. Drawing (最初に表示)
    drawingLoaderAPI.initDrawingLoader();
    new ColorFilter();
    const colorFilterManager = new ColorFilterManager();
    const autoSpoit = new AutoSpoit();
    new ColorIsolate();
    new PositionInfo();
    new PaletteToggle();
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
      sendComputeDeviceToInject(),
      sendTileBoundariesToInject(),
      sendCacheSizeToInject(),
    ]);
    sendColorFilterToInject(colorFilterManager);

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
