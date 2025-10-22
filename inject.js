(async () => {
  const originalFetch = window.fetch;

  // 初期化用変数
  let currentTheme = "light";
  let isInitialized = false;

  // fetchの上書き
  window.fetch = async function (...args) {
    // 初期化完了待機
    while (!isInitialized) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // console.log("🧑‍🎨: Fetch called with args:", args);
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

      const tileX = parseInt(tileMatch[1]);
      const tileY = parseInt(tileMatch[2]);

      // console.log(`Intercepting tile: ${tileX},${tileY} - ${url}`);

      const response = await originalFetch.apply(this, args);
      const clonedResponse = response.clone();

      try {
        const blob = await clonedResponse.blob();

        return new Promise((resolve) => {
          const blobUUID = crypto.randomUUID();

          // Store callback for processed blob
          window.tileProcessingQueue = window.tileProcessingQueue || new Map();
          window.tileProcessingQueue.set(blobUUID, (processedBlob) => {
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
  window.addEventListener("message", (event) => {
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
      
      // Apply theme to map
      if (window.wplaceMap) {
        if (currentTheme === "dark") {
          window.wplaceMap.setPaintProperty("background", "background-color", "#111");
          window.wplaceMap.setPaintProperty("water", "fill-color", "#222");
          window.wplaceMap.setPaintProperty("landuse", "fill-color", "#333");
          console.log("🧑‍🎨 : Applied dark theme to map");
        } else {
          // Reset to light theme (default values from maplibre)
          window.wplaceMap.setPaintProperty("background", "background-color", "#f8f4f0");
          window.wplaceMap.setPaintProperty("water", "fill-color", "#a0c8f0");
          window.wplaceMap.setPaintProperty("landuse", "fill-color", "#e0e0e0");
          console.log("🧑‍🎨 : Applied light theme to map");
        }
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
        mapElement.childNodes[0].__click
      ) {
        const map = mapElement.childNodes[0].__click[3].v;
        if (map && typeof map.version === "string") {
          window.wplaceMap = map;
          mapObserver.disconnect();
          console.log("🧑‍🎨 : WPlace map instance captured", map);

          // Apply initial theme
          if (currentTheme === "dark") {
            map.setPaintProperty("background", "background-color", "#111");
            map.setPaintProperty("water", "fill-color", "#222");
            map.setPaintProperty("landuse", "fill-color", "#333");
            console.log("🧑‍🎨 : Applied initial dark theme to map");
          }

          // Helper function to check dev mode
          const isAutoSpoitDevModeEnabled = () => {
            const dataElement = document.getElementById("__mr_wplace_data__");
            const devMode = dataElement?.getAttribute("data-auto-spoit-dev-mode");
            return devMode === "true";
          };

          // Setup mousedown for pixel color detection (earlier than click)
          map.on("mousedown", (e) => {
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
          let mouseMoveThrottleTimer = null;
          const MOUSE_MOVE_THROTTLE_PERIOD = 10; // ms

          document.addEventListener("keydown", (e) => {
            if (e.code === "Space") {
              isSpacePressed = true;
            }
          });

          document.addEventListener("keyup", (e) => {
            if (e.code === "Space") {
              isSpacePressed = false;
            }
          });

          map.on("mousemove", (e) => {
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
