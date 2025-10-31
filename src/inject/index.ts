import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMapObserver } from "./map-instance";
import { setupMessageHandler } from "./message-handler";

(async () => {
  // Initialization state
  let isInitialized = false;

  // Initialize data saver state
  window.mrWplaceDataSaver = {
    enabled: false,
    tileCache: new Map(),
  };

  // Initialize compute device (default: gpu)
  window.mrWplaceComputeDevice = "gpu";

  // Setup fetch interceptor
  await setupFetchInterceptor(() => isInitialized);

  // Setup message handler
  setupMessageHandler();

  // Setup map observer
  setupMapObserver();

  // Mark as initialized
  isInitialized = true;
  console.log("🧑‍🎨: Initialization complete");
})();
