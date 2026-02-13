import {
  createModal,
  ModalElements,
  showNameInputModal,
} from "@/components/modal";
import { storage } from "@/utils/browser-api";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import { t } from "@/i18n/manager";
import type {
  AreaRegion,
  AreaRegionEditSnapshot,
  AreaRegionVertex,
} from "@/types/area-region";
import { latLonToPixels } from "@/utils/geo-converter";

const AREA_MEASURE_KEY = "mapFilter_areaMeasure";
const AREA_REGIONS_KEY = "areaRegions_v1";
const AREA_REGION_GROUPS_KEY = "areaRegionGroups_v1";
const AREA_SYNC_URL_KEY = "mapFilter_areaSyncUrl";
const AREA_MANAGER_MODAL_ID = "wplace-studio-area-manager-modal";
const DEFAULT_AREA_COLOR = "#0f766e";
const AUTO_AREA_COLOR_GOLDEN_ANGLE = 137.508;

interface AreaRegionGroup {
  id: string;
  name: string;
  regionIds: string[];
  createdAt: number;
  updatedAt: number;
}

class AreaManager {
  private areaManagerModal: ModalElements | null = null;
  private areaRegions: AreaRegion[] = [];
  private areaRegionGroups: AreaRegionGroup[] = [];
  private areaEditMode = false;
  private editingRegionId: string | null = null;
  private editingRegionName = "";
  private areaRequestCounter = 0;
  private mapReady = false;
  private areaMeasure = false;

  async init() {
    const stored = await storage.get([
      AREA_MEASURE_KEY,
      AREA_REGIONS_KEY,
      AREA_REGION_GROUPS_KEY,
    ]);

    this.areaMeasure = stored[AREA_MEASURE_KEY] ?? false;
    this.areaRegions = this.normalizeAreaRegions(stored[AREA_REGIONS_KEY]);
    this.areaRegionGroups = this.normalizeAreaRegionGroups(
      stored[AREA_REGION_GROUPS_KEY],
    );

    this.mapReady = getMapInstanceReady();
    if (this.mapReady) this.syncMapDependentState();

    this.notifyAreaRegions();

    window.addEventListener("message", (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-map-instance-captured" &&
        event.data.ready
      ) {
        this.mapReady = true;
        this.syncMapDependentState();
        this.renderAreaManager();
        return;
      }

      if (event.data.source === "mr-wplace-area-region-save-click") {
        this.saveAreaEditing();
        return;
      }

      if (event.data.source === "mr-wplace-area-region-cancel-click") {
        this.stopAreaEditing();
      }
    });

    console.log("🧑‍🎨 : Area manager initialized");
  }

  private syncMapDependentState() {
    this.notifyAreaMeasure();
    this.notifyAreaRegions();
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
    window.postMessage(
      {
        source: "mr-wplace-area-measure-update",
        visible: this.areaMeasure,
      },
      "*",
    );
  }

  private notifyAreaRegions() {
    window.postMessage(
      {
        source: "mr-wplace-area-regions-sync",
        regions: this.areaRegions,
      },
      "*",
    );
  }

  private normalizeAreaRegions(value: unknown): AreaRegion[] {
    if (!Array.isArray(value)) return [];

    const now = Date.now();
    const normalized: AreaRegion[] = [];

    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const candidate = raw as Record<string, unknown>;
      const vertices = this.normalizeAreaVertices(candidate.vertices);
      if (vertices.length < 3) continue;

      const id =
        typeof candidate.id === "string" && candidate.id.trim()
          ? candidate.id
          : this.createAreaRegionId();
      const name =
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : this.createDefaultAreaName(normalized.length + 1);
      const color = this.normalizeAreaColor(
        candidate.color,
        this.createDistinctAreaColor(normalized),
      );
      const visible =
        typeof candidate.visible === "boolean" ? candidate.visible : true;
      const createdAt = this.normalizeTimestamp(candidate.createdAt, now);
      const updatedAt = this.normalizeTimestamp(candidate.updatedAt, createdAt);

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
          : this.createAreaRegionGroupId();
      const name =
        typeof candidate.name === "string" && candidate.name.trim()
          ? candidate.name.trim()
          : this.createDefaultAreaGroupName(normalized.length + 1);
      const createdAt = this.normalizeTimestamp(candidate.createdAt, now);
      const updatedAt = this.normalizeTimestamp(candidate.updatedAt, createdAt);

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

  private normalizeAreaVertices(value: unknown): AreaRegionVertex[] {
    if (!Array.isArray(value)) return [];

    const vertices: AreaRegionVertex[] = [];
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const candidate = raw as Record<string, unknown>;
      const lng = candidate.lng;
      const lat = candidate.lat;
      if (
        typeof lng === "number" &&
        Number.isFinite(lng) &&
        typeof lat === "number" &&
        Number.isFinite(lat)
      ) {
        vertices.push({ lng, lat });
      }
    }

    return vertices;
  }

  private normalizeTimestamp(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : fallback;
  }

  private normalizeAreaColor(
    value: unknown,
    fallback = DEFAULT_AREA_COLOR,
  ): string {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(normalized)) return fallback;
    return normalized.toLowerCase();
  }

  private hueDistance(a: number, b: number): number {
    const diff = Math.abs(a - b);
    return Math.min(diff, 360 - diff);
  }

  private getColorHue(color: string): number | null {
    const normalized = this.normalizeAreaColor(color, "");
    if (!normalized) return null;

    const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
    const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
    const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    if (delta === 0) return 0;

    let hue = 0;
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;

    return (hue * 60 + 360) % 360;
  }

  private hslToHex(hue: number, saturation: number, lightness: number): string {
    const h = ((hue % 360) + 360) % 360;
    const s = Math.max(0, Math.min(100, saturation)) / 100;
    const l = Math.max(0, Math.min(100, lightness)) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let rPrime = 0;
    let gPrime = 0;
    let bPrime = 0;

    if (h < 60) {
      rPrime = c;
      gPrime = x;
    } else if (h < 120) {
      rPrime = x;
      gPrime = c;
    } else if (h < 180) {
      gPrime = c;
      bPrime = x;
    } else if (h < 240) {
      gPrime = x;
      bPrime = c;
    } else if (h < 300) {
      rPrime = x;
      bPrime = c;
    } else {
      rPrime = c;
      bPrime = x;
    }

    const toHex = (value: number): string =>
      Math.round((value + m) * 255)
        .toString(16)
        .padStart(2, "0");

    return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
  }

  private createDistinctAreaColor(
    regions: AreaRegion[] = this.areaRegions,
  ): string {
    const usedHues = regions
      .map((region) => this.getColorHue(region.color))
      .filter((hue): hue is number => hue !== null);

    const seedHue = (regions.length * AUTO_AREA_COLOR_GOLDEN_ANGLE) % 360;
    const candidateCount = Math.max(18, usedHues.length * 3);
    let bestHue = seedHue;
    let bestDistance = -1;

    for (let i = 0; i < candidateCount; i++) {
      const hue = (seedHue + i * AUTO_AREA_COLOR_GOLDEN_ANGLE) % 360;
      const nearestDistance =
        usedHues.length === 0
          ? 180
          : Math.min(
              ...usedHues.map((usedHue) => this.hueDistance(hue, usedHue)),
            );

      if (nearestDistance > bestDistance) {
        bestDistance = nearestDistance;
        bestHue = hue;
      }
    }

    return this.hslToHex(bestHue, 72, 52);
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private toMercatorMeters(vertex: AreaRegionVertex): { x: number; y: number } {
    const earthRadius = 6378137;
    const maxLat = 85.05112878;
    const lat = Math.max(Math.min(vertex.lat, maxLat), -maxLat);
    const x = earthRadius * this.toRadians(vertex.lng);
    const y =
      earthRadius * Math.log(Math.tan(Math.PI / 4 + this.toRadians(lat) / 2));
    return { x, y };
  }

  private calculateAreaSquareMeters(vertices: AreaRegionVertex[]): number {
    if (vertices.length < 3) return 0;

    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
      const curr = this.toMercatorMeters(vertices[i]);
      const next = this.toMercatorMeters(vertices[(i + 1) % vertices.length]);
      sum += curr.x * next.y - next.x * curr.y;
    }
    return Math.abs(sum) / 2;
  }

  private formatAreaKm2(vertices: AreaRegionVertex[]): string {
    const km2 = this.calculateAreaSquareMeters(vertices) / 1000000;
    if (km2 >= 100) return `${km2.toFixed(1)} km²`;
    if (km2 >= 10) return `${km2.toFixed(2)} km²`;
    return `${km2.toFixed(3)} km²`;
  }

  private normalizeLngNear(lng: number, baseLng: number): number {
    let out = lng;
    while (out - baseLng > 180) out -= 360;
    while (out - baseLng < -180) out += 360;
    return out;
  }

  private calculatePixelArea(vertices: AreaRegionVertex[]): number {
    const n = vertices.length;
    if (n < 3) return 0;

    let prevLng = vertices[n - 1].lng;
    let prev = latLonToPixels(vertices[n - 1].lat, prevLng);
    if (!Number.isFinite(prev[0]) || !Number.isFinite(prev[1])) return 0;

    let sum = 0;

    for (let i = 0; i < n; i++) {
      const v = vertices[i];
      const lng = this.normalizeLngNear(v.lng, prevLng);
      const curr = latLonToPixels(v.lat, lng);
      if (!Number.isFinite(curr[0]) || !Number.isFinite(curr[1])) return 0;

      sum += prev[0] * curr[1] - curr[0] * prev[1];
      prev = curr;
      prevLng = lng;
    }

    return Math.abs(sum) * 0.5;
  }

  private formatPixelArea(pixelArea: number): string {
    const rounded = Math.round(pixelArea);
    return `${rounded.toLocaleString()} px²`;
  }

  private createAreaRegionId(): string {
    return `area_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private createAreaRegionGroupId(): string {
    return `area_group_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private createDefaultAreaName(index: number): string {
    return `${t`${"map_filter_area_default_name"}`} ${index}`;
  }

  private createDefaultAreaGroupName(index: number): string {
    return `Area Group ${index}`;
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

  private toGeoJsonLinearRing(
    vertices: AreaRegionVertex[],
  ): [number, number][] {
    const ring = vertices.map(
      (vertex) => [vertex.lng, vertex.lat] as [number, number],
    );
    if (ring.length < 3) return ring;

    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([first[0], first[1]]);
    }

    return ring;
  }

  private createAreaGeoJson(
    regions: AreaRegion[],
    groups: AreaRegionGroup[] = [],
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      type: "FeatureCollection",
      features: regions.map((region) => ({
        type: "Feature",
        properties: {
          id: region.id,
          name: region.name,
          color: region.color,
          visible: region.visible,
          createdAt: region.createdAt,
          updatedAt: region.updatedAt,
        },
        geometry: {
          type: "Polygon",
          coordinates: [this.toGeoJsonLinearRing(region.vertices)],
        },
      })),
    };

    if (groups.length > 0) {
      payload.mrWplaceAreaGroups = groups.map((group) => ({
        id: group.id,
        name: group.name,
        regionIds: [...group.regionIds],
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
      }));
    }

    return payload;
  }

  private parseGeoJsonVertices(geometry: unknown): AreaRegionVertex[] {
    if (!geometry || typeof geometry !== "object") return [];
    const candidate = geometry as Record<string, unknown>;
    const type = candidate.type;
    const coordinates = candidate.coordinates;

    let ring: unknown[] | null = null;
    if (
      type === "Polygon" &&
      Array.isArray(coordinates) &&
      Array.isArray(coordinates[0])
    ) {
      ring = coordinates[0] as unknown[];
    }

    if (
      type === "MultiPolygon" &&
      Array.isArray(coordinates) &&
      Array.isArray(coordinates[0]) &&
      Array.isArray((coordinates[0] as unknown[])[0])
    ) {
      ring = (coordinates[0] as unknown[])[0] as unknown[];
    }

    if (!ring) return [];

    const vertices: AreaRegionVertex[] = [];
    for (const pointRaw of ring) {
      if (!Array.isArray(pointRaw) || pointRaw.length < 2) continue;
      const [lng, lat] = pointRaw;
      if (
        typeof lng === "number" &&
        Number.isFinite(lng) &&
        typeof lat === "number" &&
        Number.isFinite(lat)
      ) {
        vertices.push({ lng, lat });
      }
    }

    if (vertices.length >= 4) {
      const first = vertices[0];
      const last = vertices[vertices.length - 1];
      if (first.lng === last.lng && first.lat === last.lat) {
        vertices.pop();
      }
    }

    return vertices;
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
        const vertices = this.parseGeoJsonVertices(rawFeature.geometry);
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
    const importedRegions = importedData.regions;
    const importedGroups = importedData.groups;

    if (this.areaEditMode) {
      await this.stopAreaEditing(true);
    }

    if (mode === "replace") {
      this.areaRegions = importedRegions;
      this.areaRegionGroups = importedGroups;
    } else {
      const merged = new Map<string, AreaRegion>();
      for (const region of this.areaRegions) {
        merged.set(region.id, region);
      }
      for (const region of importedRegions) {
        merged.set(region.id, region);
      }
      this.areaRegions = Array.from(merged.values());

      const mergedGroups = new Map<string, AreaRegionGroup>();
      for (const group of this.areaRegionGroups) {
        mergedGroups.set(group.id, group);
      }
      for (const group of importedGroups) {
        mergedGroups.set(group.id, group);
      }
      this.areaRegionGroups = Array.from(mergedGroups.values());
    }

    this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);
    const groupsChanged = this.cleanupAreaRegionGroups();
    await this.persistAreaRegions();
    if (groupsChanged || mode === "replace" || importedGroups.length > 0) {
      await this.persistAreaRegionGroups();
    }
    this.notifyAreaRegions();
    this.renderAreaManager();
  }

  private async importAreaRegionsFromText(
    text: string,
    mode: "merge" | "replace",
  ): Promise<number> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(t`${"invalid_file_format"}`);
    }

    const importedData = this.normalizeImportedAreaData(parsed);
    if (importedData.regions.length === 0) {
      throw new Error(t`${"map_filter_area_no_importable_regions"}`);
    }

    await this.applyImportedAreaData(importedData, mode);
    return importedData.regions.length;
  }

  private async importAreaRegionsFromUrl(
    url: string,
    mode: "merge" | "replace",
  ): Promise<number> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    return this.importAreaRegionsFromText(text, mode);
  }

  private downloadAreaRegions(regions: AreaRegion[]): void {
    if (regions.length === 0) {
      alert(t`${"map_filter_area_no_export_regions"}`);
      return;
    }

    const selectedIds = new Set(regions.map((region) => region.id));
    const groups = this.areaRegionGroups
      .filter((group) => group.regionIds.every((id) => selectedIds.has(id)))
      .map((group) => ({
        ...group,
        regionIds: [...group.regionIds],
      }));
    const payload = this.createAreaGeoJson(regions, groups);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = new Date()
      .toISOString()
      .replace(/[:]/g, "-")
      .replace(/\..+$/, "");

    anchor.href = url;
    anchor.download = `mr-wplace-areas-${timestamp}.geojson`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private async showAreaImportExportDialog(): Promise<void> {
    const saved = await storage.get([AREA_SYNC_URL_KEY]);
    const savedSyncUrl =
      typeof saved[AREA_SYNC_URL_KEY] === "string"
        ? saved[AREA_SYNC_URL_KEY]
        : "";

    const modal = document.createElement("dialog");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 34rem; display: flex; flex-direction: column; gap: 0.6rem;">
        <h3 class="font-bold text-lg mb-4">${t`${"import_export"}`}</h3>

        <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"online_sync"}`}</h4>
          <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_online_sync_description"}`}</p>
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <input id="area-sync-url-input" type="text" placeholder="https://example.com/areas.geojson"
              class="input input-sm input-bordered" style="flex: 1; font-size: 0.75rem;" />
            <button id="area-sync-url-open-btn" class="btn btn-sm btn-ghost btn-square" title="${t`${"open_url"}`}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/>
              </svg>
            </button>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="area-sync-merge-btn" class="btn btn-primary btn-sm" style="flex: 1;">
              ${t`${"sync_merge"}`}
            </button>
            <button id="area-sync-replace-btn" class="btn btn-outline btn-sm" style="flex: 1;">
              ${t`${"sync_replace"}`}
            </button>
          </div>
        </div>

        <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"import"}`}</h4>
          <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_import_description"}`}</p>
          <button id="area-dialog-import-btn" class="btn btn-primary btn-sm w-full">${t`${"map_filter_area_import_file"}`}</button>
          <input id="area-dialog-import-file" type="file" accept=".geojson,.json,application/geo+json,application/json" style="display: none;" />
        </div>

        <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"export"}`}</h4>
          <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_export_all_description"}`}</p>
          <button id="area-dialog-export-all-btn" class="btn btn-primary btn-sm w-full">${t`${"export_all"}`} (${this.areaRegions.length})</button>
        </div>

        <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
          <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"map_filter_area_export_selected"}`}</h4>
          <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_export_selected_description"}`}</p>
          <div id="area-dialog-export-list" style="max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; margin-bottom: 0.75rem;"></div>
          <button id="area-dialog-export-selected-btn" class="btn btn-primary btn-sm w-full" disabled>${t`${"map_filter_area_export_selected_button"}`}</button>
        </div>

        <div class="modal-action">
          <button id="area-dialog-close-btn" class="btn btn-outline btn-sm">${t`${"close"}`}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;

    document.body.appendChild(modal);
    modal.showModal();

    const syncUrlInput = modal.querySelector(
      "#area-sync-url-input",
    ) as HTMLInputElement | null;
    const importFileInput = modal.querySelector(
      "#area-dialog-import-file",
    ) as HTMLInputElement | null;
    const exportSelectedButton = modal.querySelector(
      "#area-dialog-export-selected-btn",
    ) as HTMLButtonElement | null;
    const exportList = modal.querySelector("#area-dialog-export-list");

    if (syncUrlInput) {
      syncUrlInput.value = savedSyncUrl;
    }

    if (exportList) {
      if (this.areaRegions.length === 0) {
        const empty = document.createElement("p");
        empty.style.cssText =
          "text-align: center; color: oklch(var(--bc) / 0.4); padding: 1rem;";
        empty.textContent = t`${"map_filter_area_no_regions_available"}`;
        exportList.appendChild(empty);
      } else {
        for (const region of this.areaRegions) {
          const row = document.createElement("label");
          row.className =
            "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200";
          row.style.marginBottom = "0.25rem";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.className = "checkbox checkbox-sm area-region-checkbox";
          checkbox.dataset.regionId = region.id;

          const swatch = document.createElement("div");
          swatch.style.cssText = `
            width: 20px;
            height: 20px;
            border-radius: 4px;
            background: ${region.color};
            flex-shrink: 0;
          `;

          const name = document.createElement("span");
          name.style.flex = "1";
          name.textContent = region.name;

          const count = document.createElement("span");
          count.style.cssText =
            "font-size: 0.75rem; color: oklch(var(--bc) / 0.6);";
          count.textContent = `(${region.vertices.length} ${t`${"map_filter_area_points"}`})`;

          row.appendChild(checkbox);
          row.appendChild(swatch);
          row.appendChild(name);
          row.appendChild(count);
          exportList.appendChild(row);
        }
      }
    }

    const updateExportSelectedButton = () => {
      const selectedCount = modal.querySelectorAll(
        ".area-region-checkbox:checked",
      ).length;
      if (exportSelectedButton) {
        exportSelectedButton.disabled = selectedCount === 0;
      }
    };

    modal.querySelectorAll(".area-region-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", updateExportSelectedButton);
    });

    syncUrlInput?.addEventListener("blur", async () => {
      const url = syncUrlInput.value.trim();
      await storage.set({ [AREA_SYNC_URL_KEY]: url });
    });

    modal
      .querySelector("#area-sync-url-open-btn")
      ?.addEventListener("click", () => {
        const url = syncUrlInput?.value.trim();
        if (!url) return;
        window.open(url, "_blank");
      });

    modal
      .querySelector("#area-sync-merge-btn")
      ?.addEventListener("click", async () => {
        const url = syncUrlInput?.value.trim();
        if (!url) {
          alert(t`${"please_enter_sync_url"}`);
          return;
        }

        try {
          await storage.set({ [AREA_SYNC_URL_KEY]: url });
          await this.importAreaRegionsFromUrl(url, "merge");
          modal.close();
        } catch (error) {
          console.error("🧑‍🎨 : Area sync merge failed", error);
          alert(`${t`${"sync_failed"}`}: ${(error as Error).message}`);
        }
      });

    modal
      .querySelector("#area-sync-replace-btn")
      ?.addEventListener("click", async () => {
        const url = syncUrlInput?.value.trim();
        if (!url) {
          alert(t`${"please_enter_sync_url"}`);
          return;
        }

        const confirmed = confirm(t`${"map_filter_area_sync_replace_confirm"}`);
        if (!confirmed) return;

        try {
          await storage.set({ [AREA_SYNC_URL_KEY]: url });
          await this.importAreaRegionsFromUrl(url, "replace");
          modal.close();
        } catch (error) {
          console.error("🧑‍🎨 : Area sync replace failed", error);
          alert(`${t`${"sync_failed"}`}: ${(error as Error).message}`);
        }
      });

    modal
      .querySelector("#area-dialog-import-btn")
      ?.addEventListener("click", () => {
        importFileInput?.click();
      });

    importFileInput?.addEventListener("change", async () => {
      const file = importFileInput.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        await this.importAreaRegionsFromText(text, "merge");
        modal.close();
      } catch (error) {
        console.error("🧑‍🎨 : Area import failed", error);
        alert(`${t`${"sync_failed"}`}: ${(error as Error).message}`);
      } finally {
        importFileInput.value = "";
      }
    });

    modal
      .querySelector("#area-dialog-export-all-btn")
      ?.addEventListener("click", () => {
        this.downloadAreaRegions(this.areaRegions);
        modal.close();
      });

    exportSelectedButton?.addEventListener("click", () => {
      const selectedIds = new Set<string>();
      modal
        .querySelectorAll(".area-region-checkbox:checked")
        .forEach((checkbox) => {
          const input = checkbox as HTMLInputElement;
          if (input.dataset.regionId) selectedIds.add(input.dataset.regionId);
        });

      const selectedRegions = this.areaRegions.filter((region) =>
        selectedIds.has(region.id),
      );
      this.downloadAreaRegions(selectedRegions);
      modal.close();
    });

    modal
      .querySelector("#area-dialog-close-btn")
      ?.addEventListener("click", () => {
        modal.close();
      });

    modal.addEventListener("close", () => {
      modal.remove();
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
    if (candidates.length < 2) {
      alert("合体可能なエリアが不足しています");
      return;
    }

    const modal = document.createElement("dialog");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 32rem; display: flex; flex-direction: column; gap: 0.7rem;">
        <h3 class="font-bold text-lg">エリア合体</h3>
        <input id="area-group-name-input" class="input input-sm input-bordered" placeholder="グループ名 (任意)" />
        <div id="area-group-candidates" style="max-height: 260px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;"></div>
        <div class="modal-action" style="margin-top: 0.25rem;">
          <button id="area-group-create-btn" class="btn btn-primary btn-sm" disabled>合体する</button>
          <button id="area-group-cancel-btn" class="btn btn-outline btn-sm">${t`${"cancel"}`}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;

    const list = modal.querySelector("#area-group-candidates");
    const createBtn = modal.querySelector(
      "#area-group-create-btn",
    ) as HTMLButtonElement | null;
    const nameInput = modal.querySelector(
      "#area-group-name-input",
    ) as HTMLInputElement | null;

    if (list) {
      for (const region of candidates) {
        const row = document.createElement("label");
        row.className =
          "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "checkbox checkbox-sm area-group-candidate";
        checkbox.dataset.regionId = region.id;

        const swatch = document.createElement("div");
        swatch.style.cssText = `
          width: 18px;
          height: 18px;
          border-radius: 4px;
          background: ${region.color};
          flex-shrink: 0;
        `;

        const text = document.createElement("span");
        text.style.flex = "1";
        text.textContent = region.name;

        row.appendChild(checkbox);
        row.appendChild(swatch);
        row.appendChild(text);
        list.appendChild(row);
      }
    }

    const updateCreateButton = () => {
      const selected = modal.querySelectorAll(".area-group-candidate:checked").length;
      if (createBtn) createBtn.disabled = selected < 2;
    };

    modal.querySelectorAll(".area-group-candidate").forEach((element) => {
      element.addEventListener("change", updateCreateButton);
    });

    createBtn?.addEventListener("click", async () => {
      const selectedIds: string[] = [];
      modal.querySelectorAll(".area-group-candidate:checked").forEach((element) => {
        const input = element as HTMLInputElement;
        const id = input.dataset.regionId;
        if (id) selectedIds.push(id);
      });

      const uniqueIds = Array.from(new Set(selectedIds));
      if (uniqueIds.length < 2) return;

      const selectedRegions = this.areaRegions.filter((region) =>
        uniqueIds.includes(region.id),
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
      const unifiedName = nameInput?.value.trim() || primaryRegion.name;
      const unifiedColor = primaryRegion.color;

      for (const region of selectedRegions) {
        region.name = unifiedName;
        region.color = unifiedColor;
        region.updatedAt = now;
      }

      const group: AreaRegionGroup = {
        id: this.createAreaRegionGroupId(),
        name: unifiedName || this.createDefaultAreaGroupName(this.areaRegionGroups.length + 1),
        regionIds: uniqueIds,
        createdAt: now,
        updatedAt: now,
      };

      this.areaRegions.sort((a, b) => b.updatedAt - a.updatedAt);
      this.areaRegionGroups.unshift(group);
      await this.persistAreaRegions();
      await this.persistAreaRegionGroups();
      this.notifyAreaRegions();
      this.renderAreaManager();
      modal.close();

      console.log("🧑‍🎨 : Area group created:", group.id, group.regionIds.length);
    });

    modal.querySelector("#area-group-cancel-btn")?.addEventListener("click", () => {
      modal.close();
    });

    modal.addEventListener("close", () => {
      modal.remove();
    });

    document.body.appendChild(modal);
    modal.showModal();
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
        const totalAreaM2 = members.reduce(
          (sum, region) => sum + this.calculateAreaSquareMeters(region.vertices),
          0,
        );
        const totalPx = members.reduce(
          (sum, region) => sum + this.calculatePixelArea(region.vertices),
          0,
        );
        const totalKm2 = totalAreaM2 / 1000000;
        const km2Text =
          totalKm2 >= 100
            ? `${totalKm2.toFixed(1)} km²`
            : totalKm2 >= 10
              ? `${totalKm2.toFixed(2)} km²`
              : `${totalKm2.toFixed(3)} km²`;
        area.innerHTML = `${km2Text} <span style="opacity: 0.7; font-size: 0.9em;">(${this.formatPixelArea(totalPx)})</span>`;

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
          card.style.borderColor = this.normalizeAreaColor(
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
        gotoButton.title = t`${"map_filter_area_goto"}`;
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
        const areaKm2 = this.formatAreaKm2(region.vertices);
        const pixelArea = this.formatPixelArea(this.calculatePixelArea(region.vertices));
        area.innerHTML = `${areaKm2} <span style="opacity: 0.7; font-size: 0.9em;">(${pixelArea})</span>`;

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "w-7 h-7 cursor-pointer";
        colorInput.value = region.color;
        colorInput.title = t`${"map_filter_area_color"}`;
        colorInput.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          card.style.borderColor = this.normalizeAreaColor(
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
        gotoButton.title = t`${"map_filter_area_goto"}`;
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

    const actionRow = document.createElement("div");
    actionRow.className = "flex items-center gap-2 mt-1 flex-wrap";
    actionRow.appendChild(addButton);
    actionRow.appendChild(importExportButton);
    actionRow.appendChild(composeGroupButton);

    root.appendChild(list);
    root.appendChild(actionRow);

    container.appendChild(root);
  }

  private gotoAreaRegion(regionId: string) {
    const target = this.areaRegions.find((region) => region.id === regionId);
    if (!target || target.vertices.length === 0) return;

    const centerLng =
      target.vertices.reduce((sum, v) => sum + v.lng, 0) /
      target.vertices.length;
    const centerLat =
      target.vertices.reduce((sum, v) => sum + v.lat, 0) /
      target.vertices.length;

    window.postMessage(
      {
        source: "mr-wplace-area-region-goto",
        regionId,
        lng: centerLng,
        lat: centerLat,
      },
      "*",
    );

    console.log("🧑‍🎨 : Goto area region:", regionId);
  }

  private gotoAreaRegionGroup(groupId: string) {
    const group = this.areaRegionGroups.find((item) => item.id === groupId);
    if (!group) return;

    const vertices = this.getGroupVertices(group);
    if (vertices.length === 0) return;

    const centerLng =
      vertices.reduce((sum, v) => sum + v.lng, 0) / vertices.length;
    const centerLat =
      vertices.reduce((sum, v) => sum + v.lat, 0) / vertices.length;

    window.postMessage(
      {
        source: "mr-wplace-area-region-goto",
        regionId: groupId,
        lng: centerLng,
        lat: centerLat,
      },
      "*",
    );

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

    const color = this.normalizeAreaColor(nextColor);
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

    const color = this.normalizeAreaColor(nextColor);
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

    window.postMessage(
      {
        source: "mr-wplace-area-region-edit-start",
        regionId: this.editingRegionId,
        name: this.editingRegionName,
        color:
          editingRegion?.color ??
          this.createDistinctAreaColor(this.areaRegions),
        vertices: editingRegion?.vertices ?? [],
        saveLabel: t`${"map_filter_area_save_map"}`,
        cancelLabel: t`${"cancel"}`,
      },
      "*",
    );

    console.log("🧑‍🎨 : Area edit requested:", this.editingRegionId ?? "new");
  }

  private async stopAreaEditing(skipRender = false) {
    if (!this.areaEditMode) return;

    this.areaEditMode = false;
    this.editingRegionId = null;
    this.editingRegionName = "";

    window.postMessage({ source: "mr-wplace-area-region-edit-stop" }, "*");

    if (!skipRender) this.renderAreaManager();

    console.log("🧑‍🎨 : Area edit stopped");
  }

  private generateAreaEditRequestId(): string {
    return `area_edit_${Date.now()}_${++this.areaRequestCounter}`;
  }

  private async requestAreaEditSnapshot(): Promise<AreaRegionEditSnapshot | null> {
    const requestId = this.generateAreaEditRequestId();

    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout>;

      const cleanup = () => {
        window.removeEventListener("message", handler);
        clearTimeout(timeoutId);
      };

      const handler = (event: MessageEvent) => {
        if (
          event.data.source !== "mr-wplace-area-region-edit-response" ||
          event.data.requestId !== requestId
        ) {
          return;
        }

        cleanup();

        const result = event.data.result as AreaRegionEditSnapshot | null;
        if (!result || typeof result !== "object") {
          resolve(null);
          return;
        }

        const vertices = this.normalizeAreaVertices(result.vertices);
        if (vertices.length < 3) {
          resolve(null);
          return;
        }

        resolve({
          regionId:
            typeof result.regionId === "string" ? result.regionId : null,
          name: typeof result.name === "string" ? result.name : "",
          vertices,
        });
      };

      window.addEventListener("message", handler);

      window.postMessage(
        {
          source: "mr-wplace-area-region-edit-request",
          requestId,
        },
        "*",
      );

      timeoutId = setTimeout(() => {
        cleanup();
        console.warn("🧑‍🎨 : Area edit request timed out");
        resolve(null);
      }, 5000);
    });
  }

  private async saveAreaEditing() {
    if (!this.areaEditMode) return;

    const snapshot = await this.requestAreaEditSnapshot();
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
      this.createDefaultAreaName(this.areaRegions.length + 1);
    const newRegion: AreaRegion = {
      id: this.createAreaRegionId(),
      name,
      color: this.createDistinctAreaColor(this.areaRegions),
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
    window.postMessage(
      {
        source: "mr-wplace-area-measure-update",
        visible: enabled,
      },
      "*",
    );
  },
  getAreaMeasureEnabled: () => {
    return areaManagerInstance?.isAreaMeasureEnabled();
  },
};
