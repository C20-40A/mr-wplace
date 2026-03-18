import { normalizeAreaColor } from "@/utils/area-region";
import type { AreaMap, GeoJsonPolygonFeatureCollection } from "./types";
import {
  AREA_EDIT_FILL_LAYER_ID,
  AREA_EDIT_LINE_LAYER_ID,
  AREA_EDIT_SOURCE_ID,
  AREA_REGION_BADGE_LABEL_LAYER_ID,
  AREA_REGION_FILL_LAYER_ID,
  AREA_REGION_LABEL_LAYER_ID,
  AREA_REGION_LINE_LAYER_ID,
  AREA_REGION_SOURCE_ID,
  EMPTY_POLYGON_FEATURE_COLLECTION,
} from "./types";
import {
  ensureAreaLabelBadgeImages,
  getContrastTextColor,
  getLabelBadgeImageId,
  getNeutralLabelHaloColor,
} from "./label-badge";
import {
  areaFillOpacity,
  areaNameDisplayMode,
  areaNameFontSizePx,
  areaNameStyleMode,
  areaRegions,
  cachedMapContainer,
  editLayerDataDirty,
  editMode,
  editVertices,
  editingColor,
  editingRegionId,
  regionLayerDataDirty,
  regionLayerStyleDirty,
  setCachedMapContainer,
  setEditLayerDataDirty,
  setRegionLayerDataDirty,
  setRegionLayerStyleDirty,
} from "./state";

const getGeoJsonSource = (
  map: AreaMap,
  sourceId: string,
): { setData?: (data: unknown) => void } | null => {
  const source = map.getSource?.(sourceId);
  if (!source || typeof source !== "object") return null;
  return source as { setData?: (data: unknown) => void };
};

const ensureGeoJsonSource = (
  map: AreaMap,
  sourceId: string,
  data: GeoJsonPolygonFeatureCollection,
): void => {
  if (!map.addSource || !map.getSource) return;
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, { type: "geojson", data });
};

export const ensureAreaRegionLayers = (map: AreaMap): void => {
  ensureGeoJsonSource(map, AREA_REGION_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
  ensureAreaLabelBadgeImages(map);
  if (!map.addLayer || !map.getLayer) return;

  if (!map.getLayer(AREA_REGION_FILL_LAYER_ID)) {
    map.addLayer({
      id: AREA_REGION_FILL_LAYER_ID,
      type: "fill",
      source: AREA_REGION_SOURCE_ID,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": areaFillOpacity,
      },
    });
  }

  if (!map.getLayer(AREA_REGION_LINE_LAYER_ID)) {
    map.addLayer({
      id: AREA_REGION_LINE_LAYER_ID,
      type: "line",
      source: AREA_REGION_SOURCE_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }

  if (!map.getLayer(AREA_REGION_LABEL_LAYER_ID)) {
    map.addLayer({
      id: AREA_REGION_LABEL_LAYER_ID,
      type: "symbol",
      source: AREA_REGION_SOURCE_ID,
      layout: {
        "text-field": ["get", "name"],
        "text-size": areaNameFontSizePx,
        "text-anchor": "center",
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": ["get", "labelHaloColor"],
        "text-halo-width": 1.6,
        "text-halo-blur": 0.2,
      },
    });
  }

  if (!map.getLayer(AREA_REGION_BADGE_LABEL_LAYER_ID)) {
    map.addLayer({
      id: AREA_REGION_BADGE_LABEL_LAYER_ID,
      type: "symbol",
      source: AREA_REGION_SOURCE_ID,
      layout: {
        "text-field": ["get", "name"],
        "text-size": areaNameFontSizePx,
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "icon-image": ["get", "labelBadgeImageId"],
        "icon-anchor": "center",
        "icon-text-fit": "both",
        "icon-text-fit-padding": [0.5, 2, 0.5, 2],
      },
      paint: {
        "icon-opacity": 0.97,
        "text-color": ["get", "labelTextColor"],
        "text-halo-color": "rgba(0, 0, 0, 0)",
        "text-halo-width": 0,
        "text-halo-blur": 0,
      },
    });
  }
};

export const ensureAreaEditLayers = (map: AreaMap): void => {
  ensureGeoJsonSource(map, AREA_EDIT_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
  if (!map.addLayer || !map.getLayer) return;

  if (!map.getLayer(AREA_EDIT_FILL_LAYER_ID)) {
    map.addLayer({
      id: AREA_EDIT_FILL_LAYER_ID,
      type: "fill",
      source: AREA_EDIT_SOURCE_ID,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 0.2,
      },
    });
  }

  if (!map.getLayer(AREA_EDIT_LINE_LAYER_ID)) {
    map.addLayer({
      id: AREA_EDIT_LINE_LAYER_ID,
      type: "line",
      source: AREA_EDIT_SOURCE_ID,
      paint: {
        "line-color": ["get", "color"],
        "line-width": 3,
      },
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
    });
  }
};

export const setGeoJsonSourceData = (
  map: AreaMap,
  sourceId: string,
  data: GeoJsonPolygonFeatureCollection,
): void => {
  const source = getGeoJsonSource(map, sourceId);
  source?.setData?.(data);
};

const toClosedPolygonRing = (vertices: { lng: number; lat: number }[]): number[][] | null => {
  if (vertices.length < 3) return null;
  const ring = vertices.map((v) => [v.lng, v.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
};

export { toClosedPolygonRing };

const buildAreaRegionFeatureCollection = (): GeoJsonPolygonFeatureCollection => {
  const features: GeoJsonPolygonFeatureCollection["features"] = [];
  for (const region of areaRegions) {
    if (!region.visible) continue;
    if (editMode && editingRegionId && region.id === editingRegionId) continue;
    const ring = toClosedPolygonRing(region.vertices);
    if (!ring) continue;
    const areaColor = normalizeAreaColor(region.color);
    features.push({
      type: "Feature",
      properties: {
        id: region.id,
        name: region.name,
        color: areaColor,
        labelHaloColor: getNeutralLabelHaloColor(areaColor),
        labelBadgeImageId: getLabelBadgeImageId(areaColor),
        labelTextColor: getContrastTextColor(areaColor),
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  return { type: "FeatureCollection", features };
};

const applyAreaNameLayerStyle = (map: AreaMap): void => {
  if (
    !map.getLayer?.(AREA_REGION_LABEL_LAYER_ID) ||
    !map.getLayer?.(AREA_REGION_BADGE_LABEL_LAYER_ID)
  ) return;
  if (!map.setLayoutProperty || !map.setPaintProperty) return;

  if (areaNameDisplayMode === "off") {
    map.setLayoutProperty(AREA_REGION_LABEL_LAYER_ID, "visibility", "none");
    map.setLayoutProperty(AREA_REGION_BADGE_LABEL_LAYER_ID, "visibility", "none");
    return;
  }

  const showBadge = areaNameStyleMode === "color-badge";
  map.setLayoutProperty(AREA_REGION_LABEL_LAYER_ID, "visibility", showBadge ? "none" : "visible");
  map.setLayoutProperty(AREA_REGION_BADGE_LABEL_LAYER_ID, "visibility", showBadge ? "visible" : "none");
  map.setLayoutProperty(AREA_REGION_LABEL_LAYER_ID, "text-size", areaNameFontSizePx);
  map.setLayoutProperty(AREA_REGION_BADGE_LABEL_LAYER_ID, "text-size", areaNameFontSizePx);
  map.setPaintProperty(AREA_REGION_LABEL_LAYER_ID, "text-opacity", 1);
  map.setPaintProperty(AREA_REGION_BADGE_LABEL_LAYER_ID, "text-opacity", 1);
};

export const syncAreaRegionLayerData = (map: AreaMap): void => {
  const needsSetup =
    !map.getSource?.(AREA_REGION_SOURCE_ID) ||
    !map.getLayer?.(AREA_REGION_FILL_LAYER_ID) ||
    !map.getLayer?.(AREA_REGION_LINE_LAYER_ID) ||
    !map.getLayer?.(AREA_REGION_LABEL_LAYER_ID) ||
    !map.getLayer?.(AREA_REGION_BADGE_LABEL_LAYER_ID);

  if (!regionLayerDataDirty && !regionLayerStyleDirty && !needsSetup) return;

  ensureAreaRegionLayers(map);
  if (regionLayerDataDirty || needsSetup) {
    setGeoJsonSourceData(map, AREA_REGION_SOURCE_ID, buildAreaRegionFeatureCollection());
    setRegionLayerDataDirty(false);
  }
  if (
    (regionLayerStyleDirty || needsSetup) &&
    map.setPaintProperty &&
    map.getLayer?.(AREA_REGION_FILL_LAYER_ID)
  ) {
    map.setPaintProperty(AREA_REGION_FILL_LAYER_ID, "fill-opacity", areaFillOpacity);
    applyAreaNameLayerStyle(map);
    setRegionLayerStyleDirty(false);
  }
};

export const syncAreaEditLayerData = (map: AreaMap): void => {
  const needsSetup =
    !map.getSource?.(AREA_EDIT_SOURCE_ID) ||
    !map.getLayer?.(AREA_EDIT_FILL_LAYER_ID) ||
    !map.getLayer?.(AREA_EDIT_LINE_LAYER_ID);

  if (!editLayerDataDirty && !needsSetup) return;

  ensureAreaEditLayers(map);
  if (!editMode || editVertices.length < 3) {
    setGeoJsonSourceData(map, AREA_EDIT_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
    setEditLayerDataDirty(false);
    return;
  }

  const ring = toClosedPolygonRing(editVertices);
  if (!ring) {
    setGeoJsonSourceData(map, AREA_EDIT_SOURCE_ID, EMPTY_POLYGON_FEATURE_COLLECTION);
    setEditLayerDataDirty(false);
    return;
  }

  setGeoJsonSourceData(map, AREA_EDIT_SOURCE_ID, {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { color: normalizeAreaColor(editingColor) },
        geometry: { type: "Polygon", coordinates: [ring] },
      },
    ],
  });
  setEditLayerDataDirty(false);
};

const safeRemoveLayer = (map: AreaMap, layerId: string): void => {
  if (!map.getLayer || !map.removeLayer) return;
  if (!map.getLayer(layerId)) return;
  map.removeLayer(layerId);
};

const safeRemoveSource = (map: AreaMap, sourceId: string): void => {
  if (!map.getSource || !map.removeSource) return;
  if (!map.getSource(sourceId)) return;
  map.removeSource(sourceId);
};

export const removeAreaMapLayers = (map: AreaMap): void => {
  safeRemoveLayer(map, AREA_EDIT_LINE_LAYER_ID);
  safeRemoveLayer(map, AREA_EDIT_FILL_LAYER_ID);
  safeRemoveLayer(map, AREA_REGION_BADGE_LABEL_LAYER_ID);
  safeRemoveLayer(map, AREA_REGION_LABEL_LAYER_ID);
  safeRemoveLayer(map, AREA_REGION_LINE_LAYER_ID);
  safeRemoveLayer(map, AREA_REGION_FILL_LAYER_ID);
  safeRemoveSource(map, AREA_EDIT_SOURCE_ID);
  safeRemoveSource(map, AREA_REGION_SOURCE_ID);
};

export const getMapContainer = (map: AreaMap): HTMLElement | null => {
  const byApi = map.getContainer?.();
  if (byApi instanceof HTMLElement) return byApi;
  return (
    document.querySelector<HTMLElement>(".maplibregl-map") ??
    document.querySelector<HTMLElement>(".maplibregl-canvas-container")
  );
};

export const resolveMapContainer = (map: AreaMap): HTMLElement | null => {
  if (cachedMapContainer?.isConnected) return cachedMapContainer;
  const next = getMapContainer(map);
  if (!next) return null;
  setCachedMapContainer(next);
  return next;
};
