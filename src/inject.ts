type TileProcessingCallback = (processedBlob: Blob) => void;

interface TileProcessingQueue extends Map<string, TileProcessingCallback> {}

interface WplaceMap {
  version: string;
  getCenter: () => { lat: number; lng: number };
  getZoom: () => number;
  flyTo: (options: { center: [number, number]; zoom: number }) => void;
  jumpTo: (options: { center: [number, number]; zoom: number }) => void;
  setPaintProperty: (layer: string, property: string, value: any) => void;
  on: (event: string, handler: (e: any) => void) => void;
}

interface WindowWithWplace extends Window {
  wplaceMap?: WplaceMap;
  tileProcessingQueue?: TileProcessingQueue;
}

declare const window: WindowWithWplace;

(async () => {
  const originalFetch = window.fetch;

  // 初期化用変数
  let currentTheme = "light";
  let isInitialized = false;

  // Helper function to apply theme to map
  const applyTheme = (map: WplaceMap, theme: "light" | "dark") => {
    if (theme === "dark") {
      // Background & Water
      map.setPaintProperty("background", "background-color", "#111");
      map.setPaintProperty("water", "fill-color", "#222");

      // Landcover
      map.setPaintProperty("park", "fill-color", "#2a4a2a");
      map.setPaintProperty("park_outline", "line-color", "#3a5a3a");
      map.setPaintProperty("landcover_grass", "fill-color", "#2a3a2a");
      map.setPaintProperty("landcover_sand", "fill-color", "#3a3a2a");
      map.setPaintProperty("landcover_ice", "fill-color", "#2a3a3a");

      // Roads
      map.setPaintProperty("road_motorway", "line-color", "#4a4a3a");
      map.setPaintProperty("road_motorway_link", "line-color", "#4a4a3a");
      map.setPaintProperty("road_trunk_primary", "line-color", "#4a4a3a");
      map.setPaintProperty("road_secondary_tertiary", "line-color", "#3a3a3a");
      map.setPaintProperty("road_minor", "line-color", "#3a3a3a");
      map.setPaintProperty("road_link", "line-color", "#3a3a3a");
      map.setPaintProperty("road_service_track", "line-color", "#2a2a2a");

      // Bridges
      map.setPaintProperty("bridge_motorway", "line-color", "#4a4a3a");
      map.setPaintProperty("bridge_motorway_link", "line-color", "#4a4a3a");
      map.setPaintProperty("bridge_trunk_primary", "line-color", "#4a4a3a");
      map.setPaintProperty("bridge_secondary_tertiary", "line-color", "#3a3a3a");
      map.setPaintProperty("bridge_street", "line-color", "#3a3a3a");
      map.setPaintProperty("bridge_link", "line-color", "#3a3a3a");
      map.setPaintProperty("bridge_service_track", "line-color", "#2a2a2a");

      console.log("🧑‍🎨 : Applied dark theme to map");
    } else {
      // Reset to light theme (default values)
      map.setPaintProperty("background", "background-color", "#f8f4f0");
      map.setPaintProperty("water", "fill-color", "rgb(158,189,255)");

      // Landcover
      map.setPaintProperty("park", "fill-color", "#d8e8c8");
      map.setPaintProperty("park_outline", "line-color", "rgba(228, 241, 215, 1)");
      map.setPaintProperty("landcover_grass", "fill-color", "rgba(176, 213, 154, 1)");
      map.setPaintProperty("landcover_sand", "fill-color", "rgba(247, 239, 195, 1)");
      map.setPaintProperty("landcover_ice", "fill-color", "rgba(224, 236, 236, 1)");

      // Roads (restore original interpolate/colors)
      map.setPaintProperty("road_motorway", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        "hsl(26,87%,62%)",
        6,
        "#fc8",
      ]);
      map.setPaintProperty("road_motorway_link", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        "hsl(26,87%,62%)",
        6,
        "#fc8",
      ]);
      map.setPaintProperty("road_trunk_primary", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        "#fea",
        12,
        "#fff",
      ]);
      map.setPaintProperty("road_secondary_tertiary", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        "#f4f4f4",
        12,
        "#fff",
      ]);
      map.setPaintProperty("road_minor", "line-color", "#fff");
      map.setPaintProperty("road_link", "line-color", "#fff");
      map.setPaintProperty("road_service_track", "line-color", "#fff");

      // Bridges (restore original colors)
      map.setPaintProperty("bridge_motorway", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        "hsl(26,87%,62%)",
        6,
        "#fc8",
      ]);
      map.setPaintProperty("bridge_motorway_link", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        "hsl(26,87%,62%)",
        6,
        "#fc8",
      ]);
      map.setPaintProperty("bridge_trunk_primary", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        "#fea",
        12,
        "#fff",
      ]);
      map.setPaintProperty("bridge_secondary_tertiary", "line-color", [
        "interpolate",
        ["linear"],
        ["zoom"],
        8,
        "#f4f4f4",
        12,
        "#fff",
      ]);
      map.setPaintProperty("bridge_street", "line-color", "#fff");
      map.setPaintProperty("bridge_link", "line-color", "#fff");
      map.setPaintProperty("bridge_service_track", "line-color", "#fff");

      console.log("🧑‍🎨 : Applied light theme to map");
    }
  };

  // fetchの上書き
  window.fetch = async function (...args): Promise<Response> {
    // 初期化完了待機
    while (!isInitialized) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const requestInfo = args[0];
    const url =
      typeof requestInfo === "string" ? requestInfo : requestInfo.url || "";

    if (!url || !url.includes("backend.wplace.live")) {
      return originalFetch.apply(this, args);
    }

    // Intercept /me endpoint for user data
    if (url.includes("/me")) {
      console.log("🧑‍🎨: Intercepting /me endpoint:", url);
      const response = await originalFetch.apply(this, args);
      const clonedResponse = response.clone();

      try {
        const jsonData = await clonedResponse.json();
        console.log("🧑‍🎨: Parsed json:", jsonData);
        window.postMessage(
          {
            source: "mr-wplace-me",
            userData: jsonData,
          },
          "*"
        );
      } catch (error) {
        console.error("Failed to parse /me response:", error);
      }

      return response;
    }

    // Intercept all tile requests
    if (url.includes("tiles/") && url.endsWith(".png")) {
      // Extract tileX, tileY from URL
      const tileMatch = url.match(/tiles\/(\d+)\/(\d+)\.png/);
      if (!tileMatch) {
        return originalFetch.apply(this, args);
      }

      const tileX = parseInt(tileMatch[1], 10);
      const tileY = parseInt(tileMatch[2], 10);

      const response = await originalFetch.apply(this, args);
      const clonedResponse = response.clone();

      try {
        const blob = await clonedResponse.blob();

        return new Promise((resolve) => {
          const blobUUID = crypto.randomUUID();

          // Store callback for processed blob
          window.tileProcessingQueue = window.tileProcessingQueue || new Map();
          window.tileProcessingQueue.set(blobUUID, (processedBlob: Blob) => {
            resolve(
              new Response(processedBlob, {
                headers: response.headers,
                status: response.status,
                statusText: response.statusText,
              })
            );
          });

          // Send original tile for snapshot (tmp save)
          window.postMessage(
            {
              source: "wplace-studio-snapshot-tmp",
              tileBlob: blob,
              tileX: tileX,
              tileY: tileY,
            },
            "*"
          );

          // Send tile for processing
          window.postMessage(
            {
              source: "wplace-studio-tile",
              blobID: blobUUID,
              tileBlob: blob,
              tileX: tileX,
              tileY: tileY,
            },
            "*"
          );
        });
      } catch (error) {
        console.error("Failed to process tile blob:", error);
        return response;
      }
    }

    return originalFetch.apply(this, args);
  };

  // Listen for processed blobs from content script
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data.source === "mr-wplace-processed") {
      const { blobID, processedBlob } = event.data;
      const callback = window.tileProcessingQueue?.get(blobID);

      if (typeof callback === "function") {
        callback(processedBlob);
        window.tileProcessingQueue.delete(blobID);
      }
    }

    // Listen for flyTo requests from content script
    if (event.data.source === "wplace-studio-flyto") {
      const { lat, lng, zoom } = event.data;

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
    }

    // Listen for theme updates (for dynamic theme switching)
    if (event.data.source === "mr-wplace-theme-update") {
      currentTheme = event.data.theme;
      console.log("🧑‍🎨 : Theme updated:", currentTheme);

      if (window.wplaceMap) {
        applyTheme(window.wplaceMap, currentTheme);
      }
    }
  });

  // Map instance observer + pixel click setup
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
          if (currentTheme === "dark") {
            applyTheme(map, "dark");
          }

          // Helper function to check dev mode
          const isAutoSpoitDevModeEnabled = (): boolean => {
            const dataElement = document.getElementById("__mr_wplace_data__");
            const devMode = dataElement?.getAttribute(
              "data-auto-spoit-dev-mode"
            );
            return devMode === "true";
          };

          // Setup mousedown for pixel color detection (earlier than click)
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
          let mouseMoveThrottleTimer: ReturnType<typeof setTimeout> | null =
            null;
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

  // DOM属性からtheme読み込み
  const dataElement = document.getElementById("__mr_wplace_data__");
  if (dataElement) {
    currentTheme = dataElement.getAttribute("data-theme") || "light";
  }
  isInitialized = true;
  console.log("🧑‍🎨: Initialization complete, theme:", currentTheme);
})();
