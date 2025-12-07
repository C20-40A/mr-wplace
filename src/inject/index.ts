import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMapObserver } from "./map-instance";
import { setupMessageHandler } from "./message-handler";
import { setupDoctorHandlers } from "./handlers/doctor-handlers";
import { tileCacheDB } from "./cache-storage";
import { openDatabase } from "./db/schema";
import { LayerRepository } from "./db/layer-repository";
import { createMigrationWorker, WorkerMessenger } from "./workers/messaging";
import { setupPerformanceMonitor } from "./utils/performance-monitor";

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
      // Initialize IndexedDB (legacy tile cache)
      tileCacheDB.init().catch((error) => {
        console.error("🧑‍🎨: Failed to init IndexedDB:", error);
      }),

      // Initialize migration architecture (Worker + Repository)
      (async () => {
        try {
          console.log("🧑‍🎨: Initializing migration architecture...");

          // Open IndexedDB for migration
          const db = await openDatabase();
          console.log("🧑‍🎨: Migration database opened");

          // Create LayerRepository
          const repository = new LayerRepository(db);

          // Create Worker and Messenger (using Blob URL - works in inject context)
          const worker = createMigrationWorker();
          const messenger = new WorkerMessenger(worker);

          // Link Worker to Repository
          repository.setWorker(worker);

          // Store in state
          const { setMigrationArchitecture } = await import(
            "./states/migrationState"
          );
          setMigrationArchitecture(repository, messenger);

          console.log("🧑‍🎨: Migration architecture initialized successfully");
          console.log(
            "🧑‍🎨: Worker running in separate thread for optimal performance"
          );
        } catch (error) {
          console.error("🧑‍🎨: Failed to init migration architecture:", error);
        }
      })(),

      // Setup message handler
      Promise.resolve(setupMessageHandler()).catch((error) => {
        console.error("🧑‍🎨: Failed to setup message handler:", error);
      }),

      // Setup doctor handlers (for storage health checks)
      Promise.resolve(setupDoctorHandlers()).catch((error) => {
        console.error("🧑‍🎨: Failed to setup doctor handlers:", error);
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

    // Setup performance monitor (Chrome only)
    // setupPerformanceMonitor();
  } catch (error) {
    console.error("🧑‍🎨: Critical initialization error:", error);
  }
})();
