import type { AreaMap } from "./types";
import {
  areaEnabled,
  pendingRenderMap,
  renderFrameId,
  setRenderFrameId,
  setPendingRenderMap,
  svg,
} from "./state";
import { resolveMapContainer, syncAreaRegionLayerData } from "./map-layers";
import { renderEditingOverlay } from "./edit-overlay";

export const cancelAreaOverlayRender = (): void => {
  if (renderFrameId !== null) {
    window.cancelAnimationFrame(renderFrameId);
    setRenderFrameId(null);
  }
  setPendingRenderMap(null);
};

export const renderAreaOverlayNow = (map: AreaMap): void => {
  if (!svg) return;

  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) return;

  const width = mapContainer.clientWidth;
  const height = mapContainer.clientHeight;
  svg.setAttribute("viewBox", `0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`);

  syncAreaRegionLayerData(map);
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
