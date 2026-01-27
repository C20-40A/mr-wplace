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

    if (color) {
      if (!existingLayer) {
        // Add source if not exists
        if (!mapInstance.getSource(SOLID_BG_SOURCE_ID)) {
          mapInstance.addSource(SOLID_BG_SOURCE_ID, {
            type: "geojson",
            data: worldPolygon,
          });
        }

        // Add layer before pixel-art-layer
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
          "pixel-art-layer"
        );
        console.log("🧑‍🎨 : Background layer created with color:", color);
      } else {
        // Update existing layer color
        mapInstance.setPaintProperty(
          SOLID_BG_LAYER_ID,
          "fill-color",
          color
        );
        console.log("🧑‍🎨 : Background color updated to:", color);
      }
    } else {
      // Remove layer if exists
      if (existingLayer) {
        mapInstance.removeLayer(SOLID_BG_LAYER_ID);
        console.log("🧑‍🎨 : Background layer removed");
      }
      // Keep source for potential reuse
    }
  } catch (error) {
    console.error("🧑‍🎨 : Error changing background color:", error);
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
      2
    )}, ${currentCenter.lng.toFixed(2)}, z${currentZoom}) to (${lat.toFixed(
      2
    )}, ${lng.toFixed(2)}, z${zoom}) [distance: ${distance.toFixed(2)}]`
  );

  if (useJump) {
    mapInstance.jumpTo({ center: [lng, lat], zoom });
  } else {
    mapInstance.flyTo({ center: [lng, lat], zoom });
  }
};
