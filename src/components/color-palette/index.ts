import { colorpalette } from "../../constants/colors";
import type { EnhancedMode } from "@/types/image";
import { createEnhancedModeIcons } from "../../assets/enhanced-mode-icons";
import { t } from "../../i18n/manager";
import { isMobileViewport } from "@/constants/breakpoints";
import type { ColorPaletteOptions, SortOrder } from "./types";
import type { ComputeDevice } from "./storage";
import {
  ENABLED_BADGE_HTML,
  DISABLED_BADGE_HTML,
  getCurrentlySelectedColorId,
  getEnhancedModeLabelKey,
  SORT_ORDER_OPTIONS,
} from "./utils";
import { sortColors } from "./color-sorter";
import { buildColorGrid, buildControlsHtml } from "./ui";

/**
 * カラーパレット表示コンポーネント
 *
 * NOTE: イベントリスナー管理
 * - インスタンス生成時にboundハンドラーを作成し、setupEventHandlers()で登録
 * - destroy()で必ずremoveEventListenerを呼び、メモリリークとイベント重複を防止
 * - 部分更新（updateColorGrid等）はinnerHTML変更のみでイベントリスナーは維持
 */
export class ColorPalette {
  private container: HTMLElement;
  private options: ColorPaletteOptions;
  private selectedColorIds: Set<number>;
  private currentlySelectedColorId: number | null = null;
  private enhancedMode: EnhancedMode;
  private enhancedColor: [number, number, number];
  private showUnplacedColor: [number, number, number];
  private sortOrder: SortOrder = "default";
  private overlayMode: boolean;
  private computeDevice: ComputeDevice;
  private showUnplacedOnly: boolean;
  private selectedColorOnlyMark: boolean;
  private boundClickHandler: (e: MouseEvent) => void;
  private boundDocumentClickHandler: (e: MouseEvent) => void;
  private boundInputHandler: (e: Event) => void;
  private boundChangeHandler: (e: Event) => void;

  constructor(container: HTMLElement, options: ColorPaletteOptions = {}) {
    this.container = container;
    this.options = options;
    this.selectedColorIds = new Set(
      options.selectedColorIds ?? colorpalette.map((c) => c.id),
    );
    this.currentlySelectedColorId = options.showCurrentlySelected
      ? getCurrentlySelectedColorId()
      : null;
    this.enhancedMode = options.enhancedMode ?? "cross";
    this.enhancedColor = options.enhancedColor ?? [255, 0, 0];
    this.showUnplacedColor = options.showUnplacedColor ?? [160, 160, 160];
    this.sortOrder = options.sortOrder ?? "default";
    this.overlayMode = options.overlayMode ?? false;
    this.computeDevice = options.computeDevice ?? "gpu";
    this.showUnplacedOnly = options.showUnplacedOnly ?? false;
    this.selectedColorOnlyMark = options.selectedColorOnlyMark ?? false;

    // イベントハンドラーをbind
    this.boundClickHandler = (e: MouseEvent) => this.handleClick(e);
    this.boundDocumentClickHandler = (e: MouseEvent) =>
      this.handleDocumentClick(e);
    this.boundInputHandler = (e: Event) => this.handleInput(e);
    this.boundChangeHandler = (e: Event) => this.handleChange(e);

    this.render();
    this.setupEventHandlers();
  }

  private render(): void {
    const isXs = (this.options.controlSize ?? "default") === "xs";
    const sortedColors = sortColors(this.sortOrder, this.options.colorStats);
    const colorGridHtml = buildColorGrid(
      this.selectedColorIds,
      this.currentlySelectedColorId,
      sortedColors,
      this.options,
    );
    const controlsHtml = buildControlsHtml(
      this.options.hasExtraColorsBitmap ?? false,
      this.options.showColorStats ?? false,
      this.options.showEnhancedSelect ?? false,
      this.options.showOverlayModeSelect ?? false,
      this.options.showComputeDeviceSelect ?? false,
      this.sortOrder,
      this.enhancedMode,
      this.overlayMode,
      this.computeDevice,
      this.options.showUnplacedOnlyToggle ?? false,
      this.showUnplacedOnly,
      this.showUnplacedColor,
      this.options.showDisableUnusedButton ?? false,
      this.options.controlSize ?? "default",
      this.enhancedColor,
      this.selectedColorOnlyMark,
    );

    this.container.innerHTML = `
      ${controlsHtml}
      <div class="color-palette-grid grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2 ${isXs ? "px-2" : "px-4"} pb-4">
        ${colorGridHtml}
      </div>
    `;
  }

  private setupEventHandlers(): void {
    // イベント委譲で全イベント処理
    this.container.addEventListener("click", this.boundClickHandler);
    this.container.addEventListener("input", this.boundInputHandler);
    this.container.addEventListener("change", this.boundChangeHandler);

    // ドロップダウンを外側クリックで閉じる
    document.addEventListener("click", this.boundDocumentClickHandler);
  }

  private handleInput(e: Event): void {
    const target = e.target as HTMLElement;
    if (target.classList.contains("enhanced-color-picker")) {
      return;
    }

    if (target.classList.contains("show-unplaced-color-picker")) {
      const hex = (target as HTMLInputElement).value;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this.showUnplacedColor = [r, g, b];
      this.options.onShowUnplacedColorChange?.(this.showUnplacedColor);
    }
  }

  private handleChange(e: Event): void {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("enhanced-color-picker")) return;
    const hex = (target as HTMLInputElement).value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (
      this.enhancedColor[0] === r &&
      this.enhancedColor[1] === g &&
      this.enhancedColor[2] === b
    )
      return;
    this.updateEnhancedColorPreview(hex);
    this.options.onEnhancedColorChange?.(this.enhancedColor);
  }

  private updateEnhancedColorPreview(hex: string): void {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    this.enhancedColor = [r, g, b];

    // アイコンを更新
    const icons = createEnhancedModeIcons(hex);
    this.container.querySelectorAll(".enhanced-mode-item").forEach((item) => {
      const mode = (item as HTMLElement).dataset.mode as keyof typeof icons;
      const img = item.querySelector("img") as HTMLImageElement;
      if (img && icons[mode]) img.src = icons[mode];
    });
    const currentIcon = this.container.querySelector(
      ".enhanced-mode-current-icon",
    ) as HTMLImageElement;
    if (currentIcon && icons[this.enhancedMode])
      currentIcon.src = icons[this.enhancedMode];
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest(".sort-order-container")) {
      const dropdown = this.container.querySelector(
        ".sort-order-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
    }
    if (!(e.target as HTMLElement).closest(".enhanced-mode-container")) {
      const dropdown = this.container.querySelector(
        ".enhanced-mode-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
    }
    if (!(e.target as HTMLElement).closest(".compute-device-container")) {
      const dropdown = this.container.querySelector(
        ".compute-device-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
    }
    if (!(e.target as HTMLElement).closest(".overlay-mode-container")) {
      const dropdown = this.container.querySelector(
        ".overlay-mode-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
    }
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    if (target.classList.contains("show-unplaced-color-picker")) return;

    // コントロールボタン
    if (target.classList.contains("enable-all-btn")) {
      this.enableAll();
      return;
    }
    if (target.classList.contains("disable-all-btn")) {
      this.disableAll();
      return;
    }
    if (target.classList.contains("free-colors-btn")) {
      this.enableFreeColors();
      return;
    }
    if (target.classList.contains("owned-colors-btn")) {
      this.enableOwnedColors();
      return;
    }
    if (target.classList.contains("disable-unused-btn")) {
      this.disableUnusedColors();
      return;
    }

    // Sort Order Button
    if (
      target.closest(".sort-order-button") &&
      !target.closest(".sort-order-item")
    ) {
      e.stopPropagation();
      const dropdown = this.container.querySelector(
        ".sort-order-dropdown",
      ) as HTMLElement;
      if (dropdown) {
        const isVisible = dropdown.style.display !== "none";
        dropdown.style.display = isVisible ? "none" : "block";
      }
      return;
    }

    // Sort Order Item
    const sortOrderItem = target.closest(".sort-order-item") as HTMLElement;
    if (sortOrderItem) {
      e.stopPropagation();
      const sort = sortOrderItem.dataset.sort as SortOrder;
      this.handleSortOrderChange(sort);
      const dropdown = this.container.querySelector(
        ".sort-order-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
      return;
    }

    // Enhanced Mode Button
    if (
      target.closest(".enhanced-mode-button") &&
      !target.closest(".enhanced-mode-item")
    ) {
      e.stopPropagation();
      const dropdown = this.container.querySelector(
        ".enhanced-mode-dropdown",
      ) as HTMLElement;
      if (dropdown) {
        const isVisible = dropdown.style.display !== "none";

        if (!isVisible) {
          // レスポンシブ対応
          const isMobile = isMobileViewport();
          const grid = dropdown.querySelector(
            ".enhanced-mode-grid",
          ) as HTMLElement;
          if (isMobile) {
            dropdown.style.minWidth = "";
            grid.style.gridTemplateColumns = "repeat(2, 1fr)";
          } else {
            dropdown.style.minWidth = "320px";
            grid.style.gridTemplateColumns = "repeat(4, 1fr)";
          }
        }

        dropdown.style.display = isVisible ? "none" : "block";
      }
      return;
    }

    // Enhanced Mode Item
    const enhancedModeItem = target.closest(
      ".enhanced-mode-item",
    ) as HTMLElement;
    if (enhancedModeItem) {
      e.stopPropagation();
      const mode = enhancedModeItem.dataset.mode as EnhancedMode;
      this.handleEnhancedModeChange(mode);
      const dropdown = this.container.querySelector(
        ".enhanced-mode-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
      return;
    }

    // Compute Device Button
    if (
      target.closest(".compute-device-button") &&
      !target.closest(".compute-device-item")
    ) {
      e.stopPropagation();
      const dropdown = this.container.querySelector(
        ".compute-device-dropdown",
      ) as HTMLElement;
      if (dropdown) {
        const isVisible = dropdown.style.display !== "none";
        dropdown.style.display = isVisible ? "none" : "block";
      }
      return;
    }

    // Overlay Mode Button
    if (
      target.closest(".overlay-mode-button") &&
      !target.closest(".overlay-mode-item")
    ) {
      e.stopPropagation();
      const dropdown = this.container.querySelector(
        ".overlay-mode-dropdown",
      ) as HTMLElement;
      if (dropdown) {
        const isVisible = dropdown.style.display !== "none";
        dropdown.style.display = isVisible ? "none" : "block";
      }
      return;
    }

    // Overlay Mode Item
    const overlayModeItem = target.closest(".overlay-mode-item") as HTMLElement;
    if (overlayModeItem) {
      e.stopPropagation();
      const nextEnabled = overlayModeItem.dataset.overlayMode === "true";
      this.handleOverlayModeChange(nextEnabled);
      const dropdown = this.container.querySelector(
        ".overlay-mode-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
      return;
    }

    // Compute Device Item
    const computeDeviceItem = target.closest(
      ".compute-device-item",
    ) as HTMLElement;
    if (computeDeviceItem) {
      e.stopPropagation();
      const device = computeDeviceItem.dataset.device as ComputeDevice;
      this.handleComputeDeviceChange(device);
      const dropdown = this.container.querySelector(
        ".compute-device-dropdown",
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
      return;
    }

    // Selected Color Only Mark Toggle
    if (target.closest(".selected-color-only-mark-toggle")) {
      e.stopPropagation();
      this.handleSelectedColorOnlyMarkToggle();
      return;
    }

    // Show Unplaced Only Toggle
    if (target.closest(".show-unplaced-only-toggle")) {
      e.stopPropagation();
      this.handleShowUnplacedOnlyToggle();
      return;
    }

    // 色選択
    const colorItem = target.closest(".color-item") as HTMLElement;
    if (colorItem) {
      e.stopPropagation(); // ドロップダウン閉じるのを防止
      const colorId = parseInt(colorItem.dataset.colorId!);
      this.toggleColor(colorId);
    }
  }

  private toggleColor(colorId: number): void {
    if (this.selectedColorIds.has(colorId)) {
      this.selectedColorIds.delete(colorId);
    } else {
      this.selectedColorIds.add(colorId);
    }
    this.updateColorSelection(colorId);
    this.notifyChange();
  }

  private enableAll(): void {
    this.selectedColorIds = new Set(colorpalette.map((c) => c.id));
    this.updateAllColorSelections();
    this.notifyChange();
  }

  private disableAll(): void {
    this.selectedColorIds.clear();
    this.updateAllColorSelections();
    this.notifyChange();
  }

  private enableFreeColors(): void {
    this.selectedColorIds = new Set(
      colorpalette.filter((c) => !c.premium).map((c) => c.id),
    );
    this.updateAllColorSelections();
    this.notifyChange();
  }

  private enableOwnedColors(): void {
    const ownedIds = window.mrWplace?.colorFilterManager?.getOwnedColorIds();
    if (!ownedIds) return;

    this.selectedColorIds = new Set(ownedIds);
    this.updateAllColorSelections();
    this.notifyChange();
  }

  private disableUnusedColors(): void {
    if (!this.options.colorStats) return;

    // colorStatsに存在する色（total > 0）のみを有効化
    const usedColorIds = new Set<number>();
    for (const [colorKey, stats] of Object.entries(this.options.colorStats)) {
      if (stats.total > 0) {
        const [r, g, b] = colorKey.split(",").map(Number);
        const color = colorpalette.find(
          (c) => c.rgb[0] === r && c.rgb[1] === g && c.rgb[2] === b,
        );
        if (color) usedColorIds.add(color.id);
      }
    }

    this.selectedColorIds = usedColorIds;
    this.updateAllColorSelections();
    this.notifyChange();
  }

  private notifyChange(): void {
    if (this.options.onChange) {
      this.options.onChange(Array.from(this.selectedColorIds));
    }
  }

  private updateColorSelection(colorId: number): void {
    const colorItem = this.container.querySelector(
      `[data-color-id="${colorId}"]`,
    ) as HTMLElement;
    if (!colorItem) return;

    const isSelected = this.selectedColorIds.has(colorId);
    colorItem.style.borderColor = isSelected ? "#22c55e" : "#ef4444";

    const badge = colorItem.querySelector(".badge-status");
    if (badge) {
      badge.outerHTML = isSelected ? ENABLED_BADGE_HTML : DISABLED_BADGE_HTML;
    }
  }

  private updateAllColorSelections(): void {
    const colorItems = this.container.querySelectorAll(".color-item");
    colorItems.forEach((item) => {
      const colorId = parseInt((item as HTMLElement).dataset.colorId!);
      const isSelected = this.selectedColorIds.has(colorId);
      (item as HTMLElement).style.borderColor = isSelected
        ? "#22c55e"
        : "#ef4444";

      const badge = item.querySelector(".badge-status");
      if (badge) {
        badge.outerHTML = isSelected ? ENABLED_BADGE_HTML : DISABLED_BADGE_HTML;
      }
    });
  }

  private handleSortOrderChange(sort: SortOrder): void {
    this.sortOrder = sort;
    // this.render();
    // 1. カラーグリッドの部分更新
    this.updateColorGrid();
    // 2. コントロール表示の部分更新
    this.updateSortControlsDisplay(sort);
    // 3. 変更を通知
    if (this.options.onSortOrderChange) {
      this.options.onSortOrderChange(sort);
    }
  }

  private handleEnhancedModeChange(mode: EnhancedMode): void {
    this.enhancedMode = mode;

    const icons = createEnhancedModeIcons(
      `#${this.enhancedColor.map((c) => c.toString(16).padStart(2, "0")).join("")}`,
    );

    // 現在選択中のアイコンと名称を更新
    const currentIcon = this.container.querySelector(
      ".enhanced-mode-current-icon",
    ) as HTMLImageElement;
    if (currentIcon) {
      currentIcon.src = icons[mode];
      currentIcon.alt = mode;
    }

    const currentName = this.container.querySelector(
      ".enhanced-mode-current-name",
    );
    if (currentName) {
      currentName.textContent = t`${getEnhancedModeLabelKey(mode)}`;
    }

    // ドロップダウン内のボタン選択状態を更新
    const buttons = this.container.querySelectorAll(".enhanced-mode-item");
    buttons.forEach((button) => {
      const buttonMode = (button as HTMLElement).dataset.mode;
      const isSelected = buttonMode === mode;
      const borderColor = isSelected ? "#22c55e" : "#d1d5db";
      const borderWidth = isSelected ? "3px" : "2px";
      (button as HTMLElement).style.border =
        `${borderWidth} solid ${borderColor}`;
    });

    if (this.options.onEnhancedModeChange) {
      this.options.onEnhancedModeChange(mode);
    }
  }

  private handleComputeDeviceChange(device: ComputeDevice): void {
    this.computeDevice = device;

    // 現在選択中のデバイス名を更新
    const currentName = this.container.querySelector(
      ".compute-device-current-name",
    );
    if (currentName) {
      const deviceLabel = device === "gpu" ? "GPU" : "CPU";
      currentName.textContent = deviceLabel;
    }

    // ドロップダウン内のボタン選択状態を更新
    const buttons = this.container.querySelectorAll(".compute-device-item");
    buttons.forEach((button) => {
      const buttonDevice = (button as HTMLElement).dataset.device;
      const isSelected = buttonDevice === device;
      const borderColor = isSelected ? "#22c55e" : "#d1d5db";
      const borderWidth = isSelected ? "2px" : "1px";
      (button as HTMLElement).style.border =
        `${borderWidth} solid ${borderColor}`;
    });

    if (this.options.onComputeDeviceChange) {
      this.options.onComputeDeviceChange(device);
    }
  }

  private handleOverlayModeChange(enabled: boolean): void {
    this.overlayMode = enabled;

    const currentName = this.container.querySelector(
      ".overlay-mode-current-name",
    );
    if (currentName) {
      currentName.textContent = enabled
        ? t("popup_overlay_mode_layer")
        : t("popup_overlay_mode_composite");
    }

    const buttons = this.container.querySelectorAll(".overlay-mode-item");
    buttons.forEach((button) => {
      const buttonEnabled =
        (button as HTMLElement).dataset.overlayMode === "true";
      const isSelected = buttonEnabled === enabled;
      const borderColor = isSelected ? "#22c55e" : "#d1d5db";
      const borderWidth = isSelected ? "2px" : "1px";
      (button as HTMLElement).style.border =
        `${borderWidth} solid ${borderColor}`;
    });

    this.options.onOverlayModeChange?.(enabled);
  }

  private handleShowUnplacedOnlyToggle(): void {
    this.showUnplacedOnly = !this.showUnplacedOnly;

    // ボタンの表示を更新
    const toggleButton = this.container.querySelector(
      ".show-unplaced-only-toggle",
    ) as HTMLElement;
    if (toggleButton) {
      const bgColor = this.showUnplacedOnly
        ? "var(--color-success, #22c55e)"
        : "var(--color-base-300, #e5e7eb)";
      const textColor = this.showUnplacedOnly
        ? "var(--color-primary-content, #fff)"
        : "var(--color-base-content, #6b7280)";
      const borderColor = this.showUnplacedOnly ? "#22c55e" : "#d1d5db";

      toggleButton.style.backgroundColor = bgColor;
      toggleButton.style.color = textColor;
      toggleButton.style.borderColor = borderColor;
    }

    if (this.options.onShowUnplacedOnlyChange) {
      this.options.onShowUnplacedOnlyChange(this.showUnplacedOnly);
    }
  }

  private handleSelectedColorOnlyMarkToggle(): void {
    this.selectedColorOnlyMark = !this.selectedColorOnlyMark;

    const toggleButton = this.container.querySelector(
      ".selected-color-only-mark-toggle",
    ) as HTMLElement;
    if (toggleButton) {
      const bgColor = this.selectedColorOnlyMark
        ? "var(--color-success, #22c55e)"
        : "transparent";
      const textColor = this.selectedColorOnlyMark
        ? "var(--color-primary-content, #fff)"
        : "var(--color-base-content, #6b7280)";
      const borderColor = this.selectedColorOnlyMark ? "#22c55e" : "#d1d5db";

      toggleButton.style.backgroundColor = bgColor;
      toggleButton.style.color = textColor;
      toggleButton.style.borderColor = borderColor;
      toggleButton.style.fontWeight = this.selectedColorOnlyMark ? "600" : "400";
    }

    this.options.onSelectedColorOnlyMarkChange?.(this.selectedColorOnlyMark);
  }

  // Public API
  getSelectedColors(): number[] {
    return Array.from(this.selectedColorIds);
  }

  updateColorStats(
    colorStats?: Record<string, { matched: number; total: number }>,
  ): void {
    this.options.colorStats = colorStats;
    if (this.options.showColorStats) {
      this.updateColorGrid();
    }
  }

  setSelectedColors(colorIds: number[]): void {
    this.selectedColorIds = new Set(colorIds);
    this.updateAllColorSelections();
  }

  destroy(): void {
    // イベントリスナー削除
    this.container.removeEventListener("click", this.boundClickHandler);
    this.container.removeEventListener("input", this.boundInputHandler);
    this.container.removeEventListener("change", this.boundChangeHandler);
    document.removeEventListener("click", this.boundDocumentClickHandler);

    // DOM削除
    this.container.innerHTML = "";
  }

  // UIの部分更新

  private updateColorGrid(): void {
    const sortedColors = sortColors(this.sortOrder, this.options.colorStats);
    const colorGridHtml = buildColorGrid(
      this.selectedColorIds,
      this.currentlySelectedColorId,
      sortedColors,
      this.options,
    );

    const gridContainer = this.container.querySelector(".color-palette-grid");
    if (gridContainer) {
      // DOMを破壊することなく、中身だけを更新
      gridContainer.innerHTML = colorGridHtml;
    }
  }

  private updateSortControlsDisplay(sort: SortOrder): void {
    // 1. ボタンのラベル更新
    const currentName = this.container.querySelector(
      ".sort-order-current-name",
    );
    if (currentName) {
      const currentOption = SORT_ORDER_OPTIONS.find((o) => o.value === sort);
      const currentLabelKey = currentOption?.labelKey ?? "sort_order_default";
      currentName.textContent = t`${currentLabelKey}`;
    }

    // 2. ドロップダウン内のアイテムの選択状態を更新
    const items = this.container.querySelectorAll(".sort-order-item");
    items.forEach((item) => {
      const itemSort = (item as HTMLElement).dataset.sort as SortOrder;
      const isSelected = itemSort === sort;
      const borderColor = isSelected ? "#22c55e" : "#d1d5db";
      const borderWidth = isSelected ? "2px" : "1px";
      (item as HTMLElement).style.border =
        `${borderWidth} solid ${borderColor}`;
    });
  }
}

// 型エクスポート
export type { ColorPaletteOptions } from "./types";
