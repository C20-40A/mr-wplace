/**
 * Feature Initializer - Orchestrates all feature initialization
 */

import { I18nManager } from "@/i18n/manager";
import { detectBrowserLanguage } from "@/i18n/index";
import { bookmarkAPI } from "@/features/bookmark";
import { TileOverlay } from "@/features/tile-overlay";
import { galleryAPI } from "@/features/gallery";
import { Drawing } from "@/features/drawing";
import { timeTravelAPI } from "@/features/time-travel";
import { drawingLoaderAPI } from "@/features/drawing-loader";
import { friendsBookAPI } from "@/features/friends-book";
import { ColorFilter } from "@/features/color-filter";
import { ColorFilterManager } from "@/utils/color-filter-manager";
import { textDrawAPI } from "@/features/text-draw";
import { mapFilterMenuAPI, dataSaverAPI } from "@/features/map-filter";
import { distanceMeasureAPI } from "@/features/distance-measure";
import { areaManagerAPI } from "@/features/area-manager";
import { DevInject } from "@/features/developer";
import { ColorIsolate } from "@/features/color-isolate";
import { PositionInfo } from "@/features/position-info";
import { initPaintStats } from "@/features/paint-stats";
import { PaletteToggle } from "@/features/palette-toggle";
import { ShowUnplacedOnly } from "@/features/show-unplaced-only";
import { LockButtonEnhancer } from "@/features/lock-button-enhancer";
import { PaintPixelIcon } from "@/features/paint-pixel-icon";
import { CloseConfirm } from "@/features/close-confirm";
import { PaintModeStyle } from "@/features/paint-mode-style";
import { di } from "@/core/di";
import {
  sendGalleryImagesToInject,
  sendColorFilterToInject,
  sendComputeDeviceToInject,
  sendCacheSizeToInject,
} from "@/core/bridge";
import { sendSnapshotsToInject } from "@/utils/inject-bridge";

/**
 * Safe wrapper for feature initialization
 */
const safeInit = (name: string, fn: () => void): void => {
  try {
    fn();
  } catch (e) {
    console.error(`🧑‍🎨: ${name} init failed:`, e);
  }
};

/**
 * Safe wrapper for async feature initialization
 */
const safeInitAsync = async (
  name: string,
  fn: () => Promise<void>
): Promise<void> => {
  try {
    await fn();
  } catch (e) {
    console.error(`🧑‍🎨: ${name} init failed:`, e);
  }
};

/**
 * Initialize all features and return global instances
 */
export const initializeFeatures = async () => {
  console.log("🧑‍🎨: Starting feature initialization...");

  // i18n初期化（ブラウザ言語検出）
  await I18nManager.init(detectBrowserLanguage());

  // DI Container登録
  di.register("gallery", galleryAPI);
  di.register("textDraw", textDrawAPI);
  di.register("bookmark", bookmarkAPI);
  di.register("drawingLoader", drawingLoaderAPI);
  di.register("timeTravel", timeTravelAPI);
  di.register("friendsBook", friendsBookAPI);

  // Feature初期化 - 各featureは独立して初期化（1つ失敗しても他は継続）
  safeInit("bookmark", () => bookmarkAPI.initBookmark());
  safeInit("friendsBook", () => friendsBookAPI.initFriendsBook());
  const tileOverlay = new TileOverlay();
  safeInit("timeTravel", () => timeTravelAPI.initTimeTravel());
  safeInit("gallery", () => galleryAPI.initGallery());
  safeInit("drawing", () => new Drawing());
  safeInit("drawingLoader", () => drawingLoaderAPI.initDrawingLoader());
  safeInit("colorFilter", () => new ColorFilter());
  const colorFilterManager = new ColorFilterManager();
  const colorIsolate = new ColorIsolate();
  const autoSpoit = new DevInject(colorFilterManager, colorIsolate);
  safeInit("positionInfo", () => new PositionInfo());
  safeInit("paletteToggle", () => new PaletteToggle());
  safeInit("showUnplacedOnly", () => new ShowUnplacedOnly());
  safeInit("lockButtonEnhancer", () => new LockButtonEnhancer());
  safeInit("paintPixelIcon", () => new PaintPixelIcon());
  safeInit("closeConfirm", () => new CloseConfirm());
  safeInit("paintModeStyle", () => new PaintModeStyle());
  safeInit("paintStats", () => initPaintStats());

  // Initialize async features in parallel (each wrapped for error isolation)
  await Promise.all([
    safeInitAsync("textDraw", () => textDrawAPI.initTextDraw()),
    safeInitAsync("mapFilterMenu", () => mapFilterMenuAPI.initMapFilterMenu()),
    safeInitAsync("distanceMeasure", () => distanceMeasureAPI.initDistanceMeasure()),
    safeInitAsync("areaManager", () => areaManagerAPI.initAreaManager()),
    safeInitAsync("dataSaver", () => dataSaverAPI.initDataSaver()),
  ]);

  // colorFilterManager.init() - 遅延実行（UI表示をブロックしない）
  colorFilterManager.init().catch((e) => {
    console.error("🧑‍🎨: colorFilterManager init failed:", e);
  });

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
    sendCacheSizeToInject(),
  ]);
  sendColorFilterToInject(colorFilterManager);

  console.log("🧑‍🎨: Feature initialization complete");

  return {
    colorFilterManager,
    tileOverlay,
    autoSpoit,
  };
};
