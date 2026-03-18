import type { AreaNameDisplayMode, AreaNameStyleMode, AreaRegion } from "@/types/area-region";
import {
  DEFAULT_AREA_COLOR,
  DEFAULT_AREA_NAME_DISPLAY_MODE,
  DEFAULT_AREA_NAME_FONT_SIZE_PX,
  DEFAULT_AREA_NAME_STYLE_MODE,
} from "@/utils/area-region";
import type { AreaMap, LngLat } from "./types";
import { DEFAULT_AREA_FILL_OPACITY } from "./types";

// --- feature toggle ---
export let areaEnabled = false;

// --- DOM refs ---
export let container: HTMLDivElement | null = null;
export let svg: SVGSVGElement | null = null;
export let editPolygon: SVGPolygonElement | null = null;
export let edgeHitLayer: HTMLDivElement | null = null;
export let areaLabel: HTMLDivElement | null = null;
export let editActionLayer: HTMLDivElement | null = null;
export let saveEditButton: HTMLButtonElement | null = null;
export let cancelEditButton: HTMLButtonElement | null = null;

// --- region data ---
export let areaRegions: AreaRegion[] = [];

// --- edit state ---
export let editMode = false;
export let editingRegionId: string | null = null;
export let editingRegionName = "";
export let editingColor = DEFAULT_AREA_COLOR;
export let editingSaveLabel = "Save";
export let editingCancelLabel = "Cancel";
export let editVertices: LngLat[] = [];
export let vertexElements: HTMLDivElement[] = [];

// --- display options ---
export let areaFillOpacity = DEFAULT_AREA_FILL_OPACITY;
export let areaNameDisplayMode: AreaNameDisplayMode = DEFAULT_AREA_NAME_DISPLAY_MODE;
export let areaNameFontSizePx = DEFAULT_AREA_NAME_FONT_SIZE_PX;
export let areaNameStyleMode: AreaNameStyleMode = DEFAULT_AREA_NAME_STYLE_MODE;

// --- map / drag ---
export let activeMap: AreaMap | null = null;
export let activeDragIndex: number | null = null;
export let mapUpdateHandler: (() => void) | null = null;
export let pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
export let pointerUpHandler: (() => void) | null = null;
export let cachedMapContainer: HTMLElement | null = null;
export let pendingRenderMap: AreaMap | null = null;
export let renderFrameId: number | null = null;

// --- dirty flags ---
export let regionLayerDataDirty = true;
export let regionLayerStyleDirty = true;
export let editLayerDataDirty = true;
export let areaRegionSyncJobId = 0;
export let areaRegionSyncFrameId: number | null = null;

// --- setters ---
export const setAreaEnabled = (v: boolean) => { areaEnabled = v; };
export const setContainer = (v: HTMLDivElement | null) => { container = v; };
export const setSvg = (v: SVGSVGElement | null) => { svg = v; };
export const setEditPolygon = (v: SVGPolygonElement | null) => { editPolygon = v; };
export const setEdgeHitLayer = (v: HTMLDivElement | null) => { edgeHitLayer = v; };
export const setAreaLabel = (v: HTMLDivElement | null) => { areaLabel = v; };
export const setEditActionLayer = (v: HTMLDivElement | null) => { editActionLayer = v; };
export const setSaveEditButton = (v: HTMLButtonElement | null) => { saveEditButton = v; };
export const setCancelEditButton = (v: HTMLButtonElement | null) => { cancelEditButton = v; };
export const setAreaRegionsState = (v: AreaRegion[]) => { areaRegions = v; };
export const pushAreaRegion = (v: AreaRegion) => { areaRegions.push(v); };
export const setEditMode = (v: boolean) => { editMode = v; };
export const setEditingRegionId = (v: string | null) => { editingRegionId = v; };
export const setEditingRegionName = (v: string) => { editingRegionName = v; };
export const setEditingColor = (v: string) => { editingColor = v; };
export const setEditingSaveLabel = (v: string) => { editingSaveLabel = v; };
export const setEditingCancelLabel = (v: string) => { editingCancelLabel = v; };
export const setEditVertices = (v: LngLat[]) => { editVertices = v; };
export const setVertexElements = (v: HTMLDivElement[]) => { vertexElements = v; };
export const setAreaFillOpacity = (v: number) => { areaFillOpacity = v; };
export const setAreaNameDisplayMode = (v: AreaNameDisplayMode) => { areaNameDisplayMode = v; };
export const setAreaNameFontSizePx = (v: number) => { areaNameFontSizePx = v; };
export const setAreaNameStyleMode = (v: AreaNameStyleMode) => { areaNameStyleMode = v; };
export const setActiveMap = (v: AreaMap | null) => { activeMap = v; };
export const setActiveDragIndex = (v: number | null) => { activeDragIndex = v; };
export const setMapUpdateHandler = (v: (() => void) | null) => { mapUpdateHandler = v; };
export const setPointerMoveHandler = (v: ((e: PointerEvent) => void) | null) => { pointerMoveHandler = v; };
export const setPointerUpHandler = (v: (() => void) | null) => { pointerUpHandler = v; };
export const setCachedMapContainer = (v: HTMLElement | null) => { cachedMapContainer = v; };
export const setPendingRenderMap = (v: AreaMap | null) => { pendingRenderMap = v; };
export const setRenderFrameId = (v: number | null) => { renderFrameId = v; };
export const setRegionLayerDataDirty = (v: boolean) => { regionLayerDataDirty = v; };
export const setRegionLayerStyleDirty = (v: boolean) => { regionLayerStyleDirty = v; };
export const setEditLayerDataDirty = (v: boolean) => { editLayerDataDirty = v; };
export const setAreaRegionSyncJobId = (v: number) => { areaRegionSyncJobId = v; };
export const incrementAreaRegionSyncJobId = () => { areaRegionSyncJobId += 1; return areaRegionSyncJobId; };
export const setAreaRegionSyncFrameId = (v: number | null) => { areaRegionSyncFrameId = v; };

export const markRegionLayerDataDirty = () => { regionLayerDataDirty = true; };
export const markRegionLayerStyleDirty = () => { regionLayerStyleDirty = true; };
export const markEditLayerDataDirty = () => { editLayerDataDirty = true; };
