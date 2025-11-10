import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMapObserver } from "./map-instance";
import { setupMessageHandler } from "./message-handler";
import { tileCacheDB } from "./cache-storage";

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

  // Initialize compute device (default: gpu)
  window.mrWplaceComputeDevice = "gpu";

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
      // Initialize IndexedDB
      tileCacheDB.init().catch((error) => {
        console.error("🧑‍🎨: Failed to init IndexedDB:", error);
      }),

      // Setup message handler
      Promise.resolve(setupMessageHandler()).catch((error) => {
        console.error("🧑‍🎨: Failed to setup message handler:", error);
      }),

      // Setup map observer
      Promise.resolve(setupMapObserver()).catch((error) => {
        console.error("🧑‍🎨: Failed to setup map observer:", error);
      }),
    ]);

    console.log("🧑‍🎨: Async initialization complete");
  } catch (error) {
    console.error("🧑‍🎨: Critical initialization error:", error);
  }
})();
