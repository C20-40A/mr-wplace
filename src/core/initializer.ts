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
import { MiniColorFilter } from "@/features/mini-color-filter";
import { ColorFilterManager } from "@/utils/color-filter-manager";
import { textDrawAPI } from "@/features/text-draw";
import { mapFilterMenuAPI, dataSaverAPI } from "@/features/map-filter";
import { areaManagerAPI } from "@/features/area-manager";
import { DevInject } from "@/features/developer";
import { ColorIsolate } from "@/features/color-isolate";
import { PositionInfo } from "@/features/position-info";
import { initPaintStats } from "@/features/paint-stats";
import { PaintToolbar } from "@/features/paint-toolbar";
import { PaintTemplateIndicator } from "@/features/paint-template-indicator";
import { PaintGuideToggle } from "@/features/paint-guide-toggle";
import { ShowUnplacedOnly } from "@/features/show-unplaced-only";
import {
  loadSelectedColorOnlyMarkFromStorage,
  getSelectedColorOnlyMark,
} from "@/states/selectedColorOnlyMark";
import { sendSelectedColorOnlyMarkToInject } from "@/core/bridge";
import { LockButtonEnhancer } from "@/features/lock-button-enhancer";
import { restoreLegacyPaletteVisibility } from "@/features/legacy-palette-cleanup";
import { UserStatusHint } from "@/features/user-status-hint";
import { CloseConfirm } from "@/features/close-confirm";
import { PaintModeStyle } from "@/features/paint-mode-style";
import { HideMyLocation } from "@/features/hide-my-location";
import { FocusMode } from "@/features/focus-mode";
import { initShareEnhancer } from "@/features/share-enhancer";
import { TileCropSave } from "@/features/tile-crop-save";
import { DraftDraw } from "@/features/draft-draw";
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
  fn: () => Promise<void>,
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
  safeInit("miniColorFilter", () => new MiniColorFilter());
  const colorFilterManager = new ColorFilterManager();
  safeInit("paintToolbar", () => new PaintToolbar());
  safeInitAsync("legacyPaletteCleanup", restoreLegacyPaletteVisibility);
  safeInit("paintGuideToggle", () => new PaintGuideToggle());
  const colorIsolate = new ColorIsolate();
  const autoSpoit = new DevInject(colorFilterManager, colorIsolate);
  safeInit("positionInfo", () => new PositionInfo());
  safeInit("showUnplacedOnly", () => new ShowUnplacedOnly());
  safeInitAsync("selectedColorOnlyMark", async () => {
    await loadSelectedColorOnlyMarkFromStorage();
    sendSelectedColorOnlyMarkToInject(getSelectedColorOnlyMark());
  });
  safeInit("lockButtonEnhancer", () => new LockButtonEnhancer());
  safeInit("userStatusHint", () => new UserStatusHint());
  safeInit("closeConfirm", () => new CloseConfirm());
  safeInit("paintModeStyle", () => new PaintModeStyle());
  safeInit("hideMyLocation", () => new HideMyLocation());
  safeInit("focusMode", () => new FocusMode());
  safeInit("tileCropSave", () => new TileCropSave());
  safeInit("draftDraw", () => new DraftDraw());
  safeInit("paintStats", () => initPaintStats());
  safeInit("paintTemplateIndicator", () => new PaintTemplateIndicator());
  safeInit("shareEnhancer", () => initShareEnhancer());

  // Initialize async features in parallel (each wrapped for error isolation)
  await Promise.all([
    safeInitAsync("textDraw", () => textDrawAPI.initTextDraw()),
    safeInitAsync("mapFilterMenu", () => mapFilterMenuAPI.initMapFilterMenu()),
    safeInitAsync("areaManager", () => areaManagerAPI.initAreaManager()),
    safeInitAsync("dataSaver", () => dataSaverAPI.initDataSaver()),
  ]);

  // colorFilterManager.init() - 遅延実行（UI表示をブロックしない）
  colorFilterManager
    .init()
    .then(() => {
      sendColorFilterToInject(colorFilterManager);
      ColorFilter.getInstance()?.refreshFABBadge();
    })
    .catch((e) => {
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
