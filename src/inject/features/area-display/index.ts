import type { AreaDisplayOptions, AreaRegion, AreaRegionEditSnapshot } from "@/types/area-region";
import { getMapInstanceFromWplace } from "../map-instance";
import {
  CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED,
  logCustomGeoJsonDisabled,
} from "../custom-geojson-guard";
import type { AreaMap, AreaRegionEditStartPayload } from "./types";
import { MAP_UPDATE_EVENTS } from "./types";
import {
  DEFAULT_AREA_COLOR,
  normalizeAreaColor,
  normalizeAreaNameDisplayMode,
  normalizeAreaNameFontSizePx,
  normalizeAreaNameStyleMode,
} from "@/utils/area-region";
import { AREA_MESSAGE_SOURCE } from "@/constants/area-message";
import {
  areaEnabled,
  cancelEditButton,
  container,
  editMode,
  editVertices,
  editingRegionId,
  editingRegionName,
  mapUpdateHandler,
  saveEditButton,
  setAreaEnabled,
  setActiveMap,
  setAreaFillOpacity,
  setAreaNameDisplayMode,
  setAreaNameFontSizePx,
  setAreaNameStyleMode,
  setAreaRegionsState,
  setCachedMapContainer,
  setContainer,
  setEditLayerDataDirty,
  setEditMode,
  setEditVertices,
  setEditingColor,
  setEditingRegionId,
  setEditingRegionName,
  setMapUpdateHandler,
  markRegionLayerDataDirty,
  markRegionLayerStyleDirty,
  markEditLayerDataDirty,
  setEditPolygon,
  setEdgeHitLayer,
  setAreaLabel,
  setEditActionLayer,
  setSaveEditButton,
  setCancelEditButton,
  setSvg,
  setActiveDragIndex,
} from "./state";
import { scheduleAreaOverlayRender, cancelAreaOverlayRender } from "./render";
import { removeAreaMapLayers, resolveMapContainer } from "./map-layers";
import { createOverlay, clearVertexElements, stopVertexDrag, ensureDefaultVertices } from "./edit-overlay";
import { syncAreaRegions, cancelAreaRegionSync } from "./region-sync";

const normalizeFillOpacityPercent = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.14;
  return Math.min(1, Math.max(0, value / 100));
};

const cloneVertices = (vertices: { lng: number; lat: number }[]): { lng: number; lat: number }[] =>
  vertices.map((v) => ({ lng: v.lng, lat: v.lat }));

const sanitizeVerticesFromPayload = (
  vertices: unknown,
): { lng: number; lat: number }[] => {
  if (!Array.isArray(vertices)) return [];
  return vertices
    .filter(
      (v): v is { lng: number; lat: number } =>
        v !== null &&
        typeof v === "object" &&
        typeof (v as Record<string, unknown>).lng === "number" &&
        typeof (v as Record<string, unknown>).lat === "number",
    )
    .map((v) => ({ lng: v.lng, lat: v.lat }));
};

const getCurrentEditSnapshot = (): AreaRegionEditSnapshot | null => {
  if (!editMode || editVertices.length < 3) return null;
  return {
    regionId: editingRegionId,
    name: editingRegionName,
    vertices: cloneVertices(editVertices),
  };
};

const addAreaOverlay = (map: AreaMap): void => {
  if (container) return;

  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) {
    console.warn("🧑‍🎨 : Map container not found for area measure");
    return;
  }

  const existing = document.getElementById("mr-wplace-area-measure");
  if (existing) existing.remove();

  const newContainer = createOverlay();
  setContainer(newContainer);
  mapContainer.appendChild(newContainer);
  setCachedMapContainer(mapContainer);

  const handler = () => {
    if (!editMode) return;
    scheduleAreaOverlayRender(map);
  };
  setMapUpdateHandler(handler);
  for (const eventName of MAP_UPDATE_EVENTS) map.on(eventName, handler);

  scheduleAreaOverlayRender(map);
  console.log("🧑‍🎨 : Area measure added");
};

const removeAreaOverlay = (map: AreaMap): void => {
  cancelAreaOverlayRender();

  if (mapUpdateHandler) {
    for (const eventName of MAP_UPDATE_EVENTS) map.off(eventName, mapUpdateHandler);
    setMapUpdateHandler(null);
  }

  stopVertexDrag();
  clearVertexElements();
  removeAreaMapLayers(map);

  container?.remove();
  setContainer(null);
  setSvg(null);
  setEditPolygon(null);
  setEdgeHitLayer(null);
  setAreaLabel(null);
  setEditActionLayer(null);
  setSaveEditButton(null);
  setCancelEditButton(null);
  setActiveMap(null);
  setActiveDragIndex(null);
  setCachedMapContainer(null);

  console.log("🧑‍🎨 : Area measure removed");
};

export const setAreaRegions = (regions: AreaRegion[]): void => {
  syncAreaRegions(regions);
};

export const setAreaDisplayOptions = (
  options: Partial<AreaDisplayOptions> = {},
): void => {
  let hasStyleChange = false;
  if ("fillOpacityPercent" in options) {
    setAreaFillOpacity(normalizeFillOpacityPercent(options.fillOpacityPercent));
    hasStyleChange = true;
  }
  if ("nameDisplayMode" in options) {
    setAreaNameDisplayMode(normalizeAreaNameDisplayMode(options.nameDisplayMode));
    hasStyleChange = true;
  }
  if ("nameFontSizePx" in options) {
    setAreaNameFontSizePx(normalizeAreaNameFontSizePx(options.nameFontSizePx));
    hasStyleChange = true;
  }
  if ("nameStyleMode" in options) {
    setAreaNameStyleMode(normalizeAreaNameStyleMode(options.nameStyleMode));
    hasStyleChange = true;
  }
  if (hasStyleChange) markRegionLayerStyleDirty();

  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (map && areaEnabled) scheduleAreaOverlayRender(map);

  console.log("🧑‍🎨 : Area display options updated");
};

export const startAreaRegionEdit = (
  payload: AreaRegionEditStartPayload = {},
): void => {
  if (CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED) {
    logCustomGeoJsonDisabled("Area edit");
    return;
  }

  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for area edit");
    return;
  }

  if (!areaEnabled) setAreaMeasureEnabled(true);

  setEditMode(true);
  setEditingRegionId(payload.regionId ?? null);
  setEditingRegionName(payload.name?.trim() || "");
  setEditingColor(normalizeAreaColor(payload.color));

  const sl = payload.saveLabel?.trim() || "Save";
  const cl = payload.cancelLabel?.trim() || "Cancel";
  if (saveEditButton) saveEditButton.textContent = sl;
  if (cancelEditButton) cancelEditButton.textContent = cl;

  setEditVertices(sanitizeVerticesFromPayload(payload.vertices));
  ensureDefaultVertices(map);
  markRegionLayerDataDirty();
  markEditLayerDataDirty();
  scheduleAreaOverlayRender(map);

  console.log("🧑‍🎨 : Area edit started", {
    regionId: payload.regionId,
    points: editVertices.length,
  });
};

export const stopAreaRegionEdit = (): void => {
  stopVertexDrag();
  setEditMode(false);
  setEditingRegionId(null);
  setEditingRegionName("");
  setEditingColor(DEFAULT_AREA_COLOR);
  setEditVertices([]);
  markRegionLayerDataDirty();
  markEditLayerDataDirty();

  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (map && areaEnabled) scheduleAreaOverlayRender(map);

  console.log("🧑‍🎨 : Area edit stopped");
};

export const respondAreaRegionEditRequest = (data: { requestId?: string }): void => {
  if (!data.requestId) return;
  window.postMessage(
    {
      source: AREA_MESSAGE_SOURCE.REGION_EDIT_RESPONSE,
      requestId: data.requestId,
      result: getCurrentEditSnapshot(),
    },
    "*",
  );
};

export const setAreaMeasureEnabled = (enabled: boolean): void => {
  if (CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED) {
    if (enabled) logCustomGeoJsonDisabled("Area display");
    setAreaEnabled(false);
    return;
  }

  setAreaEnabled(enabled);
  const map = getMapInstanceFromWplace() as AreaMap | null;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for area measure");
    return;
  }

  if (enabled) {
    markRegionLayerDataDirty();
    markRegionLayerStyleDirty();
    markEditLayerDataDirty();
    addAreaOverlay(map);
  } else removeAreaOverlay(map);

  console.log("🧑‍🎨 : Area measure enabled:", enabled);
};

export const setupAreaMeasureOnMapReady = (mapInstance: unknown): void => {
  if (CUSTOM_GEOJSON_LAYERS_TEMPORARILY_DISABLED) return;

  const map = mapInstance as AreaMap;
  const onStyleData = () => {
    if (!areaEnabled) return;
    markRegionLayerDataDirty();
    markRegionLayerStyleDirty();
    markEditLayerDataDirty();
    scheduleAreaOverlayRender(map);
  };
  map.on("styledata", onStyleData);
  if (areaEnabled) addAreaOverlay(map);

  console.log("🧑‍🎨 : Area measure listener setup complete");
};
