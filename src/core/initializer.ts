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
import {
  darkThemeAPI,
  highContrastAPI,
  tileBoundariesAPI,
  dataSaverAPI,
} from "@/features/map-filter";
import { layerSortAPI } from "@/features/layer-sort";
import { DevInject } from "@/features/developer";
import { ColorIsolate } from "@/features/color-isolate";
import { PositionInfo } from "@/features/position-info";
import { initPaintStats } from "@/features/paint-stats";
import { PaletteToggle } from "@/features/palette-toggle";
import { ShowUnplacedOnly } from "@/features/show-unplaced-only";
import { LockButtonEnhancer } from "@/features/lock-button-enhancer";
import { PaintPixelIcon } from "@/features/paint-pixel-icon";
import { CloseConfirm } from "@/features/close-confirm";
import { di } from "@/core/di";
import {
  sendGalleryImagesToInject,
  sendColorFilterToInject,
  sendComputeDeviceToInject,
  sendCacheSizeToInject,
} from "@/core/bridge";
import { sendSnapshotsToInject } from "@/utils/inject-bridge";

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
  const autoSpoit = new DevInject(colorFilterManager, colorIsolate);
  new PositionInfo();
  new PaletteToggle();
  new ShowUnplacedOnly();
  new LockButtonEnhancer();
  new PaintPixelIcon();
  new CloseConfirm();
  initPaintStats();

  // Initialize async features in parallel
  await Promise.all([
    textDrawAPI.initTextDraw(), // 3. TextDraw
    darkThemeAPI.initDarkTheme(), // 5. DarkTheme
    highContrastAPI.initHighContrast(), // 6. HighContrast
    tileBoundariesAPI.initTileBoundaries(), // 7. TileBoundaries
    dataSaverAPI.initDataSaver(), // 8. DataSaver
    layerSortAPI.initLayerSort(), // 9. LayerSort
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
