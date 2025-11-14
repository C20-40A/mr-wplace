import type { WplaceMap } from "./types";

/**
 * Apply theme to WPlace map instance
 */
export const applyTheme = (map: WplaceMap, theme: "light" | "dark"): void => {
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
    map.setPaintProperty(
      "park_outline",
      "line-color",
      "rgba(228, 241, 215, 1)"
    );
    map.setPaintProperty(
      "landcover_grass",
      "fill-color",
      "rgba(176, 213, 154, 1)"
    );
    map.setPaintProperty(
      "landcover_sand",
      "fill-color",
      "rgba(247, 239, 195, 1)"
    );
    map.setPaintProperty(
      "landcover_ice",
      "fill-color",
      "rgba(224, 236, 236, 1)"
    );

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
