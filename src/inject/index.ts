import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMessageHandler } from "./bridge";
import { tileCacheDB } from "./cache-storage";
import { initGalleryRepository } from "./db/gallery-repository";
import { initSnapshotRepository } from "./db/snapshot-repository";
import { requestPersistentStorage } from "./storage-persistence";
import {
  resolveMapInstanceAsync,
  setFrontTilePaintGuideActive,
  clearFrontTilePaintGuide,
  clearFrontTilePaintGuideAll,
  setupPaintedCoordinatesCapture,
  setPaintListener,
  setPaintSessionListener,
  setPaintDeleteListener,
  setPaintClearListener,
} from "./features/map-instance";
import {
  handlePaintForStats,
  handlePaintDeleteForStats,
} from "./features/paint-stats-updater";
import {
  CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED,
  logCustomGeoJsonDisabled,
} from "./features/custom-geojson-guard";

const LOCATION_KEY = "location";
const STARTUP_TARGET_ZOOM = 11;

const forceStartupLocationZoom = (): void => {
  try {
    const raw = window.localStorage.getItem(LOCATION_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as {
      lat?: unknown;
      lng?: unknown;
      zoom?: unknown;
    };

    if (!parsed || typeof parsed !== "object") return;
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number")
      return;
    if (typeof parsed.zoom === "number" && parsed.zoom >= STARTUP_TARGET_ZOOM)
      return;

    const next = JSON.stringify({
      ...parsed,
      zoom: STARTUP_TARGET_ZOOM,
    });
    window.localStorage.setItem(LOCATION_KEY, next);
    console.log("🧑‍🎨 : Forced startup location zoom to", STARTUP_TARGET_ZOOM);
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to force startup location zoom:", error);
  }
};

// CRITICAL: Setup fetch interceptor IMMEDIATELY and SYNCHRONOUSLY
// to catch /me requests before WPlace app code runs
(() => {
  console.log("🧑‍🎨: Setting up fetch interceptor (sync)...");

  forceStartupLocationZoom();

  // Initialize data saver state synchronously
  window.mrWplaceDataSaver = {
    enabled: false,
    tileCache: new Map(),
    maxCacheSize: 100, // Default value, will be synced from content script
    tileCacheDB, // IndexedDB will be initialized asynchronously later
  };

  // Global instance初期化
  window.mrWplace = {} as any;

  // Initialize compute device (default: gpu)
  window.mrWplaceComputeDevice = "gpu";

  // Initialize show unplaced only (default: false)
  window.mrWplaceShowUnplacedOnly = false;

  // Initialize overlay lightweight mode (default: false)
  window.mrWplaceOverlayLightweightMode = false;

  // Initialize selected color only mark (default: false)
  window.mrWplaceSelectedColorOnlyMark = false;

  // Initialize front tile layer (experimental, default: false)
  window.mrWplaceFrontTileLayerEnabled = false;

  // Snapshot capture for time-travel tmp tiles (default: off)
  window.mrWplaceSnapshotCaptureEnabled = false;

  // Setup fetch interceptor synchronously (no await)
  try {
    setupPaintedCoordinatesCapture();
    setPaintListener(handlePaintForStats);
    setPaintDeleteListener((coord) => {
      handlePaintDeleteForStats(coord);
      const { tileX, tileY, pixelX, pixelY } = coord;
      clearFrontTilePaintGuide(tileX, tileY, pixelX, pixelY);
    });
    setPaintClearListener(() => {
      clearFrontTilePaintGuideAll();
    });
    setPaintSessionListener((active) => {
      setFrontTilePaintGuideActive(active, { clearNow: !active });
    });
    setupFetchInterceptor();
    console.log("🧑‍🎨: Fetch interceptor ready");
  } catch (error) {
    console.error("🧑‍🎨: Failed to setup fetch interceptor:", error);
  }
})();

// Initialize other features asynchronously in parallel
(async () => {
  try {
    console.log("🧑‍🎨: Starting async initialization...");

    // Run initialization tasks in parallel
    await Promise.all([
      // Request persistent storage to protect gallery-v2 / snapshots from eviction
      requestPersistentStorage(),

      // Initialize IndexedDB (legacy tile cache for data-saver)
      tileCacheDB.init().catch((error) => {
        console.error("🧑‍🎨: Failed to init tile cache DB:", error);
      }),

      // Initialize Gallery Repository (v2 IndexedDB)
      initGalleryRepository()
        .then(() => console.log("🧑‍🎨: Gallery repository v2 initialized"))
        .catch((error) => {
          console.error("🧑‍🎨: Failed to init gallery repository:", error);
        }),

      // Initialize Snapshot Repository (IndexedDB)
      initSnapshotRepository()
        .then(() => console.log("🧑‍🎨: Snapshot repository initialized"))
        .catch((error) => {
          console.error("🧑‍🎨: Failed to init snapshot repository:", error);
        }),

      // Setup message handler (includes Gallery V2 bridge handlers)
      Promise.resolve(setupMessageHandler()).catch((error) => {
        console.error("🧑‍🎨: Failed to setup message handler:", error);
      }),

      // Capture WPlace map instance
      resolveMapInstanceAsync().then(async (mapInstance) => {
        if (mapInstance && window.mrWplace) {
          window.mrWplace.wplaceMap = mapInstance;
          // Notify content script that map instance is ready
          window.postMessage(
            {
              source: "mr-wplace-map-instance-captured",
              ready: true,
            },
            "*",
          );

          // Setup front tile layer with styledata event listener
          const { setupFrontTileLayerOnMapReady } =
            await import("./features/map-instance");
          setupFrontTileLayerOnMapReady(mapInstance);

          // Setup grid display with styledata event listener
          if (!CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED) {
            const { setupGridDisplayOnMapReady } =
              await import("./features/grid-display");
            setupGridDisplayOnMapReady(mapInstance);
          } else {
            logCustomGeoJsonDisabled("Grid display");
          }

          // Setup scale display with styledata event listener
          const { setupScaleDisplayOnMapReady } =
            await import("./features/scale-display");
          setupScaleDisplayOnMapReady(mapInstance);

          // Setup area measure with styledata event listener
          if (!CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED) {
            const { setupAreaMeasureOnMapReady } =
              await import("./features/area-display");
            setupAreaMeasureOnMapReady(mapInstance);
          } else {
            logCustomGeoJsonDisabled("Area display");
          }
        }
      }),

      // Setup map observer
      // Promise.resolve(setupMapObserver()).catch((error) => {
      //   console.error("🧑‍🎨: Failed to setup map observer:", error);
      // }),
    ]);

    console.log("🧑‍🎨: Async initialization complete");
  } catch (error) {
    console.error("🧑‍🎨: Critical initialization error:", error);
  }
})();
