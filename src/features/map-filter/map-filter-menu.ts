import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import { findMyLocationContainer } from "@/constants/selectors";
import { storage } from "@/utils/browser-api";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import { t } from "@/i18n/manager";
import { areaManagerAPI } from "@/features/area-manager";
import { showFeatureHint } from "@/features/feature-hints";
import {
  IMG_ICON_DATA_SAVER_OFF,
  IMG_ICON_DATA_SAVER_ON,
  IMG_ICON_MAP,
} from "@/assets/iconImages";
import { dataSaverAPI } from "@/features/data-saver";

const HIGH_CONTRAST_KEY = "mapFilter_highContrast";
const HIGH_CONTRAST_STYLE_ID = "mr-wplace-high-contrast-style";
const BACKGROUND_COLOR_ENABLED_KEY = "mapFilter_backgroundColorEnabled";
const BACKGROUND_COLOR_VALUE_KEY = "mapFilter_backgroundColorValue";
const GRID_DISPLAY_KEY = "mapFilter_gridDisplay";
const AREA_MEASURE_KEY = "mapFilter_areaMeasure";
const GRID_DISPLAY_TEMPORARILY_DISABLED = false;
const AREA_MEASURE_TEMPORARILY_DISABLED = true;

type FilterState = {
  darkTheme: "custom-winter" | "dark";
  highContrast: boolean;
  tileBoundaries: boolean;
  gridDisplay: boolean;
  backgroundColorEnabled: boolean;
  backgroundColorValue: string;
  map3d: boolean;
  map3dDragRotate: boolean;
  scaleDisplay: boolean;
  areaMeasure: boolean;
};

type FilterId =
  | "darkTheme"
  | "highContrast"
  | "tileBoundaries"
  | "gridDisplay"
  | "backgroundColor"
  | "map3d"
  | "map3dDragRotate"
  | "scaleDisplay";

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
  {
    id: "scaleDisplay",
    label: () => t`${"map_filter_scaleDisplay"}`,
    iconOn: "📏",
    iconOff: "📏",
    requiresMap: true,
  },
];

class MapFilterMenu {
  private triggerButton: HTMLButtonElement | null = null;
  private popover: HTMLDivElement | null = null;
  private isOpen = false;
  private mapReady = false;
  private state: FilterState = {
    darkTheme: "custom-winter",
    highContrast: false,
    tileBoundaries: false,
    gridDisplay: false,
    backgroundColorEnabled: false,
    backgroundColorValue: "#000000",
    map3d: false,
    map3dDragRotate: false,
    scaleDisplay: false,
    areaMeasure: false,
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
      AREA_MEASURE_KEY,
    ]);

    this.state.highContrast = stored[HIGH_CONTRAST_KEY] ?? false;
    this.state.gridDisplay = GRID_DISPLAY_TEMPORARILY_DISABLED
      ? false
      : (stored[GRID_DISPLAY_KEY] ?? false);
    this.state.backgroundColorEnabled =
      stored[BACKGROUND_COLOR_ENABLED_KEY] ?? false;
    this.state.backgroundColorValue =
      stored[BACKGROUND_COLOR_VALUE_KEY] ?? "#000000";
    this.state.areaMeasure = stored[AREA_MEASURE_KEY] ?? false;

    this.applyDarkTheme(this.state.darkTheme);
    if (this.state.highContrast) this.applyHighContrastStyle();

    this.observeTriggerButton();
    this.createPopover();

    this.mapReady = getMapInstanceReady();
    if (this.mapReady) this.syncMapDependentState();

    window.addEventListener("message", (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-map-instance-captured" &&
        event.data.ready
      ) {
        this.mapReady = true;
        this.syncMapDependentState();
        return;
      }

      if (event.data.source === "mr-wplace-area-measure-update") {
        this.state.areaMeasure = event.data.visible === true;
        if (this.isOpen) this.updatePopoverItems();
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

    window.addEventListener("resize", () => {
      if (this.isOpen) this.updatePopoverPosition();
    });

    console.log("🧑‍🎨 : Map filter menu initialized");
  }

  private syncMapDependentState() {
    this.updatePopoverItems();
    this.notifyTileBoundaries();
    this.notifyGridDisplay();
    this.notifyScaleDisplay();

    if (this.state.backgroundColorEnabled) {
      this.applyBackgroundColor(this.state.backgroundColorValue);
    }
  }

  private observeTriggerButton() {
    const buttonConfigs: ElementConfig[] = [
      {
        id: "map-filter-trigger-btn",
        getTargetElement: findMyLocationContainer,
        createElement: (container) => this.createTriggerButton(container),
      },
    ];
    setupElementObserver(buttonConfigs);
  }

  private createTriggerButton(container: Element) {
    this.triggerButton = document.createElement("button");
    this.triggerButton.id = "map-filter-trigger-btn";
    this.triggerButton.className = "btn btn-lg sm:btn-xl btn-square shadow-md z-30";
    this.triggerButton.innerHTML = `<img src="${IMG_ICON_MAP}" style="width: calc(var(--spacing)*9); height: calc(var(--spacing)*9); image-rendering: pixelated;" />`;
    this.triggerButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePopover();
    });
    container.className += " flex flex-col-reverse gap-1";
    container.appendChild(this.triggerButton);
    showFeatureHint("map-filter-trigger", this.triggerButton);
  }

  private createPopover() {
    this.popover = document.createElement("div");
    this.popover.className = "card bg-base-100 shadow-xl";
    this.popover.style.cssText = `
      position: fixed;
      z-index: 801;
      display: none;
      min-width: 200px;
    `;
    this.popover.innerHTML = `<div class="card-body p-4"></div>`;
    this.updatePopoverItems();
    document.body.appendChild(this.popover);
  }

  private updatePopoverPosition() {
    if (!this.popover || !this.triggerButton) return;

    const margin = 8;
    const triggerRect = this.triggerButton.getBoundingClientRect();
    const popoverRect = this.popover.getBoundingClientRect();

    let left = triggerRect.right - popoverRect.width;
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - popoverRect.width - margin),
    );

    let top = triggerRect.top - popoverRect.height - margin;
    if (top < margin) {
      top = triggerRect.bottom + margin;
    }
    if (top + popoverRect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - popoverRect.height - margin);
    }

    this.popover.style.left = `${Math.round(left)}px`;
    this.popover.style.top = `${Math.round(top)}px`;
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
      const forceDisabled =
        config.id === "gridDisplay" && GRID_DISPLAY_TEMPORARILY_DISABLED;
      const disabled = forceDisabled || (config.requiresMap && !this.mapReady);

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
      toggle.checked = forceDisabled ? false : isEnabled;
      toggle.disabled = disabled;
      if (!forceDisabled) {
        toggle.addEventListener("change", () => this.toggleFilter(config.id));
      }

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

    const dataSaverWrapper = document.createElement("div");
    dataSaverWrapper.id = "data-saver-btn";
    dataSaverWrapper.className = "flex items-center justify-between";

    const dataSaverTextContainer = document.createElement("span");
    dataSaverTextContainer.className = "flex items-center gap-2";

    const dataSaverIcon = document.createElement("img");
    dataSaverIcon.src = dataSaverAPI.getEnabled()
      ? IMG_ICON_DATA_SAVER_ON
      : IMG_ICON_DATA_SAVER_OFF;
    dataSaverIcon.alt = t`${"data_saver"}`;
    dataSaverIcon.style.cssText = `
      width: 20px;
      height: 20px;
      image-rendering: pixelated;
      flex-shrink: 0;
    `;

    const dataSaverLabel = document.createElement("span");
    dataSaverLabel.textContent = t`${"data_saver"}`;

    dataSaverTextContainer.appendChild(dataSaverIcon);
    dataSaverTextContainer.appendChild(dataSaverLabel);

    const dataSaverActions = document.createElement("div");
    dataSaverActions.className = "flex items-center gap-2";

    const dataSaverSettingsButton = document.createElement("button");
    dataSaverSettingsButton.id = "data-saver-menu-settings-btn";
    dataSaverSettingsButton.className = "btn btn-ghost btn-xs btn-circle";
    dataSaverSettingsButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
        <path fill-rule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" clip-rule="evenodd" />
      </svg>
    `;
    dataSaverSettingsButton.addEventListener("click", (e) => {
      e.stopPropagation();
      dataSaverAPI.openSettings();
    });

    const dataSaverToggle = document.createElement("input");
    dataSaverToggle.type = "checkbox";
    dataSaverToggle.className = "toggle toggle-sm";
    dataSaverToggle.checked = dataSaverAPI.getEnabled();
    dataSaverToggle.addEventListener("change", async () => {
      await dataSaverAPI.toggleDataSaver();
      this.updatePopoverItems();
    });

    dataSaverActions.appendChild(dataSaverSettingsButton);
    dataSaverActions.appendChild(dataSaverToggle);
    dataSaverWrapper.appendChild(dataSaverTextContainer);
    dataSaverWrapper.appendChild(dataSaverActions);
    itemsWrapper.appendChild(dataSaverWrapper);
    showFeatureHint("data-saver", dataSaverWrapper);

    const areaSection = document.createElement("div");
    areaSection.className =
      "flex flex-col gap-2 pt-2 mt-1 border-t border-base-300";

    const areaToggleRow = document.createElement("div");
    areaToggleRow.className = "flex items-center justify-between";

    const areaTextContainer = document.createElement("span");
    areaTextContainer.className = "flex items-center gap-2";
    if (!this.mapReady) areaTextContainer.classList.add("opacity-50");

    const areaIcon = document.createElement("span");
    areaIcon.textContent = "📍";

    const areaLabel = document.createElement("span");
    areaLabel.textContent = t`${"map_filter_areaMeasure"}`;

    areaTextContainer.appendChild(areaIcon);
    areaTextContainer.appendChild(areaLabel);

    const areaToggle = document.createElement("input");
    areaToggle.type = "checkbox";
    areaToggle.className = "toggle toggle-sm";
    areaToggle.checked = AREA_MEASURE_TEMPORARILY_DISABLED
      ? false
      : this.state.areaMeasure;
    areaToggle.disabled = AREA_MEASURE_TEMPORARILY_DISABLED || !this.mapReady;
    if (!AREA_MEASURE_TEMPORARILY_DISABLED) {
      areaToggle.addEventListener("change", () => {
        this.toggleAreaMeasure(areaToggle.checked);
      });
    }

    areaToggleRow.appendChild(areaTextContainer);
    areaToggleRow.appendChild(areaToggle);
    areaSection.appendChild(areaToggleRow);

    const openAreaManagerButton = document.createElement("button");
    openAreaManagerButton.className =
      "btn btn-xs btn-outline justify-start gap-2";
    openAreaManagerButton.disabled = !this.mapReady;
    openAreaManagerButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
        <path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 294q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 106Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Zm0-480Z"/>
      </svg>
      ${t`${"map_filter_area_manager_title"}`}
    `;
    openAreaManagerButton.addEventListener("click", () => {
      areaManagerAPI.openAreaManager();
      this.closePopover();
    });
    areaSection.appendChild(openAreaManagerButton);

    itemsWrapper.appendChild(areaSection);
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
      case "scaleDisplay": {
        this.state.scaleDisplay = !this.state.scaleDisplay;
        this.notifyScaleDisplay();
        break;
      }
    }

    this.updatePopoverItems();
    console.log("🧑‍🎨 : Filter toggled:", id);
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
      if (GRID_DISPLAY_TEMPORARILY_DISABLED) {
        this.state.gridDisplay = false;
      }
      const areaMeasure = areaManagerAPI.getAreaMeasureEnabled();
      if (typeof areaMeasure === "boolean") {
        this.state.areaMeasure = AREA_MEASURE_TEMPORARILY_DISABLED
          ? false
          : areaMeasure;
      }
      const storedTheme = localStorage.getItem("theme");
      this.state.darkTheme =
        storedTheme === "dark" || storedTheme === "custom-winter"
          ? storedTheme
          : "custom-winter";
      this.updatePopoverItems();

      this.popover.style.display = "block";
      this.updatePopoverPosition();
      this.triggerButton.style.backgroundColor = "var(--color-accent, #00d3bb)";
      this.isOpen = true;
    }
  }

  private closePopover() {
    if (this.popover && this.triggerButton) {
      this.popover.style.display = "none";
      this.triggerButton.style.backgroundColor = "";
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

  private notifyScaleDisplay() {
    window.postMessage(
      {
        source: "mr-wplace-area-display-update",
        visible: this.state.scaleDisplay,
      },
      "*",
    );
  }

  private async toggleAreaMeasure(enabled: boolean) {
    this.state.areaMeasure = enabled;
    await areaManagerAPI.setAreaMeasureEnabled(enabled);
    this.updatePopoverItems();
    console.log("🧑‍🎨 : Filter toggled:", "areaMeasure", enabled);
  }
}

export const mapFilterMenuAPI = {
  initMapFilterMenu: async () => {
    const instance = new MapFilterMenu();
    await instance.init();
  },
};
