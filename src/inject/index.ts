import { setupFetchInterceptor } from "./fetch-interceptor";
import { setupMapObserver } from "./map-instance";
import { setupMessageHandler } from "./message-handler";

(async () => {
  // Initialization state
  let isInitialized = false;
  let currentTheme: "light" | "dark" = "light";

  // Load theme from DOM attribute
  const dataElement = document.getElementById("__mr_wplace_data__");
  if (dataElement) {
    currentTheme = (dataElement.getAttribute("data-theme") || "light") as
      | "light"
      | "dark";
  }

  // Setup fetch interceptor
  await setupFetchInterceptor(() => isInitialized);

  // Setup message handler
  setupMessageHandler(() => currentTheme);

  // Setup map observer
  setupMapObserver(currentTheme);

  // Mark as initialized
  isInitialized = true;
  console.log("🧑‍🎨: Initialization complete, theme:", currentTheme);
})();
