import { t } from "@/i18n/manager";
import type { AreaRegion } from "@/types/area-region";
import type { AreaRegionGroup } from "@/features/area-manager/types";
import { createAreaGeoJson } from "./utils";

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
}

interface ImportAreaRegionsFromTextParams {
  text: string;
  mode: "merge" | "replace";
  normalizeImportedAreaData: (value: unknown) => ImportedAreaData;
  applyImportedAreaData: (data: ImportedAreaData, mode: "merge" | "replace") => Promise<void>;
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

export const applyImportedAreaData = async (
  params: ApplyImportedAreaDataParams,
): Promise<void> => {
  const { importedData, mode } = params;
  const importedRegions = importedData.regions;
  const importedGroups = importedData.groups;
  let nextRegions: AreaRegion[] = params.areaRegions;
  let nextGroups: AreaRegionGroup[] = params.areaRegionGroups;

  if (params.areaEditMode) {
    await params.stopAreaEditing(true);
  }

  if (mode === "replace") {
    nextRegions = importedRegions;
    nextGroups = importedGroups;
  } else {
    const mergedRegions = new Map<string, AreaRegion>();
    for (const region of params.areaRegions) mergedRegions.set(region.id, region);
    for (const region of importedRegions) mergedRegions.set(region.id, region);
    nextRegions = Array.from(mergedRegions.values());

    const mergedGroups = new Map<string, AreaRegionGroup>();
    for (const group of params.areaRegionGroups) mergedGroups.set(group.id, group);
    for (const group of importedGroups) mergedGroups.set(group.id, group);
    nextGroups = Array.from(mergedGroups.values());
  }

  nextRegions.sort((a, b) => b.updatedAt - a.updatedAt);
  params.setAreaRegions(nextRegions);
  params.setAreaRegionGroups(nextGroups);
  const groupsChanged = params.cleanupAreaRegionGroups();
  await params.persistAreaRegions();
  if (groupsChanged || mode === "replace" || importedGroups.length > 0) {
    await params.persistAreaRegionGroups();
  }
  params.notifyAreaRegions();
  params.renderAreaManager();
};

export const importAreaRegionsFromText = async (
  params: ImportAreaRegionsFromTextParams,
): Promise<number> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(params.text);
  } catch {
    throw new Error(t`${"invalid_file_format"}`);
  }

  const importedData = params.normalizeImportedAreaData(parsed);
  if (importedData.regions.length === 0) {
    throw new Error(t`${"map_filter_area_no_importable_regions"}`);
  }

  await params.applyImportedAreaData(importedData, params.mode);
  return importedData.regions.length;
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
