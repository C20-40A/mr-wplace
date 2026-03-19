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
import { resolveMapContainer, syncAreaRegionLayerData, syncAreaEditLayerData } from "./map-layers";
import { renderEditingOverlay } from "./edit-overlay";

export const cancelAreaOverlayRender = (): void => {
  if (renderFrameId !== null) {
    window.cancelAnimationFrame(renderFrameId);
    setRenderFrameId(null);
  }
  setPendingRenderMap(null);
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

// map move/zoom/pitch イベントで region canvas も再描画する必要があるため dirty を立てる
export const markCanvasDirtyOnMapMove = (): void => {
  markRegionLayerDataDirty();
  markEditLayerDataDirty();
};
