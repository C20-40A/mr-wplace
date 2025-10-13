import { colorpalette } from "../../constants/colors";
import type { EnhancedMode } from "../../features/tile-draw/types";
import { ENHANCED_MODE_ICONS } from "../../assets/enhanced-mode-icons";
import { t } from "../../i18n/manager";
import type { ColorPaletteOptions, SortOrder } from "./types";
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
  private sortOrder: SortOrder = "default";
  private boundClickHandler: (e: MouseEvent) => void;
  private boundDocumentClickHandler: (e: MouseEvent) => void;

  constructor(container: HTMLElement, options: ColorPaletteOptions = {}) {
    this.container = container;
    this.options = options;
    this.selectedColorIds = new Set(
      options.selectedColorIds ?? colorpalette.map((c) => c.id)
    );
    this.currentlySelectedColorId = options.showCurrentlySelected
      ? getCurrentlySelectedColorId()
      : null;
    this.enhancedMode = options.enhancedMode ?? "dot";
    this.sortOrder = options.sortOrder ?? "default";

    // イベントハンドラーをbind
    this.boundClickHandler = (e: MouseEvent) => this.handleClick(e);
    this.boundDocumentClickHandler = (e: MouseEvent) => this.handleDocumentClick(e);

    this.render();
    this.setupEventHandlers();
  }

  private render(): void {
    const sortedColors = sortColors(this.sortOrder, this.options.colorStats);
    const colorGridHtml = buildColorGrid(
      this.selectedColorIds,
      this.currentlySelectedColorId,
      sortedColors,
      this.options
    );
    const controlsHtml = buildControlsHtml(
      this.options.hasExtraColorsBitmap ?? false,
      this.options.showColorStats ?? false,
      this.options.showEnhancedSelect ?? false,
      this.sortOrder,
      this.enhancedMode
    );

    this.container.innerHTML = `
      ${controlsHtml}
      <div class="color-palette-grid grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2 px-4 pb-4">
        ${colorGridHtml}
      </div>
    `;
  }

  private setupEventHandlers(): void {
    // イベント委譲で全イベント処理
    this.container.addEventListener("click", this.boundClickHandler);

    // ドロップダウンを外側クリックで閉じる
    document.addEventListener("click", this.boundDocumentClickHandler);
  }

  private handleDocumentClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest(".sort-order-container")) {
      const dropdown = this.container.querySelector(
        ".sort-order-dropdown"
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
    }
    if (!(e.target as HTMLElement).closest(".enhanced-mode-container")) {
      const dropdown = this.container.querySelector(
        ".enhanced-mode-dropdown"
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
    }
  }

  private handleClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;

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

    // Sort Order Button
    if (
      target.closest(".sort-order-button") &&
      !target.closest(".sort-order-item")
    ) {
      e.stopPropagation();
      const dropdown = this.container.querySelector(
        ".sort-order-dropdown"
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
        ".sort-order-dropdown"
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
        ".enhanced-mode-dropdown"
      ) as HTMLElement;
      if (dropdown) {
        const isVisible = dropdown.style.display !== "none";

        if (!isVisible) {
          // レスポンシブ対応
          const isMobile = window.innerWidth < 640;
          const grid = dropdown.querySelector(
            ".enhanced-mode-grid"
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
      ".enhanced-mode-item"
    ) as HTMLElement;
    if (enhancedModeItem) {
      e.stopPropagation();
      const mode = enhancedModeItem.dataset.mode as EnhancedMode;
      this.handleEnhancedModeChange(mode);
      const dropdown = this.container.querySelector(
        ".enhanced-mode-dropdown"
      ) as HTMLElement;
      if (dropdown) dropdown.style.display = "none";
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
      colorpalette.filter((c) => !c.premium).map((c) => c.id)
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

  private notifyChange(): void {
    if (this.options.onChange) {
      this.options.onChange(Array.from(this.selectedColorIds));
    }
  }

  private updateColorSelection(colorId: number): void {
    const colorItem = this.container.querySelector(
      `[data-color-id="${colorId}"]`
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

    // 現在選択中のアイコンと名称を更新
    const currentIcon = this.container.querySelector(
      ".enhanced-mode-current-icon"
    ) as HTMLImageElement;
    if (currentIcon) {
      currentIcon.src = ENHANCED_MODE_ICONS[mode];
      currentIcon.alt = mode;
    }

    const currentName = this.container.querySelector(
      ".enhanced-mode-current-name"
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
      (
        button as HTMLElement
      ).style.border = `${borderWidth} solid ${borderColor}`;
    });

    if (this.options.onEnhancedModeChange) {
      this.options.onEnhancedModeChange(mode);
    }
  }

  // Public API
  getSelectedColors(): number[] {
    return Array.from(this.selectedColorIds);
  }

  setSelectedColors(colorIds: number[]): void {
    this.selectedColorIds = new Set(colorIds);
    this.updateAllColorSelections();
  }

  destroy(): void {
    // イベントリスナー削除
    this.container.removeEventListener("click", this.boundClickHandler);
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
      this.options
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
      ".sort-order-current-name"
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
      (item as HTMLElement).style.border = `${borderWidth} solid ${borderColor}`;
    });
  }
}

// 型エクスポート
export type { ColorPaletteOptions } from "./types";
