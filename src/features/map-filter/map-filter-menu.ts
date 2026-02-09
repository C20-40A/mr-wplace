import { storage } from "@/utils/browser-api";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import { t } from "@/i18n/manager";

const HIGH_CONTRAST_KEY = "mapFilter_highContrast";
const HIGH_CONTRAST_STYLE_ID = "mr-wplace-high-contrast-style";
const BACKGROUND_COLOR_ENABLED_KEY = "mapFilter_backgroundColorEnabled";
const BACKGROUND_COLOR_VALUE_KEY = "mapFilter_backgroundColorValue";
const GRID_DISPLAY_KEY = "mapFilter_gridDisplay";
const SCALE_DISPLAY_KEY = "mapFilter_scaleDisplay";
const AREA_MEASURE_KEY = "mapFilter_areaMeasure";

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
    ]);
    this.state.highContrast = stored[HIGH_CONTRAST_KEY] ?? false;
    this.state.gridDisplay = stored[GRID_DISPLAY_KEY] ?? false;
    this.state.scaleDisplay = stored[SCALE_DISPLAY_KEY] ?? false;
    this.state.areaMeasure = stored[AREA_MEASURE_KEY] ?? false;
    this.state.backgroundColorEnabled =
      stored[BACKGROUND_COLOR_ENABLED_KEY] ?? false;
    this.state.backgroundColorValue =
      stored[BACKGROUND_COLOR_VALUE_KEY] ?? "#000000";

    this.applyDarkTheme(this.state.darkTheme);
    if (this.state.highContrast) this.applyHighContrastStyle();

    this.createTriggerButton();
    this.createScaleButton();
    this.createAreaButton();
    this.createPopover();

    this.mapReady = getMapInstanceReady();
    window.addEventListener("message", (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-map-instance-captured" &&
        event.data.ready
      ) {
        this.mapReady = true;
        this.updatePopoverItems();
        this.updateScaleButton();
        this.updateAreaButton();
        this.notifyTileBoundaries();
        this.notifyGridDisplay();
        this.notifyScaleDisplay();
        this.notifyAreaMeasure();
        if (this.state.backgroundColorEnabled)
          this.applyBackgroundColor(this.state.backgroundColorValue);
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

  private createTriggerButton() {
    this.triggerButton = document.createElement("button");
    this.triggerButton.className = "btn btn-sm btn-circle top-2";
    this.triggerButton.style.cssText = `
      position: fixed;
      left: 47px;
      font-size: 16px;
      z-index: 800;
    `;
    this.triggerButton.innerHTML = `🗺️`;
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
    this.areaButton.title = t`${"map_filter_areaMeasure"}`;
    this.areaButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleAreaMeasure();
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
    this.areaButton.classList.toggle("btn-active", this.state.areaMeasure);
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
      // Skip map3dDragRotate if map3d is not enabled
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
      if (disabled) {
        textContainer.classList.add("opacity-50");
      }

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
        // Reset drag rotate when 3D is disabled
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

  private async toggleAreaMeasure() {
    if (!this.mapReady) return;
    this.state.areaMeasure = !this.state.areaMeasure;
    await storage.set({ [AREA_MEASURE_KEY]: this.state.areaMeasure });
    this.notifyAreaMeasure();
    this.updateAreaButton();
    console.log("🧑‍🎨 : Filter toggled:", "areaMeasure");
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
      // Re-check map ready state every time popover opens
      this.mapReady = getMapInstanceReady();
      // Re-check theme from localStorage (may have changed externally)
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
}

export const mapFilterMenuAPI = {
  initMapFilterMenu: async () => {
    const instance = new MapFilterMenu();
    await instance.init();
  },
};
