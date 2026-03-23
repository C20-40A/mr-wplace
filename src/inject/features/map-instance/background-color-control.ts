import { getMapInstanceFromWplace } from "./get-map-instance";

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

    if (!color) {
      if (existingLayer) {
        mapInstance.removeLayer(SOLID_BG_LAYER_ID);
        console.log("🧑‍🎨 : Background layer removed");
      }
      return;
    }

    if (existingLayer) {
      mapInstance.setPaintProperty(SOLID_BG_LAYER_ID, "fill-color", color);
      console.log("🧑‍🎨 : Background color updated to:", color);
      return;
    }

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
