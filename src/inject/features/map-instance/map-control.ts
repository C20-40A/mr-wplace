import { getMapInstanceFromWplace } from "./get-map-instance";

export const changeTileBoundaryVisibility = (visible: boolean): void => {
  const mapInstance = getMapInstanceFromWplace();
  if (!mapInstance) return;
  mapInstance.showTileBoundaries = visible;
  console.log("🧑‍🎨 : Tile boundaries updated:", visible);
};

const SOLID_BG_SOURCE_ID = "mr-wplace-solid-bg";
const SOLID_BG_LAYER_ID = "mr-wplace-solid-bg-layer";

const worldPolygon = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-180, -90],
            [180, -90],
            [180, 90],
            [-180, 90],
            [-180, -90],
          ],
        ],
      },
    },
  ],
};

export const changeBackgroundColor = (color: string | null): void => {
  const mapInstance = getMapInstanceFromWplace();
  if (!mapInstance) {
    console.log("🧑‍🎨 : Map instance not available");
    return;
  }

  try {
    const existingLayer = mapInstance.getLayer(SOLID_BG_LAYER_ID);

    // Remove layer when color is null
    if (!color) {
      if (existingLayer) {
        mapInstance.removeLayer(SOLID_BG_LAYER_ID);
        console.log("🧑‍🎨 : Background layer removed");
      }
      return;
    }

    // Update existing layer
    if (existingLayer) {
      mapInstance.setPaintProperty(SOLID_BG_LAYER_ID, "fill-color", color);
      console.log("🧑‍🎨 : Background color updated to:", color);
      return;
    }

    // Create new layer
    if (!mapInstance.getSource(SOLID_BG_SOURCE_ID)) {
      mapInstance.addSource(SOLID_BG_SOURCE_ID, {
        type: "geojson",
        data: worldPolygon,
      });
    }

    mapInstance.addLayer(
      {
        id: SOLID_BG_LAYER_ID,
        type: "fill",
        source: SOLID_BG_SOURCE_ID,
        paint: {
          "fill-color": color,
          "fill-opacity": 1,
        },
      },
      "pixel-art-layer",
    );
    console.log("🧑‍🎨 : Background layer created with color:", color);
  } catch (error) {
    console.error("🧑‍🎨 : Error changing background color:", error);
  }
};

export const changeMap3dEnabled = (enabled: boolean): void => {
  const mapInstance = getMapInstanceFromWplace();
  if (!mapInstance) return;

  if (enabled) {
    // mapInstance.touchZoomRotate.enableRotation();
    // mapInstance.touchZoomRotate.disableRotation();
    // mapInstance.dragRotate.enable();
    mapInstance.setMaxPitch(20);
    mapInstance.setPitch(20);
    mapInstance.setVerticalFieldOfView(180);

    // Automatically enable sky and fog when 3D is enabled
    if (typeof mapInstance.setSky === "function") {
      try {
        mapInstance.setSky({
          "sky-color": "black",
          "sky-horizon-blend": 0.8,
          "horizon-color": "#444",
          "horizon-fog-blend": 0.1,
          "fog-color": "black",
          "fog-ground-blend": 0.1,
        });
        console.log("🧑‍🎨 : Sky and fog enabled with 3D mode");
      } catch (error) {
        console.error("🧑‍🎨 : Sky not supported:", error);
      }
    }
  } else {
    mapInstance.touchZoomRotate.disableRotation();
    mapInstance.dragRotate.disable();
    mapInstance.setMaxPitch(0);
    mapInstance.setPitch(0);
    mapInstance.setBearing(0);

    // Automatically disable sky and fog when 3D is disabled
    if (typeof mapInstance.setSky === "function") {
      try {
        mapInstance.setSky({});
        console.log("🧑‍🎨 : Sky and fog disabled with 3D mode");
      } catch (error) {
        console.error("🧑‍🎨 : Sky not supported:", error);
      }
    }
  }
  console.log("🧑‍🎨 : Map 3D mode:", enabled);
};

export const changeMap3dDragRotateEnabled = (enabled: boolean): void => {
  const mapInstance = getMapInstanceFromWplace();
  if (!mapInstance) return;

  if (enabled) {
    // Enable drag rotate mode: reset to default FOV, allow rotation
    // MapLibre default FOV is approximately 36.87 degrees (0.6435 radians)
    mapInstance.setVerticalFieldOfView(36.87);
    mapInstance.dragRotate.enable();
    mapInstance.setMaxPitch(75);
    mapInstance.setPitch(60);
    console.log("🧑‍🎨 : 3D drag rotate enabled");
  } else {
    // Return to fixed 3D view: wide FOV, disable rotation
    mapInstance.dragRotate.disable();
    mapInstance.setMaxPitch(20);
    mapInstance.setPitch(20);
    mapInstance.setVerticalFieldOfView(180);
    console.log("🧑‍🎨 : 3D drag rotate disabled, returning to fixed view");
  }
};

// Distance threshold for smart navigation (adjustable)
const SMART_NAV_THRESHOLD = 4;

/**
 * Handle flyTo/jumpTo requests with smart navigation
 * - Close distance: flyTo (animated)
 * - Far distance: jumpTo (instant)
 */
export const handleMapInstanceFlyTo = (data: {
  lat: number;
  lng: number;
  zoom: number;
}): void => {
  const { lat, lng, zoom } = data;

  const mapInstance = getMapInstanceFromWplace();

  // If map instance not available, fallback to URL navigation
  if (!mapInstance) {
    console.log("🧑‍🎨 : Map instance not available, using URL navigation");
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
    return;
  }

  // Get current position
  const currentCenter = mapInstance.getCenter();
  const currentZoom = mapInstance.getZoom();

  // Calculate simple distance (fast)
  const latDiff = Math.abs(currentCenter.lat - lat);
  const lngDiff = Math.abs(currentCenter.lng - lng);
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

  // Smart navigation: jumpTo for far distance, flyTo for close
  const useJump = distance > SMART_NAV_THRESHOLD;

  console.log(
    `🧑‍🎨 : ${useJump ? "jumpTo" : "flyTo"} from (${currentCenter.lat.toFixed(
      2,
    )}, ${currentCenter.lng.toFixed(2)}, z${currentZoom}) to (${lat.toFixed(
      2,
    )}, ${lng.toFixed(2)}, z${zoom}) [distance: ${distance.toFixed(2)}]`,
  );

  if (useJump) {
    mapInstance.jumpTo({ center: [lng, lat], zoom });
  } else {
    mapInstance.flyTo({ center: [lng, lat], zoom });
  }
};
