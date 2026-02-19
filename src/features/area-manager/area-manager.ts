import {
  createModal,
  ModalElements,
  showNameInputModal,
} from "@/components/modal";
import { storage } from "@/utils/browser-api";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import { t } from "@/i18n/manager";
import type {
  AreaDisplayOptions,
  AreaNameDisplayMode,
  AreaNameStyleMode,
  AreaRegion,
  AreaRegionVertex,
} from "@/types/area-region";
import {
  DEFAULT_AREA_COLOR,
  DEFAULT_AREA_NAME_FONT_SIZE_PX,
  DEFAULT_AREA_NAME_DISPLAY_MODE,
  DEFAULT_AREA_NAME_STYLE_MODE,
  formatPixelArea,
  getAreaBounds,
  normalizeAreaColor,
  normalizeAreaNameFontSizePx,
  normalizeAreaNameDisplayMode,
  normalizeAreaNameStyleMode,
} from "@/utils/area-region";
import {
  createAreaRegionId,
  createAreaRegionGroupId,
  createDefaultAreaName,
  createDefaultAreaGroupName,
  createDistinctAreaColor,
  formatAreaKm2,
  normalizeAreaFillOpacityPercent,
  normalizeAreaVertices,
  normalizeTimestamp,
  parseGeoJsonVertices,
} from "./utils";
import { calculatePixelAreaSquare } from "@/utils/coordinate";
import { showImportExportDialog } from "./modules/import-export/dialog";
import { showGroupComposeDialog } from "./modules/group/dialog";
import { showDisplaySettingsDialog } from "./modules/display-settings/dialog";
import {
  bindAreaManagerMessageHandlers,
  postAreaDisplayOptionsUpdate,
  postAreaMeasureUpdate,
  postAreaRegionEditStart,
  postAreaRegionEditStop,
  postAreaRegionGoto,
  postAreaRegionsSync,
  requestAreaEditSnapshot,
} from "./modules/inject-gateway";
import {
  applyImportedAreaData as applyImportedAreaDataUsecase,
  downloadAreaRegions as downloadAreaRegionsUsecase,
  importAreaRegionsFromText as importAreaRegionsFromTextUsecase,
  importAreaRegionsFromUrl as importAreaRegionsFromUrlUsecase,
} from "./modules/import-export/usecase";
import type { AreaRegionGroup } from "./types";

const AREA_MEASURE_KEY = "mapFilter_areaMeasure";
const AREA_REGIONS_KEY = "areaRegions_v1";
const AREA_REGION_GROUPS_KEY = "areaRegionGroups_v1";
const AREA_SYNC_URL_KEY = "mapFilter_areaSyncUrl";
const AREA_FILL_OPACITY_KEY = "mapFilter_areaFillOpacityPercent";
const AREA_NAME_DISPLAY_MODE_KEY = "mapFilter_areaNameDisplayMode";
const AREA_NAME_FONT_SIZE_KEY = "mapFilter_areaNameFontSizePx";
const AREA_NAME_STYLE_MODE_KEY = "mapFilter_areaNameStyleMode";
const AREA_MANAGER_MODAL_ID = "wplace-studio-area-manager-modal";
const DEFAULT_AREA_FILL_OPACITY_PERCENT = 14;

class AreaManager {
  private areaManagerModal: ModalElements | null = null;
  private releaseMessageHandlers: (() => void) | null = null;
  private areaRegions: AreaRegion[] = [];
  private areaRegionGroups: AreaRegionGroup[] = [];
  private areaEditMode = false;
  private editingRegionId: string | null = null;
  private editingRegionName = "";
  private mapReady = false;
  private areaMeasure = false;
  private areaFillOpacityPercent = DEFAULT_AREA_FILL_OPACITY_PERCENT;
  private areaNameDisplayMode: AreaNameDisplayMode =
    DEFAULT_AREA_NAME_DISPLAY_MODE;
  private areaNameFontSizePx = DEFAULT_AREA_NAME_FONT_SIZE_PX;
  private areaNameStyleMode: AreaNameStyleMode = DEFAULT_AREA_NAME_STYLE_MODE;

  async init() {
    const stored = await storage.get([
      AREA_MEASURE_KEY,
      AREA_REGIONS_KEY,
      AREA_REGION_GROUPS_KEY,
      AREA_FILL_OPACITY_KEY,
      AREA_NAME_DISPLAY_MODE_KEY,
      AREA_NAME_FONT_SIZE_KEY,
      AREA_NAME_STYLE_MODE_KEY,
    ]);

    this.areaMeasure = stored[AREA_MEASURE_KEY] ?? false;
    this.areaRegions = this.normalizeAreaRegions(stored[AREA_REGIONS_KEY]);
    this.areaRegionGroups = this.normalizeAreaRegionGroups(
      stored[AREA_REGION_GROUPS_KEY],
    );
    this.areaFillOpacityPercent =
      typeof stored[AREA_FILL_OPACITY_KEY] === "number"
        ? normalizeAreaFillOpacityPercent(stored[AREA_FILL_OPACITY_KEY])
        : DEFAULT_AREA_FILL_OPACITY_PERCENT;
    this.areaNameDisplayMode = normalizeAreaNameDisplayMode(
      stored[AREA_NAME_DISPLAY_MODE_KEY],
    );
    this.areaNameFontSizePx = normalizeAreaNameFontSizePx(
      stored[AREA_NAME_FONT_SIZE_KEY],
    );
    this.areaNameStyleMode = normalizeAreaNameStyleMode(
      stored[AREA_NAME_STYLE_MODE_KEY],
    );

    this.mapReady = getMapInstanceReady();
    if (this.mapReady) this.syncMapDependentState();

    this.notifyAreaRegions();

    if (!this.releaseMessageHandlers) {
      this.releaseMessageHandlers = bindAreaManagerMessageHandlers({
        onMapReady: () => {
          this.mapReady = true;
          this.syncMapDependentState();
          this.renderAreaManager();
        },
        onSaveClick: () => {
          void this.saveAreaEditing();
        },
        onCancelClick: () => {
          void this.stopAreaEditing();
        },
      });
    }

    console.log("🧑‍🎨 : Area manager initialized");
  }

  private syncMapDependentState() {
    this.notifyAreaMeasure();
    this.notifyAreaRegions();
    this.notifyAreaDisplayOptions();
  }

  async setAreaMeasureEnabled(enabled: boolean) {
    this.areaMeasure = enabled;
    await storage.set({ [AREA_MEASURE_KEY]: enabled });

    if (!enabled && this.areaEditMode) {
      await this.stopAreaEditing(true);
    }

    this.notifyAreaMeasure();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Filter toggled:", "areaMeasure", enabled);
  }

  isAreaMeasureEnabled(): boolean {
    return this.areaMeasure;
  }

  private notifyAreaMeasure() {
    postAreaMeasureUpdate(this.areaMeasure);
  }

  private notifyAreaRegions() {
    postAreaRegionsSync(this.areaRegions);
  }

  private getAreaDisplayOptions(): AreaDisplayOptions {
    return {
      fillOpacityPercent: this.areaFillOpacityPercent,
      nameDisplayMode: this.areaNameDisplayMode,
      nameFontSizePx: this.areaNameFontSizePx,
      nameStyleMode: this.areaNameStyleMode,
    };
  }

  private notifyAreaDisplayOptions() {
    postAreaDisplayOptionsUpdate(this.getAreaDisplayOptions());
  }

  private normalizeAreaRegions(value: unknown): AreaRegion[] {
    if (!Array.isArray(value)) return [];

    const now = Date.now();
    const normalized: AreaRegion[] = [];

    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const candidate = raw as Record<string, unknown>;
      const vertices = normalizeAreaVertices(candidate.vertices);
      if (vertices.length < 3) continue;

      const id =
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id
          : createAreaRegionId();
      const name =
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : createDefaultAreaName(normalized.length + 1);
      const color = normalizeAreaColor(
        candidate.color,
        createDistinctAreaColor(normalized),
      );
      const visible =
        typeof candidate.visible === "boolean" ? candidate.visible : true;
      const createdAt = normalizeTimestamp(candidate.createdAt, now);
      const updatedAt = normalizeTimestamp(candidate.updatedAt, createdAt);

      normalized.push({
        id,
        name,
        color,
        vertices,
        visible,
        createdAt,
        updatedAt,
      });
    }

    return normalized.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private normalizeAreaRegionGroups(value: unknown): AreaRegionGroup[] {
    const availableRegionIds = new Set(this.areaRegions.map((region) => region.id));
    return this.normalizeAreaRegionGroupsWithAvailable(value, availableRegionIds);
  }

  private normalizeAreaRegionGroupsWithAvailable(
    value: unknown,
    availableRegionIds: Set<string>,
  ): AreaRegionGroup[] {
    if (!Array.isArray(value)) return [];

    const now = Date.now();
    const normalized: AreaRegionGroup[] = [];

    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const candidate = raw as Record<string, unknown>;
      const regionIds = Array.isArray(candidate.regionIds)
        ? Array.from(
            new Set(
              candidate.regionIds
                .filter((id): id is string => typeof id === "string")
                .map((id) => id.trim())
                .filter((id) => id && availableRegionIds.has(id)),
            ),
          )
        : [];
      if (regionIds.length < 2) continue;

      const id =
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id
          : createAreaRegionGroupId();
      const name =
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : createDefaultAreaGroupName(normalized.length + 1);
      const createdAt = normalizeTimestamp(candidate.createdAt, now);
      const updatedAt = normalizeTimestamp(candidate.updatedAt, createdAt);

      normalized.push({
        id,
        name,
        regionIds,
        createdAt,
        updatedAt,
      });
    }

    return normalized.sort((a, b) => b.updatedAt - a.updatedAt);
  }


  private async persistAreaRegions() {
    await storage.set({ [AREA_REGIONS_KEY]: this.areaRegions });
  }

  private async persistAreaRegionGroups() {
    await storage.set({ [AREA_REGION_GROUPS_KEY]: this.areaRegionGroups });
  }

  private getGroupedRegionIds(): Set<string> {
    const ids = new Set<string>();
    for (const group of this.areaRegionGroups) {
      for (const regionId of group.regionIds) {
        ids.add(regionId);
      }
    }
    return ids;
  }

  private getRegionsForGroup(group: AreaRegionGroup): AreaRegion[] {
    const regionMap = new Map(this.areaRegions.map((region) => [region.id, region]));
    return group.regionIds
      .map((regionId) => regionMap.get(regionId))
      .filter((region): region is AreaRegion => Boolean(region));
  }

  private cleanupAreaRegionGroups(): boolean {
    const availableRegionIds = new Set(this.areaRegions.map((region) => region.id));
    let changed = false;
    const nextGroups: AreaRegionGroup[] = [];

    for (const group of this.areaRegionGroups) {
      const regionIds = Array.from(
        new Set(group.regionIds.filter((id) => availableRegionIds.has(id))),
      );

      if (regionIds.length < 2) {
        changed = true;
        continue;
      }

      if (
        regionIds.length !== group.regionIds.length ||
        regionIds.some((id, index) => id !== group.regionIds[index])
      ) {
        changed = true;
      }

      nextGroups.push({ ...group, regionIds });
    }

    if (changed) {
      this.areaRegionGroups = nextGroups.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return changed;
  }

  private getGroupVertices(group: AreaRegionGroup): AreaRegionVertex[] {
    return this.getRegionsForGroup(group).flatMap((region) => region.vertices);
  }


  private normalizeImportedAreaData(value: unknown): {
    regions: AreaRegion[];
    groups: AreaRegionGroup[];
  } {
    if (Array.isArray(value)) {
      return { regions: this.normalizeAreaRegions(value), groups: [] };
    }
    if (!value || typeof value !== "object") return { regions: [], groups: [] };

    const candidate = value as Record<string, unknown>;
    if (Array.isArray(candidate.regions)) {
      const regions = this.normalizeAreaRegions(candidate.regions);
      const groups = this.normalizeAreaRegionGroupsWithAvailable(
        candidate.mrWplaceAreaGroups ?? candidate.areaRegionGroups ?? candidate.groups,
        new Set(regions.map((region) => region.id)),
      );
      return { regions, groups };
    }

    if (
      candidate.type !== "FeatureCollection" ||
      !Array.isArray(candidate.features)
    ) {
      return { regions: [], groups: [] };
    }

    const normalizedFeatures = candidate.features
      .map((feature) => {
        if (!feature || typeof feature !== "object") return null;
        const rawFeature = feature as Record<string, unknown>;
        const vertices = parseGeoJsonVertices(rawFeature.geometry);
        if (vertices.length < 3) return null;

        const properties =
          rawFeature.properties && typeof rawFeature.properties === "object"
            ? (rawFeature.properties as Record<string, unknown>)
            : {};

        return {
          id: properties.id,
          name: properties.name,
          color: properties.color,
          visible: properties.visible,
          createdAt: properties.createdAt,
          updatedAt: properties.updatedAt,
          vertices,
        };
      })
      .filter((region): region is NonNullable<typeof region> =>
        Boolean(region),
      );

    const regions = this.normalizeAreaRegions(normalizedFeatures);
    const groups = this.normalizeAreaRegionGroupsWithAvailable(
      candidate.mrWplaceAreaGroups ?? candidate.areaRegionGroups ?? candidate.groups,
      new Set(regions.map((region) => region.id)),
    );
    return { regions, groups };
  }

  private async applyImportedAreaData(
    importedData: { regions: AreaRegion[]; groups: AreaRegionGroup[] },
    mode: "merge" | "replace",
  ): Promise<void> {
    await applyImportedAreaDataUsecase({
      importedData,
      mode,
      areaEditMode: this.areaEditMode,
      areaRegions: this.areaRegions,
      areaRegionGroups: this.areaRegionGroups,
      stopAreaEditing: (skipRender) => this.stopAreaEditing(skipRender),
      cleanupAreaRegionGroups: () => this.cleanupAreaRegionGroups(),
      persistAreaRegions: () => this.persistAreaRegions(),
      persistAreaRegionGroups: () => this.persistAreaRegionGroups(),
      notifyAreaRegions: () => this.notifyAreaRegions(),
      renderAreaManager: () => this.renderAreaManager(),
      setAreaRegions: (regions) => {
        this.areaRegions = regions;
      },
      setAreaRegionGroups: (groups) => {
        this.areaRegionGroups = groups;
      },
    });
  }

  private async importAreaRegionsFromText(
    text: string,
    mode: "merge" | "replace",
  ): Promise<number> {
    return importAreaRegionsFromTextUsecase({
      text,
      mode,
      normalizeImportedAreaData: (value) => this.normalizeImportedAreaData(value),
      applyImportedAreaData: (data, nextMode) =>
        this.applyImportedAreaData(data, nextMode),
    });
  }

  private async importAreaRegionsFromUrl(
    url: string,
    mode: "merge" | "replace",
  ): Promise<number> {
    return importAreaRegionsFromUrlUsecase({
      url,
      mode,
      importAreaRegionsFromText: (text, nextMode) =>
        this.importAreaRegionsFromText(text, nextMode),
    });
  }

  private downloadAreaRegions(regions: AreaRegion[]): void {
    downloadAreaRegionsUsecase({
      regions,
      areaRegionGroups: this.areaRegionGroups,
    });
  }

  private async showAreaImportExportDialog(): Promise<void> {
    await showImportExportDialog({
      areaRegions: this.areaRegions,
      getSavedSyncUrl: async () => {
        const saved = await storage.get([AREA_SYNC_URL_KEY]);
        return typeof saved[AREA_SYNC_URL_KEY] === "string"
          ? saved[AREA_SYNC_URL_KEY]
          : "";
      },
      saveSyncUrl: async (url) => {
        await storage.set({ [AREA_SYNC_URL_KEY]: url });
      },
      importFromUrl: async (url, mode) => {
        await this.importAreaRegionsFromUrl(url, mode);
      },
      importFromText: async (text, mode) => {
        await this.importAreaRegionsFromText(text, mode);
      },
      downloadRegions: (regions) => this.downloadAreaRegions(regions),
    });
  }

  private getEditingRegion(): AreaRegion | undefined {
    if (!this.editingRegionId) return undefined;
    return this.areaRegions.find(
      (region) => region.id === this.editingRegionId,
    );
  }

  private getEditingLabel(): string {
    const editingRegion = this.getEditingRegion();
    if (editingRegion) return editingRegion.name;
    if (this.editingRegionName.trim()) return this.editingRegionName.trim();
    return t`${"map_filter_area_new_region"}`;
  }

  private ensureAreaManagerModal() {
    if (this.areaManagerModal) return;

    this.areaManagerModal = createModal({
      id: AREA_MANAGER_MODAL_ID,
      title: t`${"map_filter_area_manager_title"}`,
      maxWidth: "34rem",
    });

    this.areaManagerModal.modal.addEventListener(
      "close",
      () => {
        this.areaManagerModal = null;
      },
      { once: true },
    );
  }

  openAreaManager() {
    this.ensureAreaManagerModal();
    this.renderAreaManager();

    if (!this.areaManagerModal?.modal.open) {
      this.areaManagerModal?.modal.showModal();
    }
  }

  private closeAreaManager() {
    this.areaManagerModal?.modal.close();
  }

  private async showAreaGroupComposeDialog() {
    const groupedRegionIds = this.getGroupedRegionIds();
    const candidates = this.areaRegions.filter(
      (region) => !groupedRegionIds.has(region.id),
    );
    await showGroupComposeDialog({
      candidates,
      onCreate: async (selectedIds, groupName) => {
        if (selectedIds.length < 2) return;

        const selectedRegions = this.areaRegions.filter((region) =>
          selectedIds.includes(region.id),
        );
        if (selectedRegions.length < 2) return;

        const primaryRegion = selectedRegions.reduce((current, region) => {
          const currentCreated =
            Number.isFinite(current.createdAt) && current.createdAt > 0
              ? current.createdAt
              : Number.MAX_SAFE_INTEGER;
          const regionCreated =
            Number.isFinite(region.createdAt) && region.createdAt > 0
              ? region.createdAt
              : Number.MAX_SAFE_INTEGER;
          return regionCreated < currentCreated ? region : current;
        }, selectedRegions[0]);

        const now = Date.now();
        const unifiedName = groupName || primaryRegion.name;
        const unifiedColor = primaryRegion.color;

        for (const region of selectedRegions) {
          region.name = unifiedName;
          region.color = unifiedColor;
          region.updatedAt = now;
        }

        const group: AreaRegionGroup = {
          id: createAreaRegionGroupId(),
          name:
            unifiedName ||
            createDefaultAreaGroupName(this.areaRegionGroups.length + 1),
          regionIds: selectedIds,
          createdAt: now,
          updatedAt: now,
        };

        this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);
        this.areaRegionGroups.unshift(group);
        await this.persistAreaRegions();
        await this.persistAreaRegionGroups();
        this.notifyAreaRegions();
        this.renderAreaManager();

        console.log("🧑‍🎨 : Area group created:", group.id, group.regionIds.length);
      },
    });
  }

  private async updateAreaFillOpacityPercent(
    value: number,
    persist = true,
  ): Promise<void> {
    const normalized = normalizeAreaFillOpacityPercent(value);
    if (normalized === this.areaFillOpacityPercent && !persist) return;

    this.areaFillOpacityPercent = normalized;
    this.notifyAreaDisplayOptions();

    if (persist) {
      await storage.set({ [AREA_FILL_OPACITY_KEY]: normalized });
    }
  }

  private async setAreaNameDisplayMode(mode: AreaNameDisplayMode): Promise<void> {
    if (mode === this.areaNameDisplayMode) return;
    this.areaNameDisplayMode = mode;
    await storage.set({ [AREA_NAME_DISPLAY_MODE_KEY]: mode });
    this.notifyAreaDisplayOptions();
  }

  private async updateAreaNameFontSizePx(
    value: number,
    persist = true,
  ): Promise<void> {
    const normalized = normalizeAreaNameFontSizePx(value);
    if (normalized === this.areaNameFontSizePx && !persist) return;

    this.areaNameFontSizePx = normalized;
    this.notifyAreaDisplayOptions();

    if (persist) {
      await storage.set({ [AREA_NAME_FONT_SIZE_KEY]: normalized });
    }
  }

  private async setAreaNameStyleMode(mode: AreaNameStyleMode): Promise<void> {
    if (mode === this.areaNameStyleMode) return;
    this.areaNameStyleMode = mode;
    await storage.set({ [AREA_NAME_STYLE_MODE_KEY]: mode });
    this.notifyAreaDisplayOptions();
  }

  private showAreaDisplaySettingsDialog() {
    showDisplaySettingsDialog({
      fillOpacityPercent: this.areaFillOpacityPercent,
      areaNameDisplayMode: this.areaNameDisplayMode,
      areaNameFontSizePx: this.areaNameFontSizePx,
      areaNameStyleMode: this.areaNameStyleMode,
      normalizeAreaFillOpacityPercent,
      normalizeAreaNameDisplayMode,
      normalizeAreaNameStyleMode: (value) =>
        normalizeAreaNameStyleMode(value),
      updateAreaFillOpacityPercent: (value, persist) =>
        this.updateAreaFillOpacityPercent(value, persist),
      setAreaNameDisplayMode: (mode) => this.setAreaNameDisplayMode(mode),
      updateAreaNameFontSizePx: (value, persist) =>
        this.updateAreaNameFontSizePx(value, persist),
      setAreaNameStyleMode: (mode) => this.setAreaNameStyleMode(mode),
    });
  }

  private renderAreaManager() {
    const container = this.areaManagerModal?.container;
    if (!container) return;

    container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "flex flex-col gap-2";

    const list = document.createElement("div");
    list.className = "flex flex-col gap-2";
    const groupedRegionIds = this.getGroupedRegionIds();
    const ungroupedRegions = this.areaRegions.filter(
      (region) => !groupedRegionIds.has(region.id),
    );

    if (this.areaRegions.length === 0 && this.areaRegionGroups.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-sm opacity-70";
      empty.textContent = t`${"map_filter_area_empty"}`;
      list.appendChild(empty);
    } else {
      for (const group of this.areaRegionGroups) {
        const members = this.getRegionsForGroup(group);
        if (members.length < 2) continue;

        const groupVisible = members.every((region) => region.visible);
        const mainColor = members[0]?.color ?? DEFAULT_AREA_COLOR;

        const card = document.createElement("div");
        card.className = "card bg-base-200";
        card.style.cssText = `
          padding: 0.6rem 0.7rem;
          border: 3px dashed ${mainColor};
          border-radius: 0.8rem;
          ${groupVisible ? "" : "opacity: 0.58;"}
        `;

        const topRow = document.createElement("div");
        topRow.className = "flex items-start justify-between gap-2";

        const titleRow = document.createElement("div");
        titleRow.className = "flex items-center gap-2 min-w-0";

        const name = document.createElement("div");
        name.className = "font-semibold text-base leading-tight truncate";
        name.style.maxWidth = "14rem";
        name.style.cursor = this.mapReady ? "pointer" : "default";
        if (this.mapReady) {
          name.title = t`${"goto_map"}`;
          name.addEventListener("click", () => {
            this.gotoAreaRegionGroup(group.id);
          });
        }
        name.textContent = `🔗 ${group.name}`;

        const renameButton = document.createElement("button");
        renameButton.className = "btn btn-ghost btn-xs";
        renameButton.title = t`${"map_filter_area_rename"}`;
        renameButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; opacity: 0.7;">
            <path d="M16.862 3.487a2.1 2.1 0 0 1 2.97 2.97l-10.5 10.5a2.25 2.25 0 0 1-1.01.57l-3.14.79a.75.75 0 0 1-.91-.91l.79-3.14a2.25 2.25 0 0 1 .57-1.01l10.5-10.5ZM15.8 5.61 7.29 14.12a.75.75 0 0 0-.19.34l-.46 1.83 1.83-.46a.75.75 0 0 0 .34-.19l8.51-8.51L15.8 5.61Z" />
          </svg>
        `;
        renameButton.addEventListener("click", () => {
          this.renameAreaRegionGroup(group.id);
        });

        titleRow.appendChild(name);
        titleRow.appendChild(renameButton);

        const deleteButton = document.createElement("button");
        deleteButton.className = "btn btn-ghost btn-xs";
        deleteButton.title = "合体解除";
        deleteButton.style.color = "#dc2626";
        deleteButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 0 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
          </svg>
        `;
        deleteButton.addEventListener("click", () => {
          this.removeAreaRegionGroup(group.id);
        });

        topRow.appendChild(titleRow);
        topRow.appendChild(deleteButton);
        card.appendChild(topRow);

        const area = document.createElement("span");
        area.className = "text-sm opacity-80";
        const allVertices = members.flatMap((region) => region.vertices);
        const km2Text =
          allVertices.length > 0
            ? formatAreaKm2(allVertices)
            : "0 km²";
        const totalPx = members.reduce(
          (sum, region) => sum + calculatePixelAreaSquare(region.vertices),
          0,
        );
        area.innerHTML = `${km2Text} <span style="opacity: 0.7; font-size: 0.9em;">(${formatPixelArea(totalPx)})</span>`;

        const actionRow = document.createElement("div");
        actionRow.className = "flex items-center justify-between gap-2 pt-1";

        const membersText = document.createElement("span");
        membersText.className = "text-xs opacity-70";
        membersText.textContent = `${members.length} エリア`;

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "w-7 h-7 cursor-pointer";
        colorInput.value = mainColor;
        colorInput.title = t`${"map_filter_area_color"}`;
        colorInput.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          card.style.borderColor = normalizeAreaColor(
            target.value,
            mainColor,
          );
        });
        colorInput.addEventListener("change", (event) => {
          const target = event.target as HTMLInputElement;
          this.changeAreaRegionGroupColor(group.id, target.value);
        });

        const visibilityButton = document.createElement("button");
        visibilityButton.className = "btn btn-xs btn-outline";
        visibilityButton.title = groupVisible
          ? t`${"map_filter_area_hide"}`
          : t`${"map_filter_area_show"}`;
        visibilityButton.innerHTML = groupVisible
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M12 4.5c6.75 0 10.5 7.5 10.5 7.5s-3.75 7.5-10.5 7.5S1.5 12 1.5 12 5.25 4.5 12 4.5Zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M3.53 2.47a.75.75 0 1 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-2.134-2.134A10.73 10.73 0 0 0 22.5 12s-3.75-7.5-10.5-7.5a10.8 10.8 0 0 0-4.286.897L3.53 2.47ZM12 7.5c2.485 0 4.5 2.015 4.5 4.5 0 .69-.156 1.343-.435 1.926l-5.99-5.99A4.473 4.473 0 0 1 12 7.5Z"/><path d="M5.315 8.375A13.72 13.72 0 0 0 1.5 12s3.75 7.5 10.5 7.5a10.74 10.74 0 0 0 5.394-1.456l-2.145-2.145A4.48 4.48 0 0 1 12 16.5c-2.485 0-4.5-2.015-4.5-4.5 0-.512.086-1.003.244-1.46L5.315 8.375Z"/></svg>`;
        visibilityButton.addEventListener("click", () => {
          this.toggleAreaRegionGroupVisibility(group.id);
        });

        const gotoButton = document.createElement("button");
        gotoButton.className = "btn btn-xs btn-outline";
        gotoButton.title = t`${"goto_map"}`;
        gotoButton.disabled = !this.mapReady;
        gotoButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width: 14px; height: 14px;">
            <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"/>
          </svg>
        `;
        gotoButton.addEventListener("click", () => {
          this.gotoAreaRegionGroup(group.id);
        });

        const rightControls = document.createElement("div");
        rightControls.className = "flex items-center gap-1";
        rightControls.appendChild(colorInput);
        rightControls.appendChild(visibilityButton);
        rightControls.appendChild(gotoButton);

        actionRow.appendChild(membersText);
        actionRow.appendChild(rightControls);
        card.appendChild(actionRow);
        list.appendChild(card);
      }

      for (const region of ungroupedRegions) {
        const card = document.createElement("div");
        card.className = "card bg-base-200";
        card.style.cssText = `
          padding: 0.6rem 0.7rem;
          border: 3px solid ${region.color};
          border-radius: 0.8rem;
          ${region.visible ? "" : "opacity: 0.58;"}
        `;

        const topRow = document.createElement("div");
        topRow.className = "flex items-start justify-between gap-2";

        const titleRow = document.createElement("div");
        titleRow.className = "flex items-center gap-2 min-w-0";

        const name = document.createElement("div");
        name.className = "font-semibold text-base leading-tight truncate";
        name.style.maxWidth = "14rem";
        name.style.cursor = this.mapReady ? "pointer" : "default";
        if (this.mapReady) {
          name.title = t`${"goto_map"}`;
          name.addEventListener("click", () => {
            this.gotoAreaRegion(region.id);
          });
        }
        name.textContent = region.name;

        const renameButton = document.createElement("button");
        renameButton.className = "btn btn-ghost btn-xs";
        renameButton.title = t`${"map_filter_area_rename"}`;
        renameButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px; opacity: 0.7;">
            <path d="M16.862 3.487a2.1 2.1 0 0 1 2.97 2.97l-10.5 10.5a2.25 2.25 0 0 1-1.01.57l-3.14.79a.75.75 0 0 1-.91-.91l.79-3.14a2.25 2.25 0 0 1 .57-1.01l10.5-10.5ZM15.8 5.61 7.29 14.12a.75.75 0 0 0-.19.34l-.46 1.83 1.83-.46a.75.75 0 0 0 .34-.19l8.51-8.51L15.8 5.61Z" />
          </svg>
        `;
        renameButton.addEventListener("click", () => {
          this.renameAreaRegion(region.id);
        });

        titleRow.appendChild(name);
        titleRow.appendChild(renameButton);

        const deleteButton = document.createElement("button");
        deleteButton.className = "btn btn-ghost btn-xs";
        deleteButton.title = t`${"delete"}`;
        deleteButton.style.color = "#dc2626";
        deleteButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 0 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
          </svg>
        `;
        deleteButton.addEventListener("click", () => {
          this.deleteAreaRegion(region.id);
        });

        topRow.appendChild(titleRow);
        topRow.appendChild(deleteButton);
        card.appendChild(topRow);

        const area = document.createElement("span");
        area.className = "text-sm opacity-80";
        const areaKm2 = formatAreaKm2(region.vertices);
        const pixelArea = formatPixelArea(
          calculatePixelAreaSquare(region.vertices),
        );
        area.innerHTML = `${areaKm2} <span style="opacity: 0.7; font-size: 0.9em;">(${pixelArea})</span>`;

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "w-7 h-7 cursor-pointer";
        colorInput.value = region.color;
        colorInput.title = t`${"map_filter_area_color"}`;
        colorInput.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          card.style.borderColor = normalizeAreaColor(
            target.value,
            region.color,
          );
        });
        colorInput.addEventListener("change", (event) => {
          const target = event.target as HTMLInputElement;
          this.changeAreaRegionColor(region.id, target.value);
        });

        const actionRow = document.createElement("div");
        actionRow.className = "flex items-center justify-between gap-2 pt-1";

        const visibilityButton = document.createElement("button");
        visibilityButton.className = "btn btn-xs btn-outline";
        visibilityButton.title = region.visible
          ? t`${"map_filter_area_hide"}`
          : t`${"map_filter_area_show"}`;
        visibilityButton.innerHTML = region.visible
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M12 4.5c6.75 0 10.5 7.5 10.5 7.5s-3.75 7.5-10.5 7.5S1.5 12 1.5 12 5.25 4.5 12 4.5Zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M3.53 2.47a.75.75 0 1 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-2.134-2.134A10.73 10.73 0 0 0 22.5 12s-3.75-7.5-10.5-7.5a10.8 10.8 0 0 0-4.286.897L3.53 2.47ZM12 7.5c2.485 0 4.5 2.015 4.5 4.5 0 .69-.156 1.343-.435 1.926l-5.99-5.99A4.473 4.473 0 0 1 12 7.5Z"/><path d="M5.315 8.375A13.72 13.72 0 0 0 1.5 12s3.75 7.5 10.5 7.5a10.74 10.74 0 0 0 5.394-1.456l-2.145-2.145A4.48 4.48 0 0 1 12 16.5c-2.485 0-4.5-2.015-4.5-4.5 0-.512.086-1.003.244-1.46L5.315 8.375Z"/></svg>`;
        visibilityButton.addEventListener("click", () => {
          this.toggleAreaRegionVisibility(region.id);
        });

        const gotoButton = document.createElement("button");
        gotoButton.className = "btn btn-xs btn-outline";
        gotoButton.title = t`${"goto_map"}`;
        gotoButton.disabled = !this.mapReady;
        gotoButton.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width: 14px; height: 14px;">
            <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"/>
          </svg>
        `;
        gotoButton.addEventListener("click", () => {
          this.gotoAreaRegion(region.id);
        });

        const editButton = document.createElement("button");
        editButton.className = "btn btn-xs btn-primary";
        editButton.textContent = t`${"edit"}`;
        editButton.disabled = !this.mapReady;
        editButton.addEventListener("click", () => {
          this.startAreaEditing(region.id, true);
        });

        const rightControls = document.createElement("div");
        rightControls.className = "flex items-center gap-1";
        rightControls.appendChild(colorInput);
        rightControls.appendChild(visibilityButton);
        rightControls.appendChild(gotoButton);
        rightControls.appendChild(editButton);

        actionRow.appendChild(area);
        actionRow.appendChild(rightControls);
        card.appendChild(actionRow);

        list.appendChild(card);
      }
    }

    const addButton = document.createElement("button");
    addButton.className = "btn btn-primary btn-sm flex-1";
    addButton.textContent = t`${"map_filter_area_add"}`;
    addButton.disabled = !this.mapReady;
    addButton.addEventListener("click", () => {
      this.startAreaEditing(null, true);
    });

    const importExportButton = document.createElement("button");
    importExportButton.id = "wps-area-import-export-btn";
    importExportButton.className = "btn btn-outline btn-sm flex-1";
    importExportButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
        <path d="M440-367v-465l-64 64-56-57 160-160 160 160-56 57-64-64v465h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
      </svg>
      ${t`${"import_export"}`}
    `;
    importExportButton.addEventListener("click", () => {
      this.showAreaImportExportDialog();
    });

    const composeGroupButton = document.createElement("button");
    composeGroupButton.className = "btn btn-outline btn-sm";
    composeGroupButton.textContent = "エリア合体";
    composeGroupButton.disabled = ungroupedRegions.length < 2;
    composeGroupButton.addEventListener("click", () => {
      this.showAreaGroupComposeDialog();
    });

    const settingsButton = document.createElement("button");
    settingsButton.className = "btn btn-outline btn-sm btn-circle";
    settingsButton.title = "表示設定";
    settingsButton.style.marginLeft = "auto";
    settingsButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width: 16px; height: 16px;">
        <path d="m370-80-16-128q-13-5-24.5-12T307-236l-119 50-85-146 103-78q-2-14-2-30t2-30L103-548l85-146 119 50q11-9 22.5-16t24.5-12l16-128h220l16 128q13 5 24.5 12t22.5 16l119-50 85 146-103 78q2 14 2 30t-2 30l103 78-85 146-119-50q-11 9-22.5 16T606-208L590-80H370Zm110-280q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Z"/>
      </svg>
    `;
    settingsButton.addEventListener("click", () => {
      this.showAreaDisplaySettingsDialog();
    });

    const actionRow = document.createElement("div");
    actionRow.className = "flex items-center gap-2 flex-wrap";
    actionRow.appendChild(addButton);
    actionRow.appendChild(importExportButton);
    actionRow.appendChild(composeGroupButton);
    actionRow.appendChild(settingsButton);

    root.appendChild(actionRow);
    root.appendChild(list);

    container.appendChild(root);
  }

  private gotoAreaRegion(regionId: string) {
    const target = this.areaRegions.find((region) => region.id === regionId);
    if (!target || target.vertices.length === 0) return;
    const bounds = getAreaBounds(target.vertices);

    const centerLng =
      target.vertices.reduce((sum, v) => sum + v.lng, 0) /
      target.vertices.length;
    const centerLat =
      target.vertices.reduce((sum, v) => sum + v.lat, 0) /
      target.vertices.length;

    postAreaRegionGoto({
      regionId,
      lng: centerLng,
      lat: centerLat,
      bounds,
    });

    console.log("🧑‍🎨 : Goto area region:", regionId);
  }

  private gotoAreaRegionGroup(groupId: string) {
    const group = this.areaRegionGroups.find((item) => item.id === groupId);
    if (!group) return;

    const vertices = this.getGroupVertices(group);
    if (vertices.length === 0) return;
    const bounds = getAreaBounds(vertices);

    const centerLng =
      vertices.reduce((sum, v) => sum + v.lng, 0) / vertices.length;
    const centerLat =
      vertices.reduce((sum, v) => sum + v.lat, 0) / vertices.length;

    postAreaRegionGoto({
      regionId: groupId,
      lng: centerLng,
      lat: centerLat,
      bounds,
    });

    console.log("🧑‍🎨 : Goto area group:", groupId);
  }

  private async toggleAreaRegionGroupVisibility(groupId: string) {
    const group = this.areaRegionGroups.find((item) => item.id === groupId);
    if (!group) return;

    const targets = this.getRegionsForGroup(group);
    if (targets.length === 0) return;

    const shouldShow = targets.some((region) => !region.visible);
    const now = Date.now();
    for (const region of targets) {
      region.visible = shouldShow;
      region.updatedAt = now;
    }

    group.updatedAt = now;
    this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);
    this.areaRegionGroups.sort((a, b) => b.updatedAt - a.updatedAt);

    await this.persistAreaRegions();
    await this.persistAreaRegionGroups();
    this.notifyAreaRegions();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area group visibility toggled:", groupId, shouldShow);
  }

  private async changeAreaRegionGroupColor(groupId: string, nextColor: string) {
    const group = this.areaRegionGroups.find((item) => item.id === groupId);
    if (!group) return;

    const color = normalizeAreaColor(nextColor);
    const targets = this.getRegionsForGroup(group);
    if (targets.length === 0) return;
    if (targets.every((region) => region.color === color)) return;

    const now = Date.now();
    for (const region of targets) {
      region.color = color;
      region.updatedAt = now;
    }

    group.updatedAt = now;
    this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);
    this.areaRegionGroups.sort((a, b) => b.updatedAt - a.updatedAt);

    await this.persistAreaRegions();
    await this.persistAreaRegionGroups();
    this.notifyAreaRegions();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area group color changed:", groupId, color);
  }

  private async renameAreaRegionGroup(groupId: string) {
    const group = this.areaRegionGroups.find((item) => item.id === groupId);
    if (!group) return;

    const value = await showNameInputModal(
      t`${"map_filter_area_rename"}`,
      t`${"map_filter_area_name_placeholder"}`,
      group.name,
    );
    if (value == null) return;

    const name = value.trim();
    if (!name) return;

    const now = Date.now();
    const members = this.getRegionsForGroup(group);
    for (const region of members) {
      region.name = name;
      region.updatedAt = now;
    }

    group.name = name;
    group.updatedAt = now;
    this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);
    this.areaRegionGroups.sort((a, b) => b.updatedAt - a.updatedAt);

    await this.persistAreaRegions();
    await this.persistAreaRegionGroups();
    this.notifyAreaRegions();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area group renamed:", groupId, name);
  }

  private async removeAreaRegionGroup(groupId: string) {
    const group = this.areaRegionGroups.find((item) => item.id === groupId);
    if (!group) return;
    if (!confirm("この合体エリアを解除しますか？")) return;

    this.areaRegionGroups = this.areaRegionGroups.filter(
      (item) => item.id !== groupId,
    );

    await this.persistAreaRegionGroups();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area group removed:", groupId);
  }

  private async toggleAreaRegionVisibility(regionId: string) {
    const target = this.areaRegions.find((region) => region.id === regionId);
    if (!target) return;

    target.visible = !target.visible;
    target.updatedAt = Date.now();
    this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);

    await this.persistAreaRegions();
    this.notifyAreaRegions();
    this.renderAreaManager();

    console.log(
      "🧑‍🎨 : Area region visibility toggled:",
      regionId,
      target.visible,
    );
  }

  private async changeAreaRegionColor(regionId: string, nextColor: string) {
    const target = this.areaRegions.find((region) => region.id === regionId);
    if (!target) return;

    const color = normalizeAreaColor(nextColor);
    if (color === target.color) return;

    target.color = color;
    target.updatedAt = Date.now();
    this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);

    await this.persistAreaRegions();
    this.notifyAreaRegions();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area region color changed:", regionId, color);
  }

  private async renameAreaRegion(regionId: string) {
    const target = this.areaRegions.find((region) => region.id === regionId);
    if (!target) return;

    const value = await showNameInputModal(
      t`${"map_filter_area_rename"}`,
      t`${"map_filter_area_name_placeholder"}`,
      target.name,
    );

    if (value == null) return;

    const name = value.trim();
    if (!name) return;

    target.name = name;
    target.updatedAt = Date.now();
    this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);

    await this.persistAreaRegions();
    this.notifyAreaRegions();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area region renamed:", regionId, name);
  }

  private async deleteAreaRegion(regionId: string) {
    const target = this.areaRegions.find((region) => region.id === regionId);
    if (!target) return;

    const shouldDelete = confirm(t`${"map_filter_area_delete_confirm"}`);
    if (!shouldDelete) return;

    this.areaRegions = this.areaRegions.filter(
      (region) => region.id !== regionId,
    );
    const groupsChanged = this.cleanupAreaRegionGroups();

    if (this.editingRegionId === regionId && this.areaEditMode) {
      await this.stopAreaEditing(true);
    }

    await this.persistAreaRegions();
    if (groupsChanged) await this.persistAreaRegionGroups();
    this.notifyAreaRegions();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area region deleted:", regionId);
  }

  private async startAreaEditing(regionId: string | null, closeModal = false) {
    if (!this.mapReady) return;

    const editingRegion = regionId
      ? this.areaRegions.find((region) => region.id === regionId)
      : undefined;

    if (!this.areaMeasure) {
      await this.setAreaMeasureEnabled(true);
    }

    this.areaEditMode = true;
    this.editingRegionId = editingRegion?.id ?? null;
    this.editingRegionName = editingRegion?.name ?? "";

    if (closeModal) this.closeAreaManager();

    postAreaRegionEditStart({
      regionId: this.editingRegionId,
      name: this.editingRegionName,
      color: editingRegion?.color ?? createDistinctAreaColor(this.areaRegions),
      vertices: editingRegion?.vertices ?? [],
      saveLabel: t`${"map_filter_area_save_map"}`,
      cancelLabel: t`${"cancel"}`,
    });

    console.log("🧑‍🎨 : Area edit requested:", this.editingRegionId ?? "new");
  }

  private async stopAreaEditing(skipRender = false) {
    if (!this.areaEditMode) return;

    this.areaEditMode = false;
    this.editingRegionId = null;
    this.editingRegionName = "";

    postAreaRegionEditStop();

    if (!skipRender) this.renderAreaManager();

    console.log("🧑‍🎨 : Area edit stopped");
  }

  private async saveAreaEditing() {
    if (!this.areaEditMode) return;

    const snapshot = await requestAreaEditSnapshot({
      normalizeVertices: (value) => normalizeAreaVertices(value),
    });
    if (!snapshot || snapshot.vertices.length < 3) {
      alert(t`${"map_filter_area_need_polygon"}`);
      return;
    }

    const now = Date.now();
    const existing = this.getEditingRegion();

    if (existing) {
      existing.vertices = snapshot.vertices;
      existing.updatedAt = now;
      this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);
      await this.persistAreaRegions();
      this.notifyAreaRegions();
      await this.stopAreaEditing(true);
      this.renderAreaManager();

      console.log("🧑‍🎨 : Area region updated:", existing.id);
      return;
    }

    const suggestedName = this.getEditingLabel();
    const nameInput = await showNameInputModal(
      t`${"map_filter_area_save_new"}`,
      t`${"map_filter_area_name_placeholder"}`,
      suggestedName,
    );

    if (nameInput == null) return;

    const name =
      nameInput.trim() ||
      createDefaultAreaName(this.areaRegions.length + 1);
    const newRegion: AreaRegion = {
      id: createAreaRegionId(),
      name,
      color: createDistinctAreaColor(this.areaRegions),
      vertices: snapshot.vertices,
      visible: true,
      createdAt: now,
      updatedAt: now,
    };

    this.areaRegions.unshift(newRegion);
    await this.persistAreaRegions();
    this.notifyAreaRegions();
    await this.stopAreaEditing(true);
    this.renderAreaManager();

    console.log("🧑‍🎨 : Area region created:", newRegion.id);
  }
}

let areaManagerInstance: AreaManager | null = null;

export const areaManagerAPI = {
  initAreaManager: async () => {
    if (!areaManagerInstance) {
      areaManagerInstance = new AreaManager();
    }
    await areaManagerInstance.init();
  },
  openAreaManager: () => {
    areaManagerInstance?.openAreaManager();
  },
  setAreaMeasureEnabled: async (enabled: boolean) => {
    if (areaManagerInstance) {
      await areaManagerInstance.setAreaMeasureEnabled(enabled);
      return;
    }

    await storage.set({ [AREA_MEASURE_KEY]: enabled });
    postAreaMeasureUpdate(enabled);
  },
  getAreaMeasureEnabled: () => {
    return areaManagerInstance?.isAreaMeasureEnabled();
  },
};
