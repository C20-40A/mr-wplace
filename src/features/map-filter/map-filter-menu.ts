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

const HIGH_CONTRAST_KEY = "mapFilter_highContrast";
const HIGH_CONTRAST_STYLE_ID = "mr-wplace-high-contrast-style";
const BACKGROUND_COLOR_ENABLED_KEY = "mapFilter_backgroundColorEnabled";
const BACKGROUND_COLOR_VALUE_KEY = "mapFilter_backgroundColorValue";
const GRID_DISPLAY_KEY = "mapFilter_gridDisplay";
const SCALE_DISPLAY_KEY = "mapFilter_scaleDisplay";
const AREA_MEASURE_KEY = "mapFilter_areaMeasure";
const AREA_REGIONS_KEY = "areaRegions_v1";
const AREA_MANAGER_MODAL_ID = "wplace-studio-area-manager-modal";
const DEFAULT_AREA_COLOR = "#0f766e";

type FilterState = {
  darkTheme: "custom-winter" | "dark";
  highContrast: boolean;
  tileBoundaries: boolean;
  gridDisplay: boolean;
  scaleDisplay: boolean;
  areaMeasure: boolean;
  backgroundColorEnabled: boolean;
  backgroundColorValue: string;
  map3d: boolean;
  map3dDragRotate: boolean;
};

type FilterId =
  | "darkTheme"
  | "highContrast"
  | "tileBoundaries"
  | "gridDisplay"
  | "backgroundColor"
  | "map3d"
  | "map3dDragRotate";

type FilterConfig = {
  id: FilterId;
  label: () => string;
  iconOn: string;
  iconOff: string;
  requiresMap: boolean;
  hasColorPicker?: boolean;
};

const filterConfig: FilterConfig[] = [
  {
    id: "darkTheme",
    label: () => t`${"map_filter_darkTheme"}`,
    iconOn: "🌙",
    iconOff: "☀️",
    requiresMap: false,
  },
  {
    id: "highContrast",
    label: () => t`${"map_filter_highContrast"}`,
    iconOn: "🔆",
    iconOff: "⚪",
    requiresMap: false,
  },
  {
    id: "tileBoundaries",
    label: () => t`${"map_filter_tileBoundaries"}`,
    iconOn: "📐",
    iconOff: "📐",
    requiresMap: true,
  },
  {
    id: "gridDisplay",
    label: () => t`${"map_filter_gridDisplay"}`,
    iconOn: "🔲",
    iconOff: "🔲",
    requiresMap: true,
  },
  {
    id: "backgroundColor",
    label: () => t`${"map_filter_backgroundColor"}`,
    iconOn: "🎨",
    iconOff: "🎨",
    requiresMap: true,
    hasColorPicker: true,
  },
  {
    id: "map3d",
    label: () => t`${"map_filter_map3d"}`,
    iconOn: "🧊",
    iconOff: "🧊",
    requiresMap: true,
  },
  {
    id: "map3dDragRotate",
    label: () => t`${"map_filter_map3d_drag_rotate"}`,
    iconOn: "🔄",
    iconOff: "🔄",
    requiresMap: true,
  },
];

class MapFilterMenu {
  private triggerButton: HTMLButtonElement | null = null;
  private scaleButton: HTMLButtonElement | null = null;
  private areaButton: HTMLButtonElement | null = null;
  private popover: HTMLDivElement | null = null;
  private isOpen = false;
  private mapReady = false;
  private areaManagerModal: ModalElements | null = null;
  private areaRegions: AreaRegion[] = [];
  private areaEditMode = false;
  private editingRegionId: string | null = null;
  private editingRegionName = "";
  private areaRequestCounter = 0;
  private state: FilterState = {
    darkTheme: "custom-winter",
    highContrast: false,
    tileBoundaries: false,
    gridDisplay: false,
    scaleDisplay: false,
    areaMeasure: false,
    backgroundColorEnabled: false,
    backgroundColorValue: "#000000",
    map3d: false,
    map3dDragRotate: false,
  };

  async init() {
    const storedTheme = localStorage.getItem("theme");
    this.state.darkTheme =
      storedTheme === "dark" || storedTheme === "custom-winter"
        ? storedTheme
        : "custom-winter";

    const stored = await storage.get([
      HIGH_CONTRAST_KEY,
      BACKGROUND_COLOR_ENABLED_KEY,
      BACKGROUND_COLOR_VALUE_KEY,
      GRID_DISPLAY_KEY,
      SCALE_DISPLAY_KEY,
      AREA_MEASURE_KEY,
      AREA_REGIONS_KEY,
    ]);

    this.state.highContrast = stored[HIGH_CONTRAST_KEY] ?? false;
    this.state.gridDisplay = stored[GRID_DISPLAY_KEY] ?? false;
    this.state.scaleDisplay = stored[SCALE_DISPLAY_KEY] ?? false;
    this.state.areaMeasure = stored[AREA_MEASURE_KEY] ?? false;
    this.state.backgroundColorEnabled =
      stored[BACKGROUND_COLOR_ENABLED_KEY] ?? false;
    this.state.backgroundColorValue =
      stored[BACKGROUND_COLOR_VALUE_KEY] ?? "#000000";
    this.areaRegions = this.normalizeAreaRegions(stored[AREA_REGIONS_KEY]);

    this.applyDarkTheme(this.state.darkTheme);
    if (this.state.highContrast) this.applyHighContrastStyle();

    this.createTriggerButton();
    this.createScaleButton();
    this.createAreaButton();
    this.createPopover();

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

    document.addEventListener("click", (e) => {
      if (
        this.isOpen &&
        this.popover &&
        this.triggerButton &&
        !this.popover.contains(e.target as Node) &&
        !this.triggerButton.contains(e.target as Node)
      ) {
        this.closePopover();
      }
    });

    console.log("🧑‍🎨 : Map filter menu initialized");
  }

  private syncMapDependentState() {
    this.updatePopoverItems();
    this.updateScaleButton();
    this.updateAreaButton();
    this.notifyTileBoundaries();
    this.notifyGridDisplay();
    this.notifyScaleDisplay();
    this.notifyAreaMeasure();
    this.notifyAreaRegions();

    if (this.state.backgroundColorEnabled) {
      this.applyBackgroundColor(this.state.backgroundColorValue);
    }
  }

  private createTriggerButton() {
    this.triggerButton = document.createElement("button");
    this.triggerButton.className = "btn btn-sm btn-circle top-2";
    this.triggerButton.style.cssText = `
      position: fixed;
      left: 47px;
      font-size: 16px;
      z-index: 800;
    `;
    this.triggerButton.innerHTML = "🗺️";
    this.triggerButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePopover();
    });
    document.body.appendChild(this.triggerButton);
  }

  private createScaleButton() {
    this.scaleButton = document.createElement("button");
    this.scaleButton.className = "btn btn-sm btn-circle";
    this.scaleButton.style.cssText = `
      position: fixed;
      left: 47px;
      top: 46px;
      font-size: 14px;
      z-index: 800;
    `;
    this.scaleButton.innerHTML = "📏";
    this.scaleButton.title = t`${"map_filter_scaleDisplay"}`;
    this.scaleButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleScaleDisplay();
    });
    this.updateScaleButton();
    document.body.appendChild(this.scaleButton);
  }

  private createAreaButton() {
    this.areaButton = document.createElement("button");
    this.areaButton.className = "btn btn-sm btn-circle";
    this.areaButton.style.cssText = `
      position: fixed;
      left: 47px;
      top: 84px;
      font-size: 14px;
      z-index: 800;
    `;
    this.areaButton.innerHTML = "📐";
    this.areaButton.title = t`${"map_filter_area_manager_title"}`;
    this.areaButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.openAreaManager();
    });
    this.updateAreaButton();
    document.body.appendChild(this.areaButton);
  }

  private updateScaleButton() {
    if (!this.scaleButton) return;

    const disabled = !this.mapReady;
    this.scaleButton.disabled = disabled;
    this.scaleButton.classList.toggle("btn-active", this.state.scaleDisplay);
    this.scaleButton.classList.toggle("opacity-50", disabled);
  }

  private updateAreaButton() {
    if (!this.areaButton) return;

    const disabled = !this.mapReady;
    this.areaButton.disabled = disabled;
    this.areaButton.classList.toggle(
      "btn-active",
      this.state.areaMeasure || this.areaEditMode,
    );
    this.areaButton.classList.toggle("opacity-50", disabled);
  }

  private createPopover() {
    this.popover = document.createElement("div");
    this.popover.className = "card bg-base-100 shadow-xl";
    this.popover.style.cssText = `
      position: fixed;
      left: 50px;
      top: 122px;
      z-index: 801;
      display: none;
      min-width: 200px;
    `;
    this.popover.innerHTML = `<div class="card-body p-4"></div>`;
    this.updatePopoverItems();
    document.body.appendChild(this.popover);
  }

  private updatePopoverItems() {
    if (!this.popover) return;
    const container = this.popover.querySelector(".card-body");
    if (!container) return;
    container.innerHTML = "";

    const itemsWrapper = document.createElement("div");
    itemsWrapper.className = "flex flex-col gap-2";

    for (const config of filterConfig) {
      if (config.id === "map3dDragRotate" && !this.state.map3d) {
        continue;
      }

      const isEnabled = this.getFilterEnabled(config.id);
      const disabled = config.requiresMap && !this.mapReady;

      const itemWrapper = document.createElement("div");
      itemWrapper.className = "flex flex-col gap-1";

      const item = document.createElement("div");
      item.className = "flex items-center justify-between";

      const textContainer = document.createElement("span");
      textContainer.className = "flex items-center gap-2";
      if (disabled) textContainer.classList.add("opacity-50");

      const icon = document.createElement("span");
      icon.textContent = isEnabled ? config.iconOn : config.iconOff;

      const labelText = document.createElement("span");
      labelText.textContent = config.label();

      textContainer.appendChild(icon);
      textContainer.appendChild(labelText);

      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "toggle toggle-sm";
      toggle.checked = isEnabled;
      toggle.disabled = disabled;
      toggle.addEventListener("change", () => this.toggleFilter(config.id));

      item.appendChild(textContainer);
      item.appendChild(toggle);
      itemWrapper.appendChild(item);

      if (config.hasColorPicker && isEnabled && !disabled) {
        const colorPickerWrapper = document.createElement("div");
        colorPickerWrapper.className = "flex items-center gap-2 pl-6";

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = this.state.backgroundColorValue;
        colorInput.className = "w-8 h-8 cursor-pointer";
        colorInput.addEventListener("input", (e) => {
          const target = e.target as HTMLInputElement;
          this.changeBackgroundColorValue(target.value);
        });

        const colorValueText = document.createElement("span");
        colorValueText.className = "text-xs";
        colorValueText.textContent = this.state.backgroundColorValue;

        colorInput.addEventListener("input", (e) => {
          const target = e.target as HTMLInputElement;
          colorValueText.textContent = target.value;
        });

        colorPickerWrapper.appendChild(colorInput);
        colorPickerWrapper.appendChild(colorValueText);
        itemWrapper.appendChild(colorPickerWrapper);
      }

      itemsWrapper.appendChild(itemWrapper);
    }

    container.appendChild(itemsWrapper);
  }

  private getFilterEnabled(id: FilterId): boolean {
    if (id === "darkTheme") return this.state.darkTheme === "dark";
    if (id === "backgroundColor") return this.state.backgroundColorEnabled;
    return this.state[id];
  }

  private async toggleFilter(id: FilterId) {
    switch (id) {
      case "darkTheme": {
        const newTheme =
          this.state.darkTheme === "custom-winter" ? "dark" : "custom-winter";
        this.state.darkTheme = newTheme;
        this.applyDarkTheme(newTheme);
        break;
      }
      case "highContrast": {
        this.state.highContrast = !this.state.highContrast;
        await storage.set({ [HIGH_CONTRAST_KEY]: this.state.highContrast });
        if (this.state.highContrast) {
          this.applyHighContrastStyle();
        } else {
          this.removeHighContrastStyle();
        }
        break;
      }
      case "tileBoundaries": {
        this.state.tileBoundaries = !this.state.tileBoundaries;
        this.notifyTileBoundaries();
        break;
      }
      case "gridDisplay": {
        this.state.gridDisplay = !this.state.gridDisplay;
        await storage.set({ [GRID_DISPLAY_KEY]: this.state.gridDisplay });
        this.notifyGridDisplay();
        break;
      }
      case "backgroundColor": {
        this.state.backgroundColorEnabled = !this.state.backgroundColorEnabled;
        await storage.set({
          [BACKGROUND_COLOR_ENABLED_KEY]: this.state.backgroundColorEnabled,
        });
        if (this.state.backgroundColorEnabled) {
          this.applyBackgroundColor(this.state.backgroundColorValue);
        } else {
          this.applyBackgroundColor(null);
        }
        break;
      }
      case "map3d": {
        this.state.map3d = !this.state.map3d;
        if (!this.state.map3d && this.state.map3dDragRotate) {
          this.state.map3dDragRotate = false;
        }
        this.notifyMap3d();
        break;
      }
      case "map3dDragRotate": {
        this.state.map3dDragRotate = !this.state.map3dDragRotate;
        this.notifyMap3dDragRotate();
        break;
      }
    }

    this.updatePopoverItems();
    console.log("🧑‍🎨 : Filter toggled:", id);
  }

  private async toggleScaleDisplay() {
    if (!this.mapReady) return;
    this.state.scaleDisplay = !this.state.scaleDisplay;
    await storage.set({ [SCALE_DISPLAY_KEY]: this.state.scaleDisplay });
    this.notifyScaleDisplay();
    this.updateScaleButton();
    console.log("🧑‍🎨 : Filter toggled:", "scaleDisplay");
  }

  private async setAreaMeasureEnabled(enabled: boolean) {
    this.state.areaMeasure = enabled;
    await storage.set({ [AREA_MEASURE_KEY]: enabled });

    if (!enabled && this.areaEditMode) {
      await this.stopAreaEditing(true);
    }

    this.notifyAreaMeasure();
    this.updateAreaButton();
    this.renderAreaManager();

    console.log("🧑‍🎨 : Filter toggled:", "areaMeasure", enabled);
  }

  private async toggleAreaMeasure() {
    await this.setAreaMeasureEnabled(!this.state.areaMeasure);
  }

  private togglePopover() {
    if (this.isOpen) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  private openPopover() {
    if (this.popover && this.triggerButton) {
      this.mapReady = getMapInstanceReady();
      const storedTheme = localStorage.getItem("theme");
      this.state.darkTheme =
        storedTheme === "dark" || storedTheme === "custom-winter"
          ? storedTheme
          : "custom-winter";
      this.updatePopoverItems();
      this.updateScaleButton();
      this.updateAreaButton();

      this.popover.style.display = "block";
      this.triggerButton.classList.add("btn-active");
      this.isOpen = true;
    }
  }

  private closePopover() {
    if (this.popover && this.triggerButton) {
      this.popover.style.display = "none";
      this.triggerButton.classList.remove("btn-active");
      this.isOpen = false;
    }
  }

  private applyDarkTheme(theme: "custom-winter" | "dark") {
    localStorage.setItem("theme", theme);
    window.postMessage({ source: "mr-wplace-theme-update", theme }, "*");
  }

  private applyHighContrastStyle() {
    this.removeHighContrastStyle();
    const style = document.createElement("style");
    style.id = HIGH_CONTRAST_STYLE_ID;
    style.innerHTML = `
      .maplibregl-canvas-container canvas,
      [id^="color-"] {
        filter: brightness(0.8) contrast(2) !important;
      }
    `;
    document.head.appendChild(style);
  }

  private removeHighContrastStyle() {
    const existing = document.getElementById(HIGH_CONTRAST_STYLE_ID);
    if (existing) existing.remove();
  }

  private notifyTileBoundaries() {
    window.postMessage(
      {
        source: "mr-wplace-tile-boundaries-update",
        visible: this.state.tileBoundaries,
      },
      "*",
    );
  }

  private notifyGridDisplay() {
    window.postMessage(
      {
        source: "mr-wplace-grid-display-update",
        visible: this.state.gridDisplay,
      },
      "*",
    );
  }

  private notifyScaleDisplay() {
    window.postMessage(
      {
        source: "mr-wplace-scale-display-update",
        visible: this.state.scaleDisplay,
      },
      "*",
    );
  }

  private notifyAreaMeasure() {
    window.postMessage(
      {
        source: "mr-wplace-area-measure-update",
        visible: this.state.areaMeasure,
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

  private notifyMap3d() {
    window.postMessage(
      {
        source: "mr-wplace-map-3d-update",
        enabled: this.state.map3d,
      },
      "*",
    );
  }

  private notifyMap3dDragRotate() {
    window.postMessage(
      {
        source: "mr-wplace-map-3d-drag-rotate-update",
        enabled: this.state.map3dDragRotate,
      },
      "*",
    );
  }

  private applyBackgroundColor(color: string | null) {
    window.postMessage(
      {
        source: "mr-wplace-background-color-update",
        color,
      },
      "*",
    );
  }

  private async changeBackgroundColorValue(color: string) {
    this.state.backgroundColorValue = color;
    await storage.set({ [BACKGROUND_COLOR_VALUE_KEY]: color });
    if (this.state.backgroundColorEnabled) {
      this.applyBackgroundColor(color);
    }
    console.log("🧑‍🎨 : Background color value changed to:", color);
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
      const color = this.normalizeAreaColor(candidate.color);
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

  private normalizeAreaColor(value: unknown): string {
    if (typeof value !== "string") return DEFAULT_AREA_COLOR;
    const normalized = value.trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(normalized)) return DEFAULT_AREA_COLOR;
    return normalized.toLowerCase();
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

  private createAreaRegionId(): string {
    return `area_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private createDefaultAreaName(index: number): string {
    return `${t`${"map_filter_area_default_name"}`} ${index}`;
  }

  private async persistAreaRegions() {
    await storage.set({ [AREA_REGIONS_KEY]: this.areaRegions });
  }

  private getEditingRegion(): AreaRegion | undefined {
    if (!this.editingRegionId) return undefined;
    return this.areaRegions.find((region) => region.id === this.editingRegionId);
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

  private openAreaManager() {
    this.ensureAreaManagerModal();
    this.renderAreaManager();

    if (!this.areaManagerModal?.modal.open) {
      this.areaManagerModal?.modal.showModal();
    }
  }

  private closeAreaManager() {
    this.areaManagerModal?.modal.close();
  }

  private renderAreaManager() {
    const container = this.areaManagerModal?.container;
    if (!container) return;

    container.innerHTML = "";

    const root = document.createElement("div");
    root.className = "flex flex-col gap-2";

    const displayRow = document.createElement("label");
    displayRow.className =
      "label cursor-pointer justify-start gap-3 py-1 pl-1 w-fit";

    const displayToggle = document.createElement("input");
    displayToggle.type = "checkbox";
    displayToggle.className = "toggle toggle-sm";
    displayToggle.checked = this.state.areaMeasure;
    displayToggle.disabled = !this.mapReady;
    displayToggle.addEventListener("change", () => {
      this.setAreaMeasureEnabled(displayToggle.checked);
    });

    const displayText = document.createElement("span");
    displayText.className = "label-text";
    displayText.textContent = t`${"map_filter_areaMeasure"}`;

    displayRow.appendChild(displayToggle);
    displayRow.appendChild(displayText);

    const list = document.createElement("div");
    list.className = "flex flex-col gap-2";

    if (this.areaRegions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "text-sm opacity-70";
      empty.textContent = t`${"map_filter_area_empty"}`;
      list.appendChild(empty);
    } else {
      for (const region of this.areaRegions) {
        const card = document.createElement("div");
        card.className = "card bg-base-200";
        card.style.cssText = `
          padding: 0.7rem 0.75rem;
          border: 2px solid ${region.color};
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

        const metaRow = document.createElement("div");
        metaRow.className = "flex items-center justify-between gap-2 pt-1";

        const area = document.createElement("span");
        area.className = "text-sm opacity-80";
        area.textContent = this.formatAreaKm2(region.vertices);

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.className = "w-7 h-7 cursor-pointer";
        colorInput.value = region.color;
        colorInput.title = t`${"map_filter_area_color"}`;
        colorInput.addEventListener("input", (event) => {
          const target = event.target as HTMLInputElement;
          this.changeAreaRegionColor(region.id, target.value);
        });

        metaRow.appendChild(area);
        metaRow.appendChild(colorInput);
        card.appendChild(metaRow);

        const actionRow = document.createElement("div");
        actionRow.className = "flex items-center gap-2 pt-2";

        const visibilityButton = document.createElement("button");
        visibilityButton.className = "btn btn-xs btn-ghost";
        visibilityButton.title = region.visible
          ? t`${"map_filter_area_hide"}`
          : t`${"map_filter_area_show"}`;
        visibilityButton.innerHTML = region.visible
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M3.53 2.47a.75.75 0 1 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-2.134-2.134A10.73 10.73 0 0 0 22.5 12s-3.75-7.5-10.5-7.5a10.8 10.8 0 0 0-4.286.897L3.53 2.47ZM12 7.5c2.485 0 4.5 2.015 4.5 4.5 0 .69-.156 1.343-.435 1.926l-5.99-5.99A4.473 4.473 0 0 1 12 7.5Z"/><path d="M5.315 8.375A13.72 13.72 0 0 0 1.5 12s3.75 7.5 10.5 7.5a10.74 10.74 0 0 0 5.394-1.456l-2.145-2.145A4.48 4.48 0 0 1 12 16.5c-2.485 0-4.5-2.015-4.5-4.5 0-.512.086-1.003.244-1.46L5.315 8.375Z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;"><path d="M12 4.5c6.75 0 10.5 7.5 10.5 7.5s-3.75 7.5-10.5 7.5S1.5 12 1.5 12 5.25 4.5 12 4.5Zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>`;
        visibilityButton.addEventListener("click", () => {
          this.toggleAreaRegionVisibility(region.id);
        });

        const editButton = document.createElement("button");
        editButton.className = "btn btn-xs btn-primary";
        editButton.textContent = t`${"edit"}`;
        editButton.disabled = !this.mapReady;
        editButton.addEventListener("click", () => {
          this.startAreaEditing(region.id, true);
        });

        actionRow.appendChild(visibilityButton);
        actionRow.appendChild(editButton);
        card.appendChild(actionRow);

        list.appendChild(card);
      }
    }

    const addButton = document.createElement("button");
    addButton.className = "btn btn-primary btn-sm mt-1";
    addButton.textContent = t`${"map_filter_area_add"}`;
    addButton.disabled = !this.mapReady;
    addButton.addEventListener("click", () => {
      this.startAreaEditing(null, true);
    });

    root.appendChild(displayRow);
    root.appendChild(list);
    root.appendChild(addButton);

    container.appendChild(root);
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

    console.log("🧑‍🎨 : Area region visibility toggled:", regionId, target.visible);
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

    this.areaRegions = this.areaRegions.filter((region) => region.id !== regionId);

    if (this.editingRegionId === regionId && this.areaEditMode) {
      await this.stopAreaEditing(true);
    }

    await this.persistAreaRegions();
    this.notifyAreaRegions();
    this.renderAreaManager();
    this.updateAreaButton();

    console.log("🧑‍🎨 : Area region deleted:", regionId);
  }

  private async startAreaEditing(regionId: string | null, closeModal = false) {
    if (!this.mapReady) return;

    const editingRegion = regionId
      ? this.areaRegions.find((region) => region.id === regionId)
      : undefined;

    if (!this.state.areaMeasure) {
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
        vertices: editingRegion?.vertices ?? [],
        saveLabel: t`${"map_filter_area_save_map"}`,
        cancelLabel: t`${"cancel"}`,
      },
      "*",
    );

    this.updateAreaButton();

    console.log("🧑‍🎨 : Area edit requested:", this.editingRegionId ?? "new");
  }

  private async stopAreaEditing(skipRender = false) {
    if (!this.areaEditMode) return;

    this.areaEditMode = false;
    this.editingRegionId = null;
    this.editingRegionName = "";

    window.postMessage({ source: "mr-wplace-area-region-edit-stop" }, "*");

    this.updateAreaButton();
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
          regionId: typeof result.regionId === "string" ? result.regionId : null,
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

    const name = nameInput.trim() || this.createDefaultAreaName(this.areaRegions.length + 1);
    const newRegion: AreaRegion = {
      id: this.createAreaRegionId(),
      name,
      color: DEFAULT_AREA_COLOR,
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

export const mapFilterMenuAPI = {
  initMapFilterMenu: async () => {
    const instance = new MapFilterMenu();
    await instance.init();
  },
};
