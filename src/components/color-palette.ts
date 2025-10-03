import { colorpalette } from "../constants/colors";
import { t } from "../i18n/manager";
import type { EnhancedConfig } from "../features/tile-draw/tile-draw";

interface ColorPaletteOptions {
  onChange?: (colorIds: number[]) => void;
  selectedColorIds?: number[];
  showCurrentlySelected?: boolean; // 現在選択中の色を表示するか（default: false）
  showEnhancedSelect?: boolean; // enhancedモード選択表示（default: false）
  onEnhancedModeChange?: (mode: EnhancedConfig["mode"]) => void;
  enhancedMode?: EnhancedConfig["mode"];
}

const enabledBadgeHTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #22c55e; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">✓</span>';
const disabledBadgeHTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #ef4444; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">x</span>';
const currentlySelectedIconHTML =
  '<span class="currently-selected-icon" style="position: absolute; bottom: 0.4rem; left: 0.25rem; font-size: 0.8rem; background: white; border-radius: 50%; border: solid; border-width: 1px;">⭐</span>';

/**
 * カラーパレット表示コンポーネント
 * 色をクリックで選択状態を変更（緑枠=選択、赤枠=未選択）
 */
export class ColorPalette {
  private container: HTMLElement;
  private options: ColorPaletteOptions;
  private selectedColorIds: Set<number> = new Set();
  private currentlySelectedColorId: number | null = null;
  private enhancedMode: EnhancedConfig["mode"] = "dot";

  constructor(container: HTMLElement, options: ColorPaletteOptions = {}) {
    this.container = container;
    this.options = options;
    // 初期状態で全色選択
    this.selectedColorIds = new Set(
      options.selectedColorIds ?? colorpalette.map((c) => c.id)
    );

    // 現在選択中の色を取得
    if (this.options.showCurrentlySelected) {
      const selectedColorStr = window.localStorage.getItem("selected-color");
      if (selectedColorStr) {
        this.currentlySelectedColorId = parseInt(selectedColorStr);
      }
    }

    // enhanced初期状態
    this.enhancedMode = options.enhancedMode ?? "dot";

    this.init();
  }

  private init(): void {
    this.createPaletteUI();
    this.setupEventHandlers();
  }

  private createPaletteUI(): void {
    const paletteGrid = colorpalette
      .map((color) => {
        const [r, g, b] = color.rgb;
        const backgroundColor = `rgb(${r}, ${g}, ${b})`;
        const textColor = this.getContrastTextColor(r, g, b);
        const isSelected = this.selectedColorIds.has(color.id);
        const borderColor = isSelected ? "#22c55e" : "#ef4444"; // green-500 : red-500

        const premiumIcon = color.premium
          ? '<span style="position: absolute; right: 0.25rem; top: 0.25rem; font-size: 0.75rem;">💧</span>'
          : "";
        const enabledBadge = isSelected ? enabledBadgeHTML : disabledBadgeHTML;
        const currentlySelectedIcon =
          this.options.showCurrentlySelected &&
          this.currentlySelectedColorId === color.id
            ? currentlySelectedIconHTML
            : "";

        return `
        <div class="color-item cursor-pointer p-2 text-xs font-medium flex items-center justify-center min-h-[3rem]"
             style="background-color: ${backgroundColor}; color: ${textColor}; border-color: ${borderColor}; position: relative; 
             border-radius: 0.5rem; border-style: solid; border-width: 3px;"
             data-color-id="${color.id}"
             title="${color.name} (${color.premium ? "Premium" : "Free"})">
          ${enabledBadge}
          ${color.name}
          ${premiumIcon}
          ${currentlySelectedIcon}
        </div>
      `;
      })
      .join("");

    const enhancedSelectHTML = this.options.showEnhancedSelect
      ? `<select class="enhanced-mode-select" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem;">
          <option value="dot" ${
            this.enhancedMode === "dot" ? "selected" : ""
          }>Dot</option>
          <option value="cross" ${
            this.enhancedMode === "cross" ? "selected" : ""
          }>Cross</option>
          <option value="fill" ${
            this.enhancedMode === "fill" ? "selected" : ""
          }>Fill</option>
          <option value="red-cross" ${
            this.enhancedMode === "red-cross" ? "selected" : ""
          }>Red Cross</option>
          <option value="cyan-cross" ${
            this.enhancedMode === "cyan-cross" ? "selected" : ""
          }>Cyan Cross</option>
          <option value="dark-cross" ${
            this.enhancedMode === "dark-cross" ? "selected" : ""
          }>Dark Cross</option>
          <option value="complement-cross" ${
            this.enhancedMode === "complement-cross" ? "selected" : ""
          }>Complement Cross</option>
          <option value="red-border" ${
            this.enhancedMode === "red-border" ? "selected" : ""
          }>Red Border</option>
         </select>`
      : "";

    this.container.innerHTML = `
      <div class="color-palette-controls flex gap-2 mb-4 px-4 pt-4">
        <button class="enable-all-btn btn btn-outline btn-success btn-sm rounded">${t`${"enable_all"}`}</button>
        <button class="disable-all-btn btn btn-outline btn-error btn-sm rounded">${t`${"disable_all"}`}</button>
        ${enhancedSelectHTML}
      </div>
      <div class="color-palette-grid grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 px-4 pb-4">
        ${paletteGrid}
      </div>
    `;
  }

  private setupEventHandlers(): void {
    this.container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;

      // Enable All ボタン
      if (target.classList.contains("enable-all-btn")) {
        this.enableAll();
        return;
      }

      // Disable All ボタン
      if (target.classList.contains("disable-all-btn")) {
        this.disableAll();
        return;
      }

      // 色選択
      const colorItem = target.closest(".color-item");
      if (!colorItem) return;

      const colorId = parseInt((colorItem as HTMLElement).dataset.colorId!);
      this.toggleColor(colorId);
    });

    // Enhanced Mode Select
    const select = this.container.querySelector(
      ".enhanced-mode-select"
    ) as HTMLSelectElement;
    if (select) {
      select.addEventListener("change", () => {
        this.handleEnhancedModeChange(select.value as EnhancedConfig["mode"]);
      });
    }
  }

  private toggleColor(colorId: number): void {
    if (this.selectedColorIds.has(colorId)) {
      this.selectedColorIds.delete(colorId);
    } else {
      this.selectedColorIds.add(colorId);
    }
    this.updateSelection();
    this.notifyChange();
  }

  private enableAll(): void {
    this.selectedColorIds = new Set(colorpalette.map((c) => c.id));
    this.updateSelection();
    this.notifyChange();
  }

  private disableAll(): void {
    this.selectedColorIds.clear();
    this.updateSelection();
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.options.onChange) {
      this.options.onChange(Array.from(this.selectedColorIds));
    }
  }

  private updateSelection(): void {
    const colorItems = this.container.querySelectorAll(".color-item");
    colorItems.forEach((item) => {
      const itemColorId = parseInt((item as HTMLElement).dataset.colorId!);
      const isSelected = this.selectedColorIds.has(itemColorId);
      const borderColor = isSelected ? "#22c55e" : "#ef4444";

      (item as HTMLElement).style.borderColor = borderColor;

      // バッジ更新
      const existingBadge = item.querySelector(".badge-status");
      if (existingBadge) {
        const newBadge = isSelected ? enabledBadgeHTML : disabledBadgeHTML;
        existingBadge.outerHTML = newBadge;
      }
    });
  }

  private getContrastTextColor(r: number, g: number, b: number): string {
    // RGB輝度計算（ITU-R BT.709）
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.5 ? "#000000" : "#ffffff";
  }

  getSelectedColors(): number[] {
    return Array.from(this.selectedColorIds);
  }

  setSelectedColors(colorIds: number[]): void {
    this.selectedColorIds = new Set(colorIds);
    this.updateSelection();
  }

  destroy(): void {
    this.container.innerHTML = "";
  }

  private handleEnhancedModeChange(mode: EnhancedConfig["mode"]): void {
    this.enhancedMode = mode;
    if (this.options.onEnhancedModeChange) {
      this.options.onEnhancedModeChange(mode);
    }
  }
}
