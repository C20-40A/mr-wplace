import { applyTheme } from "./theme-manager";

/**
 * Setup message event listener for handling various events
 */
export const setupMessageHandler = (getCurrentTheme: () => "light" | "dark"): void => {
  window.addEventListener("message", (event: MessageEvent) => {
    // Handle processed blob from content script
    if (event.data.source === "mr-wplace-processed") {
      handleProcessedBlob(event.data);
      return;
    }

    // Handle flyTo requests from content script
    if (event.data.source === "wplace-studio-flyto") {
      handleFlyTo(event.data);
      return;
    }

    // Handle theme updates
    if (event.data.source === "mr-wplace-theme-update") {
      handleThemeUpdate(event.data);
      return;
    }

    // Handle data saver updates
    if (event.data.source === "mr-wplace-data-saver-update") {
      handleDataSaverUpdate(event.data);
      return;
    }
  });
};

/**
 * Handle processed blob callback
 */
const handleProcessedBlob = (data: any): void => {
  const { blobID, processedBlob } = data;
  const callback = window.tileProcessingQueue?.get(blobID);

  if (typeof callback === "function") {
    callback(processedBlob);
    window.tileProcessingQueue.delete(blobID);
  }
};

/**
 * Handle flyTo/jumpTo requests
 */
const handleFlyTo = (data: { lat: number; lng: number; zoom: number }): void => {
  const { lat, lng, zoom } = data;

  // If map instance not available, fallback to URL navigation
  if (!window.wplaceMap) {
    console.log("🧑‍🎨 : Map instance not available, using URL navigation");
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
    return;
  }

  // Get current position
  const currentCenter = window.wplaceMap.getCenter();
  const currentZoom = window.wplaceMap.getZoom();

  // Calculate distance (simple lat/lng difference)
  const latDiff = Math.abs(currentCenter.lat - lat);
  const lngDiff = Math.abs(currentCenter.lng - lng);
  const zoomDiff = Math.abs(currentZoom - zoom);

  // If close enough (within ~1km and zoom difference <= 2), use flyTo for smooth animation
  // Otherwise use jumpTo for instant navigation
  const isClose = latDiff < 2 && lngDiff < 2 && zoomDiff <= 2;

  if (isClose) {
    console.log("🧑‍🎨 : Using flyTo (close distance)");
    window.wplaceMap.flyTo({ center: [lng, lat], zoom });
  } else {
    console.log("🧑‍🎨 : Using jumpTo (far distance)");
    window.wplaceMap.jumpTo({ center: [lng, lat], zoom });
  }
};

/**
 * Handle theme update
 */
const handleThemeUpdate = (data: { theme: "light" | "dark" }): void => {
  const theme = data.theme;
  console.log("🧑‍🎨 : Theme updated:", theme);

  if (window.wplaceMap) {
    applyTheme(window.wplaceMap, theme);
  }
};

/**
 * Handle data saver update
 */
const handleDataSaverUpdate = (data: { enabled: boolean }): void => {
  if (window.mrWplaceDataSaver) {
    window.mrWplaceDataSaver.enabled = data.enabled;
    console.log("🧑‍🎨 : Data saver updated:", data.enabled);
  }
};
