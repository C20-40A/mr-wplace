import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMessageHandler } from "./bridge";
import { tileCacheDB } from "./cache-storage";
import { initGalleryRepository } from "./db/gallery-repository";
import { initSnapshotRepository } from "./db/snapshot-repository";
import { resolveMapInstanceAsync } from "./features/map-instance";

// CRITICAL: Setup fetch interceptor IMMEDIATELY and SYNCHRONOUSLY
// to catch /me requests before WPlace app code runs
(() => {
  console.log("🧑‍🎨: Setting up fetch interceptor (sync)...");

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

  // Initialize layer sort enabled (default: true)
  window.mrWplaceLayerSortEnabled = true;

  // Setup fetch interceptor synchronously (no await)
  try {
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
            "*"
          );

          // Setup layer sort with styledata event listener
          const { setupLayerSortOnMapReady } = await import(
            "./features/map-instance"
          );
          setupLayerSortOnMapReady(mapInstance);

          // Setup grid display with styledata event listener
          const { setupGridDisplayOnMapReady } = await import(
            "./features/grid-display"
          );
          setupGridDisplayOnMapReady(mapInstance);
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
