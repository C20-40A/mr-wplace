import type { AreaMap } from "./types";
import {
  areaEnabled,
  pendingRenderMap,
  renderFrameId,
  setRenderFrameId,
  setPendingRenderMap,
  markRegionLayerDataDirty,
  markEditLayerDataDirty,
} from "./state";
import { resolveMapContainer, syncAreaRegionLayerData, syncAreaEditLayerData, applyMapTransform } from "./map-layers";
import { renderEditingOverlay } from "./edit-overlay";

const FULL_RENDER_DEBOUNCE_MS = 120;
let mapMoveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export const cancelAreaOverlayRender = (): void => {
  if (renderFrameId !== null) {
    window.cancelAnimationFrame(renderFrameId);
    setRenderFrameId(null);
  }
  setPendingRenderMap(null);
  if (mapMoveDebounceTimer !== null) {
    clearTimeout(mapMoveDebounceTimer);
    mapMoveDebounceTimer = null;
  }
};

export const renderAreaOverlayNow = (map: AreaMap): void => {
  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) return;

  syncAreaRegionLayerData(map);
  syncAreaEditLayerData(map);
  renderEditingOverlay(map);
};

export const scheduleAreaOverlayRender = (map: AreaMap): void => {
  setPendingRenderMap(map);
  if (renderFrameId !== null) return;

  setRenderFrameId(
    window.requestAnimationFrame(() => {
      setRenderFrameId(null);
      const nextMap = pendingRenderMap;
      setPendingRenderMap(null);
      if (!nextMap || !areaEnabled) return;
      renderAreaOverlayNow(nextMap);
    }),
  );
};

// Fast path: CSS transform on map move, debounced full re-render after movement stops
export const handleMapMoveTransform = (map: AreaMap): void => {
  const applied = applyMapTransform(map);

  // Always update edit overlay (vertex handles need repositioning)
  renderEditingOverlay(map);

  // Debounce full re-render after movement settles
  if (mapMoveDebounceTimer !== null) clearTimeout(mapMoveDebounceTimer);
  mapMoveDebounceTimer = setTimeout(() => {
    mapMoveDebounceTimer = null;
    if (!areaEnabled) return;
    markRegionLayerDataDirty();
    markEditLayerDataDirty();
    scheduleAreaOverlayRender(map);
  }, FULL_RENDER_DEBOUNCE_MS);

  // If transform couldn't be applied (no reference or large zoom delta), force immediate full render
  if (!applied) {
    markRegionLayerDataDirty();
    markEditLayerDataDirty();
    scheduleAreaOverlayRender(map);
  }
};

