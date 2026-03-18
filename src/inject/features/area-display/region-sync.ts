import type { AreaRegion } from "@/types/area-region";
import { getMapInstanceFromWplace } from "../map-instance";
import type { AreaMap } from "./types";
import {
  AREA_REGION_BEST_EFFORT_MAX,
  AREA_REGION_RENDER_COMMIT_STEP,
  AREA_REGION_SYNC_BATCH_SIZE,
  AREA_REGION_SYNC_TIME_BUDGET_MS,
} from "./types";
import {
  areaEnabled,
  areaRegionSyncFrameId,
  areaRegionSyncJobId,
  incrementAreaRegionSyncJobId,
  markRegionLayerDataDirty,
  pushAreaRegion,
  setAreaRegionSyncFrameId,
  setAreaRegionSyncJobId,
  setAreaRegionsState,
} from "./state";
import { scheduleAreaOverlayRender } from "./render";

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isValidVertex = (vertex: unknown): vertex is { lng: number; lat: number } => {
  if (!vertex || typeof vertex !== "object") return false;
  const c = vertex as Record<string, unknown>;
  return isFiniteNumber(c.lng) && isFiniteNumber(c.lat);
};

const sanitizeVertices = (vertices: unknown): { lng: number; lat: number }[] => {
  if (!Array.isArray(vertices)) return [];
  return vertices.filter(isValidVertex).map((v) => ({ lng: v.lng, lat: v.lat }));
};

import { normalizeAreaColor } from "@/utils/area-region";

export const sanitizeAreaRegion = (region: unknown): AreaRegion | null => {
  if (!region || typeof region !== "object") return null;
  const vertices = sanitizeVertices((region as { vertices?: unknown }).vertices);
  if (vertices.length < 3) return null;
  return {
    id: String((region as { id?: unknown }).id ?? ""),
    name: String((region as { name?: unknown }).name ?? ""),
    color: normalizeAreaColor((region as { color?: unknown }).color),
    visible:
      typeof (region as { visible?: unknown }).visible === "boolean"
        ? Boolean((region as { visible?: unknown }).visible)
        : true,
    createdAt: Number((region as { createdAt?: unknown }).createdAt ?? 0),
    updatedAt: Number((region as { updatedAt?: unknown }).updatedAt ?? 0),
    vertices,
  } satisfies AreaRegion;
};

export const cancelAreaRegionSync = (): void => {
  incrementAreaRegionSyncJobId();
  if (areaRegionSyncFrameId === null) return;
  window.cancelAnimationFrame(areaRegionSyncFrameId);
  setAreaRegionSyncFrameId(null);
};

export const syncAreaRegions = (regions: AreaRegion[]): void => {
  cancelAreaRegionSync();

  const sourceRegions = Array.isArray(regions) ? regions : [];
  setAreaRegionsState([]);
  markRegionLayerDataDirty();

  const syncMap = getMapInstanceFromWplace() as AreaMap | null;
  if (syncMap && areaEnabled) scheduleAreaOverlayRender(syncMap);

  if (sourceRegions.length === 0) {
    console.log("🧑‍🎨 : Area regions synced:", 0);
    return;
  }

  const syncJobId = areaRegionSyncJobId;
  let index = 0;
  let invalidCount = 0;
  let droppedCount = 0;
  let lastCommittedCount = 0;
  // areaRegions length is tracked via module state
  let currentCount = 0;

  const processNextChunk = () => {
    if (syncJobId !== areaRegionSyncJobId) return;

    const startedAt = performance.now();
    let processedInChunk = 0;

    while (
      index < sourceRegions.length &&
      processedInChunk < AREA_REGION_SYNC_BATCH_SIZE &&
      performance.now() - startedAt < AREA_REGION_SYNC_TIME_BUDGET_MS
    ) {
      const sanitized = sanitizeAreaRegion(sourceRegions[index]);
      if (!sanitized) invalidCount += 1;
      else if (currentCount < AREA_REGION_BEST_EFFORT_MAX) {
        pushAreaRegion(sanitized);
        currentCount += 1;
      } else droppedCount += 1;

      index += 1;
      processedInChunk += 1;
    }

    const shouldCommit =
      currentCount - lastCommittedCount >= AREA_REGION_RENDER_COMMIT_STEP ||
      index >= sourceRegions.length;

    if (shouldCommit) {
      markRegionLayerDataDirty();
      const map = getMapInstanceFromWplace() as AreaMap | null;
      if (map && areaEnabled) scheduleAreaOverlayRender(map);
      lastCommittedCount = currentCount;
    }

    if (index >= sourceRegions.length) {
      setAreaRegionSyncFrameId(null);
      console.log("🧑‍🎨 : Area regions synced:", currentCount, {
        total: sourceRegions.length,
        invalid: invalidCount,
        dropped: droppedCount,
      });
      return;
    }

    setAreaRegionSyncFrameId(window.requestAnimationFrame(processNextChunk));
  };

  setAreaRegionSyncFrameId(window.requestAnimationFrame(processNextChunk));
  console.log("🧑‍🎨 : Area regions sync started:", sourceRegions.length);
};
