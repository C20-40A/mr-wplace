import {
  calculateGeodesicAreaSquareMeters,
  calculatePixelAreaSquare,
} from "@/utils/coordinate";
import { formatPixelArea, normalizeAreaColor } from "@/utils/area-region";
import { AREA_MESSAGE_SOURCE } from "@/constants/area-message";
import type { AreaMap } from "./types";
import { AREA_SVG_NS } from "./types";
import {
  areaEnabled,
  activeDragIndex,
  activeMap,
  container,
  edgeHitLayer,
  areaLabel,
  editActionLayer,
  editMode,
  editVertices,
  editingColor,
  pointerMoveHandler,
  pointerUpHandler,
  saveEditButton,
  cancelEditButton,
  setActiveDragIndex,
  setActiveMap,
  setAreaLabel,
  setCancelEditButton,
  setContainer,
  setEditActionLayer,
  setEditPolygon,
  setEdgeHitLayer,
  setPointerMoveHandler,
  setPointerUpHandler,
  setSaveEditButton,
  setSvg,
  setVertexElements,
  vertexElements,
  markEditLayerDataDirty,
} from "./state";
import { resolveMapContainer } from "./map-layers";
import { syncAreaEditLayerData } from "./map-layers";
import { scheduleAreaOverlayRender } from "./render";

const formatArea = (areaM2: number): string => {
  if (areaM2 < 1000000) {
    if (areaM2 < 100) return `${areaM2.toFixed(2)} m²`;
    if (areaM2 < 10000) return `${areaM2.toFixed(1)} m²`;
    return `${Math.round(areaM2)} m²`;
  }
  const km2 = areaM2 / 1000000;
  if (km2 < 10) return `${km2.toFixed(3)} km²`;
  if (km2 < 100) return `${km2.toFixed(2)} km²`;
  return `${km2.toFixed(1)} km²`;
};

export const ensureDefaultVertices = (map: AreaMap): void => {
  if (editVertices.length >= 3) return;
  const center = map.getCenter();
  const centerPoint = map.project(center);
  const offsets = [
    { x: -120, y: 40 },
    { x: 0, y: -110 },
    { x: 120, y: 40 },
  ];
  const newVertices = offsets.map((offset) =>
    map.unproject({ x: centerPoint.x + offset.x, y: centerPoint.y + offset.y }),
  );
  // replace array contents in-place so state reference is kept consistent
  editVertices.splice(0, editVertices.length, ...newVertices);
  markEditLayerDataDirty();
};

const clearEdgeHitLines = (): void => {
  if (!edgeHitLayer) return;
  edgeHitLayer.replaceChildren();
};

export const clearVertexElements = (): void => {
  for (const vertex of vertexElements) vertex.remove();
  setVertexElements([]);
};

const syncVertexElements = (): void => {
  if (!container) return;
  while (vertexElements.length < editVertices.length) {
    const vertex = createVertexElement();
    vertexElements.push(vertex);
    container.appendChild(vertex);
  }
  while (vertexElements.length > editVertices.length) {
    const vertex = vertexElements.pop();
    vertex?.remove();
  }
};

const setVertexFromPointer = (map: AreaMap, event: PointerEvent): void => {
  if (activeDragIndex == null) return;
  const mapContainer = resolveMapContainer(map);
  if (!mapContainer) return;
  const rect = mapContainer.getBoundingClientRect();
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);
  editVertices[activeDragIndex] = map.unproject({ x, y });
  markEditLayerDataDirty();
  renderEditingOverlay(map);
};

export const stopVertexDrag = (): void => {
  if (!activeMap) return;
  activeMap.dragPan?.enable();
  if (pointerMoveHandler) {
    window.removeEventListener("pointermove", pointerMoveHandler);
    setPointerMoveHandler(null);
  }
  if (pointerUpHandler) {
    window.removeEventListener("pointerup", pointerUpHandler);
    window.removeEventListener("pointercancel", pointerUpHandler);
    setPointerUpHandler(null);
  }
  for (const vertex of vertexElements) vertex.style.cursor = "grab";
  setActiveDragIndex(null);
  if (areaEnabled) scheduleAreaOverlayRender(activeMap);
};

const startVertexDrag = (map: AreaMap, index: number, event: PointerEvent): void => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (activeDragIndex !== null) stopVertexDrag();
  event.preventDefault();
  event.stopPropagation();

  setActiveMap(map);
  setActiveDragIndex(index);
  map.dragPan?.disable();
  if (vertexElements[index]) vertexElements[index].style.cursor = "grabbing";

  const move = (moveEvent: PointerEvent) => {
    if (!activeMap) return;
    setVertexFromPointer(activeMap, moveEvent);
  };
  const up = () => stopVertexDrag();

  setPointerMoveHandler(move);
  setPointerUpHandler(up);
  window.addEventListener("pointermove", move, { passive: true });
  window.addEventListener("pointerup", up, { passive: true });
  window.addEventListener("pointercancel", up, { passive: true });

  setVertexFromPointer(map, event);
};

const insertVertexOnEdge = (map: AreaMap, edgeIndex: number): void => {
  const current = map.project(editVertices[edgeIndex]);
  const next = map.project(editVertices[(edgeIndex + 1) % editVertices.length]);
  const midpoint = map.unproject({
    x: (current.x + next.x) / 2,
    y: (current.y + next.y) / 2,
  });
  editVertices.splice(edgeIndex + 1, 0, midpoint);
  markEditLayerDataDirty();
  renderEditingOverlay(map);
};

export const clearEditingUI = (): void => {
  // editPolygon is no longer used in SVG mode (hidden), skip
  if (areaLabel) areaLabel.style.display = "none";
  if (editActionLayer) editActionLayer.style.display = "none";
  clearEdgeHitLines();
  clearVertexElements();
};

const createVertexElement = (): HTMLDivElement => {
  const vertex = document.createElement("div");
  vertex.style.cssText = `
    position: absolute;
    width: 14px;
    height: 14px;
    transform: translate(-50%, -50%);
    border: 2px solid #fff;
    border-radius: 9999px;
    background: #a31616;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
    cursor: grab;
    user-select: none;
    touch-action: none;
    z-index: 3;
  `;
  return vertex;
};

export const renderEditingOverlay = (map: AreaMap): void => {
  if (!edgeHitLayer || !areaLabel || !container) return;
  if (!editMode) {
    syncAreaEditLayerData(map);
    clearEditingUI();
    return;
  }

  ensureDefaultVertices(map);
  if (editVertices.length < 3) {
    syncAreaEditLayerData(map);
    clearEditingUI();
    return;
  }

  syncAreaEditLayerData(map);
  const points = editVertices.map((lngLat) => map.project(lngLat));
  const editingHex = normalizeAreaColor(editingColor);

  // SVG polygon layer not used (hidden); handled by maplibre edit layer
  syncVertexElements();
  for (let i = 0; i < vertexElements.length; i++) {
    const point = points[i];
    const vertex = vertexElements[i];
    vertex.style.background = editingHex;
    vertex.style.left = `${point.x}px`;
    vertex.style.top = `${point.y}px`;
    vertex.dataset.index = String(i);

    if (!(vertex as { _mrAreaEventsBound?: boolean })._mrAreaEventsBound) {
      const onPointerDown = (event: PointerEvent) => {
        const index = Number(vertex.dataset.index);
        if (!Number.isFinite(index)) return;
        startVertexDrag(map, index, event);
      };
      const onDoubleClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const index = Number(vertex.dataset.index);
        if (!Number.isFinite(index)) return;
        if (editVertices.length <= 3) return;
        editVertices.splice(index, 1);
        markEditLayerDataDirty();
        renderEditingOverlay(map);
      };
      vertex.addEventListener("pointerdown", onPointerDown);
      vertex.addEventListener("dblclick", onDoubleClick);
      (vertex as { _mrAreaEventsBound?: boolean })._mrAreaEventsBound = true;
    }
  }

  clearEdgeHitLines();
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy);
    if (length < 1) continue;

    const hit = document.createElement("div");
    hit.style.cssText = `
      position: absolute;
      left: ${current.x}px;
      top: ${current.y}px;
      width: ${length}px;
      height: 14px;
      transform-origin: 0 50%;
      transform: translateY(-50%) rotate(${Math.atan2(dy, dx)}rad);
      pointer-events: auto;
      touch-action: none;
      cursor: copy;
      background: rgba(0, 0, 0, 0);
    `;
    hit.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      insertVertexOnEdge(map, i);
    });
    edgeHitLayer.appendChild(hit);
  }

  const area = calculateGeodesicAreaSquareMeters(editVertices);
  const pixelArea = calculatePixelAreaSquare(editVertices);
  areaLabel.innerHTML = `${formatArea(area)}<br><span style="font-size: 10px; opacity: 0.8;">${formatPixelArea(pixelArea)}</span>`;
  areaLabel.style.display = "block";

  const centerX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  areaLabel.style.left = `${centerX}px`;
  areaLabel.style.top = `${centerY}px`;

  if (editActionLayer) {
    editActionLayer.style.display = "flex";
    editActionLayer.style.left = `${centerX}px`;
    editActionLayer.style.top = `${centerY + 26}px`;
  }
};

export const createOverlay = (): HTMLDivElement => {
  const root = document.createElement("div");
  root.id = "mr-wplace-area-measure";
  root.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
  `;

  const svgRoot = document.createElementNS(AREA_SVG_NS, "svg");
  svgRoot.setAttribute("width", "100%");
  svgRoot.setAttribute("height", "100%");
  svgRoot.setAttribute("viewBox", "0 0 1 1");
  svgRoot.style.pointerEvents = "none";

  const editingPolygon = document.createElementNS(AREA_SVG_NS, "polygon");
  editingPolygon.setAttribute("fill", "rgba(15, 118, 110, 0.2)");
  editingPolygon.setAttribute("stroke", "rgba(15, 118, 110, 0.95)");
  editingPolygon.setAttribute("stroke-width", "3");
  editingPolygon.setAttribute("vector-effect", "non-scaling-stroke");
  editingPolygon.style.pointerEvents = "none";
  editingPolygon.style.display = "none";
  svgRoot.appendChild(editingPolygon);

  const hitLayer = document.createElement("div");
  hitLayer.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  `;

  const label = document.createElement("div");
  label.style.cssText = `
    position: absolute;
    transform: translate(-50%, -50%);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    line-height: 1.3;
    text-align: center;
    text-shadow:
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 3px rgba(0, 0, 0, 0.8);
    pointer-events: none;
    z-index: 2;
    display: none;
  `;

  const actionLayer = document.createElement("div");
  actionLayer.style.cssText = `
    position: absolute;
    transform: translate(-50%, -50%);
    display: none;
    gap: 4px;
    z-index: 4;
    pointer-events: auto;
  `;

  const saveButton = document.createElement("button");
  saveButton.style.cssText = `
    background: #0f766e;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  `;
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.postMessage({ source: AREA_MESSAGE_SOURCE.REGION_SAVE_CLICK }, "*");
  });

  const cancelButton = document.createElement("button");
  cancelButton.style.cssText = `
    background: rgba(255, 255, 255, 0.95);
    color: #333;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  `;
  cancelButton.innerHTML = "✕";
  cancelButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.postMessage({ source: AREA_MESSAGE_SOURCE.REGION_CANCEL_CLICK }, "*");
  });

  actionLayer.appendChild(saveButton);
  actionLayer.appendChild(cancelButton);

  root.appendChild(svgRoot);
  root.appendChild(hitLayer);
  root.appendChild(label);
  root.appendChild(actionLayer);

  setSvg(svgRoot);
  setEditPolygon(editingPolygon);
  setEdgeHitLayer(hitLayer);
  setAreaLabel(label);
  setEditActionLayer(actionLayer);
  setSaveEditButton(saveButton);
  setCancelEditButton(cancelButton);

  return root;
};
