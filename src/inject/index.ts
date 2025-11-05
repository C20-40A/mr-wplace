import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMapObserver } from "./map-instance";
import { setupMessageHandler } from "./message-handler";

(async () => {
  // Initialization state
  let isInitialized = false;

  try {
    // Initialize data saver state
    window.mrWplaceDataSaver = {
      enabled: false,
      tileCache: new Map(),
    };

    // Initialize compute device (default: gpu)
    window.mrWplaceComputeDevice = "gpu";

    // Setup fetch interceptor
    try {
      await setupFetchInterceptor(() => isInitialized);
    } catch (error) {
      console.error("🧑‍🎨: Failed to setup fetch interceptor:", error);
    }

    // Setup message handler
    try {
      setupMessageHandler();
    } catch (error) {
      console.error("🧑‍🎨: Failed to setup message handler:", error);
    }

    // Setup map observer
    try {
      setupMapObserver();
    } catch (error) {
      console.error("🧑‍🎨: Failed to setup map observer:", error);
    }

    // Mark as initialized (even if some features failed)
    isInitialized = true;
    console.log("🧑‍🎨: Initialization complete");
  } catch (error) {
    console.error("🧑‍🎨: Critical initialization error:", error);
    // Try to mark as initialized anyway
    isInitialized = true;
  }
})();
