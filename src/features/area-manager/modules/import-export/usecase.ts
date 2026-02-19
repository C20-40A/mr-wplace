import { t } from "@/i18n/manager";
import type { AreaRegion } from "@/types/area-region";
import type { AreaRegionGroup } from "@/features/area-manager/types";
import { createAreaGeoJson } from "./utils";
import { showProgressDialog } from "./progress-dialog";

interface ImportedAreaData {
  regions: AreaRegion[];
  groups: AreaRegionGroup[];
}

interface ApplyImportedAreaDataParams {
  importedData: ImportedAreaData;
  mode: "merge" | "replace";
  areaEditMode: boolean;
  areaRegions: AreaRegion[];
  areaRegionGroups: AreaRegionGroup[];
  stopAreaEditing: (skipRender?: boolean) => Promise<void>;
  cleanupAreaRegionGroups: () => boolean;
  persistAreaRegions: () => Promise<void>;
  persistAreaRegionGroups: () => Promise<void>;
  notifyAreaRegions: () => void;
  renderAreaManager: () => void;
  setAreaRegions: (regions: AreaRegion[]) => void;
  setAreaRegionGroups: (groups: AreaRegionGroup[]) => void;
  showProgress?: boolean;
}

interface ImportAreaRegionsFromTextParams {
  text: string;
  mode: "merge" | "replace";
  normalizeImportedAreaData: (
    value: unknown,
    onProgress?: (percent: number, message: string) => void,
  ) => Promise<ImportedAreaData>;
  applyImportedAreaData: (data: ImportedAreaData, mode: "merge" | "replace") => Promise<void>;
  showProgress?: boolean;
}

interface ImportAreaRegionsFromUrlParams {
  url: string;
  mode: "merge" | "replace";
  importAreaRegionsFromText: (text: string, mode: "merge" | "replace") => Promise<number>;
}

interface DownloadAreaRegionsParams {
  regions: AreaRegion[];
  areaRegionGroups: AreaRegionGroup[];
}

const yieldToMainThread = async (): Promise<void> => {
  const schedulerAny = globalThis as typeof globalThis & {
    scheduler?: { yield?: () => Promise<void> };
  };
  if (schedulerAny.scheduler?.yield) {
    await schedulerAny.scheduler.yield();
    return;
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
};

const maybeYield = async (startedAt: number, budgetMs = 8): Promise<number> => {
  if (performance.now() - startedAt < budgetMs) return startedAt;
  await yieldToMainThread();
  return performance.now();
};

export const applyImportedAreaData = async (
  params: ApplyImportedAreaDataParams,
): Promise<void> => {
  const { importedData, mode, showProgress = false } = params;
  const importedRegions = importedData.regions;
  const importedGroups = importedData.groups;
  let nextRegions: AreaRegion[] = params.areaRegions;
  let nextGroups: AreaRegionGroup[] = params.areaRegionGroups;

  const progress = showProgress ? showProgressDialog(t`${"import"}`) : null;

  try {
    if (params.areaEditMode) {
      progress?.update(42, t`${"processing"}`);
      await params.stopAreaEditing(true);
    }

    progress?.update(45, t`${"processing"}`);
    await yieldToMainThread();

    if (mode === "replace") {
      nextRegions = importedRegions;
      nextGroups = importedGroups;
    } else {
      const mergedRegions = new Map<string, AreaRegion>();
      for (const region of params.areaRegions) mergedRegions.set(region.id, region);

      const CHUNK_SIZE = 100;
      let startedAt = performance.now();
      for (let i = 0; i < importedRegions.length; ) {
        const end = Math.min(i + CHUNK_SIZE, importedRegions.length);
        for (; i < end; i++) {
          mergedRegions.set(importedRegions[i].id, importedRegions[i]);
        }

        const percent = 45 + (i / importedRegions.length) * 20;
        progress?.update(percent, `${t`${"processing"}`} (${i}/${importedRegions.length})`);
        startedAt = await maybeYield(startedAt);
      }
      nextRegions = Array.from(mergedRegions.values());

      const mergedGroups = new Map<string, AreaRegionGroup>();
      for (const group of params.areaRegionGroups) mergedGroups.set(group.id, group);
      for (const group of importedGroups) mergedGroups.set(group.id, group);
      nextGroups = Array.from(mergedGroups.values());
    }

    progress?.update(70, t`${"processing"}`);
    await yieldToMainThread();

    nextRegions.sort((a, b) => b.updatedAt - a.updatedAt);
    params.setAreaRegions(nextRegions);
    params.setAreaRegionGroups(nextGroups);

    progress?.update(75, t`${"processing"}`);
    await yieldToMainThread();

    const groupsChanged = params.cleanupAreaRegionGroups();

    progress?.update(80, t`${"saving"}`);
    await params.persistAreaRegions();

    progress?.update(90, t`${"saving"}`);
    if (groupsChanged || mode === "replace" || importedGroups.length > 0) {
      await params.persistAreaRegionGroups();
    }

    progress?.update(95, t`${"processing"}`);
    await yieldToMainThread();

    params.notifyAreaRegions();
    params.renderAreaManager();

    progress?.update(100, t`${"complete"}`);
    await yieldToMainThread();
  } finally {
    if (progress) {
      setTimeout(() => progress.close(), 300);
    }
  }
};

export const importAreaRegionsFromText = async (
  params: ImportAreaRegionsFromTextParams,
): Promise<number> => {
  const { showProgress = false } = params;
  const progress = showProgress ? showProgressDialog(t`${"import"}`) : null;

  try {
    progress?.update(0, t`${"processing"}`);
    await yieldToMainThread();

    let parsed: unknown;
    try {
      parsed = JSON.parse(params.text);
    } catch {
      throw new Error(t`${"invalid_file_format"}`);
    }

    progress?.update(5, t`${"processing"}`);
    await yieldToMainThread();

    const importedData = await params.normalizeImportedAreaData(
      parsed,
      (percent, message) => progress?.update(percent, message),
    );
    if (importedData.regions.length === 0) {
      throw new Error(t`${"map_filter_area_no_importable_regions"}`);
    }

    progress?.update(40, t`${"processing"}`);
    progress?.close();

    await params.applyImportedAreaData(importedData, params.mode);
    return importedData.regions.length;
  } catch (error) {
    progress?.close();
    throw error;
  }
};

export const importAreaRegionsFromUrl = async (
  params: ImportAreaRegionsFromUrlParams,
): Promise<number> => {
  const response = await fetch(params.url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return params.importAreaRegionsFromText(await response.text(), params.mode);
};

export const downloadAreaRegions = (params: DownloadAreaRegionsParams): void => {
  if (params.regions.length === 0) {
    alert(t`${"map_filter_area_no_export_regions"}`);
    return;
  }

  const selectedIds = new Set(params.regions.map((region) => region.id));
  const groups = params.areaRegionGroups
    .filter((group) => group.regionIds.every((id) => selectedIds.has(id)))
    .map((group) => ({
      ...group,
      regionIds: [...group.regionIds],
    }));
  const payload = createAreaGeoJson(params.regions, groups);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/geo+json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:]/g, "-").replace(/\..+$/, "");

  anchor.href = url;
  anchor.download = `mr-wplace-areas-${timestamp}.geojson`;
  anchor.click();
  URL.revokeObjectURL(url);
};
