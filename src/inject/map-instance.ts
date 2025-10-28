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
 * Setup map instance observer and capture it
 */
export const setupMapObserver = (initialTheme: "light" | "dark"): void => {
  const mapObserver = new MutationObserver(() => {
    try {
      const mapElement = document.querySelector(
        "div.absolute.bottom-3.right-3.z-30"
      );
      if (
        mapElement &&
        mapElement.childNodes[0] &&
        (mapElement.childNodes[0] as any).__click
      ) {
        const map = (mapElement.childNodes[0] as any).__click[3].v;
        if (map && typeof map.version === "string") {
          window.wplaceMap = map;
          mapObserver.disconnect();
          console.log("🧑‍🎨 : WPlace map instance captured", map);

          // Apply initial theme
          if (initialTheme === "dark") {
            applyTheme(map, "dark");
          }

          // Setup mouse events for pixel detection
          setupPixelDetection(map);
        }
      }
    } catch (e) {
      // Continue observing
    }
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
    // Skip if dev mode is disabled
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
    if (e.code === "Space") {
      isSpacePressed = true;
    }
  });

  document.addEventListener("keyup", (e: KeyboardEvent) => {
    if (e.code === "Space") {
      isSpacePressed = false;
    }
  });

  map.on("mousemove", (e: any) => {
    if (!isSpacePressed) return;
    // Skip if dev mode is disabled
    if (!isAutoSpoitDevModeEnabled()) return;
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
