const originalFetch = window.fetch;

// 初期化用変数
let currentTheme = "light";
let darkStyleData = null;
let isInitialized = false;

// DOM属性からデータ読み込み（即時実行）
(async () => {
  const dataElement = document.getElementById("__mr_wplace_data__");
  if (dataElement) {
    currentTheme = dataElement.getAttribute("data-theme") || "light";
    const jsonUrl = dataElement.getAttribute("data-dark-style-url");
    if (jsonUrl) {
      try {
        const response = await originalFetch(jsonUrl);
        darkStyleData = await response.json();
        console.log("🧑‍🎨: Dark style data loaded");
      } catch (error) {
        console.error("🧑‍🎨: Failed to load dark style:", error);
      }
    }
  }
  isInitialized = true;
  console.log("🧑‍🎨: Initialization complete, theme:", currentTheme);
})();

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
        console.log("WPlace map instance captured", map);

        // Setup mousedown for pixel color detection (earlier than click)
        map.on("mousedown", (e) => {
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

window.fetch = async function (...args) {
  // 初期化完了待機
  while (!isInitialized) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  // console.log("🧑‍🎨: Fetch called with args:", args);
  const requestInfo = args[0];
  const url =
    typeof requestInfo === "string" ? requestInfo : requestInfo.url || "";

  // Intercept map style for theme switching
  if (url === "https://maps.wplace.live/styles/liberty") {
    if (currentTheme === "dark" && darkStyleData) {
      console.log("🧑‍🎨 : Switched to dark map style");
      return new Response(JSON.stringify(darkStyleData), {
        status: 200,
        statusText: "OK",
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    // Light theme or darkStyleData not ready: use default
    return originalFetch.apply(this, args);
  }

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
