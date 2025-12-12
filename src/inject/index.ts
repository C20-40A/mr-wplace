import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMapObserver } from "./map-instance";
import { setupMessageHandler } from "./message-handler";
import { tileCacheDB } from "./cache-storage";
import { initGalleryRepository } from "./db/gallery-repository";

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
    // Log initial memory usage (Chrome only)
    const initialMemory = (performance as any).memory?.usedJSHeapSize;
    if (initialMemory) {
      console.log(
        `🧑‍🎨 (inject): Initial memory usage: ${(
          initialMemory /
          1024 /
          1024
        ).toFixed(2)}MB`
      );
    }

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

      // Setup message handler (includes Gallery V2 bridge handlers)
      Promise.resolve(setupMessageHandler()).catch((error) => {
        console.error("🧑‍🎨: Failed to setup message handler:", error);
      }),

      // Setup map observer
      Promise.resolve(setupMapObserver()).catch((error) => {
        console.error("🧑‍🎨: Failed to setup map observer:", error);
      }),
    ]);

    console.log("🧑‍🎨: Async initialization complete");

    // Log final memory usage (Chrome only)
    const finalMemory = (performance as any).memory?.usedJSHeapSize;
    if (finalMemory && initialMemory) {
      const memoryIncrease = finalMemory - initialMemory;
      console.log(
        `🧑‍🎨 (inject): Final memory usage: ${(finalMemory / 1024 / 1024).toFixed(
          2
        )}MB`
      );
      console.log(
        `🧑‍🎨 (inject): Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(
          2
        )}MB`
      );
    }
  } catch (error) {
    console.error("🧑‍🎨: Critical initialization error:", error);
  }
})();
