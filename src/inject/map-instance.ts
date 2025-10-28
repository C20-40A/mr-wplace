import type { WplaceMap } from "./types";
import { applyTheme } from "./theme-manager";

/**
 * Helper function to check if auto spoit dev mode is enabled
 */
const isAutoSpoitDevModeEnabled = (): boolean => {
  const dataElement = document.getElementById("__mr_wplace_data__");
  const devMode = dataElement?.getAttribute("data-auto-spoit-dev-mode");
  return devMode === "true";
};

/**
 * Attempt to extract the map instance from known DOM patterns.
 * Includes a fallback strategy for internationalized buttons.
 */
const getMapInstance = (): WplaceMap | null => {
  try {
    // Primary pattern
    const mapContainer = document.querySelector(
      "div.absolute.bottom-3.right-3.z-30"
    );
    const mapCandidate = (mapContainer?.childNodes?.[0] as any)?.__click?.[3]
      ?.v;
    if (mapCandidate && typeof mapCandidate.version === "string") {
      return mapCandidate;
    }

    // Fallback pattern (Zoom in button, localized)
    const zoomButton =
      document.querySelector<HTMLButtonElement>("button[title='Zoom in']") ||
      document.querySelector<HTMLButtonElement>(
        "button[title='Aumentar zoom']"
      );
    const fallbackMap = (zoomButton as any)?.__click?.[1]?.v;
    if (fallbackMap && typeof fallbackMap.version === "string") {
      return fallbackMap;
    }
  } catch {
    // Ignore and return null
  }

  return null;
};

/**
 * Setup map instance observer and capture it
 */
export const setupMapObserver = (initialTheme: "light" | "dark"): void => {
  const mapObserver = new MutationObserver(() => {
    const map = getMapInstance();
    if (!map) return;

    window.wplaceMap = map;
    mapObserver.disconnect();
    console.log("🧑‍🎨 : WPlace map instance captured", map);

    // Apply initial theme
    if (initialTheme === "dark") {
      applyTheme(map, "dark");
    }

    // Setup mouse events for pixel detection
    setupPixelDetection(map);
  });

  mapObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

/**
 * Setup pixel detection events on map
 */
const setupPixelDetection = (map: WplaceMap): void => {
  // Setup mousedown for pixel color detection
  map.on("mousedown", (e: any) => {
    if (!isAutoSpoitDevModeEnabled()) return;

    const { lat, lng } = e.lngLat;
    window.postMessage(
      {
        source: "wplace-studio-pixel-click",
        lat,
        lng,
      },
      "*"
    );
  });

  // Setup space key + mousemove for continuous color detection
  let isSpacePressed = false;
  let mouseMoveThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  const MOUSE_MOVE_THROTTLE_PERIOD = 10; // ms

  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.code === "Space") isSpacePressed = true;
  });

  document.addEventListener("keyup", (e: KeyboardEvent) => {
    if (e.code === "Space") isSpacePressed = false;
  });

  map.on("mousemove", (e: any) => {
    if (!isSpacePressed || !isAutoSpoitDevModeEnabled()) return;
    if (mouseMoveThrottleTimer !== null) return;

    mouseMoveThrottleTimer = setTimeout(() => {
      const { lat, lng } = e.lngLat;
      window.postMessage(
        {
          source: "wplace-studio-pixel-click",
          lat,
          lng,
        },
        "*"
      );
      mouseMoveThrottleTimer = null;
    }, MOUSE_MOVE_THROTTLE_PERIOD);
  });
};
