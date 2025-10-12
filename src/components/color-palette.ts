import { colorpalette } from "../constants/colors";
import { t } from "../i18n/manager";
import type { EnhancedMode } from "../features/tile-draw/types";
import { ENHANCED_MODE_ICONS } from "../assets/enhanced-mode-icons";

interface ColorPaletteOptions {
  onChange?: (colorIds: number[]) => void;
  selectedColorIds?: number[];
  showCurrentlySelected?: boolean; // 現在選択中の色を表示するか（default: false）
  showEnhancedSelect?: boolean; // enhancedモード選択表示（default: false）
  onEnhancedModeChange?: (mode: EnhancedMode) => void;
  enhancedMode?: EnhancedMode;
  hasExtraColorsBitmap?: boolean; // extraColorsBitmap有無（所持色ボタン表示制御）
  showColorStats?: boolean; // 色ごとの統計表示
  colorStats?: Record<string, { matched: number; total: number }>; // 色ごとの統計データ
}

const enabledBadgeHTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #22c55e; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">✓</span>';
const disabledBadgeHTML =
  '<span class="badge-status" style="position: absolute; top: -0.5rem; left: -0.5rem; width: 1rem; height: 1rem; background-color: #ef4444; border: 1px solid black; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.75rem; font-weight: bold;">x</span>';
const currentlySelectedIconHTML =
  '<span class="currently-selected-icon" style="position: absolute; top: -0.4rem; right: -0.4rem; font-size: 0.65rem; background: white; border-radius: 50%; border: 1px solid black;">⭐</span>';

/**
 * カラーパレット表示コンポーネント
 * 色をクリックで選択状態を変更（緑枠=選択、赤枠=未選択）
 */
export class ColorPalette {
  private container: HTMLElement;
  private options: ColorPaletteOptions;
  private selectedColorIds: Set<number> = new Set();
  private currentlySelectedColorId: number | null = null;
  private enhancedMode: EnhancedMode = "dot";
  private sortOrder: "default" | "most-missing" | "least-remaining" = "default";

  constructor(container: HTMLElement, options: ColorPaletteOptions = {}) {
    this.container = container;
    this.options = options;
    // 初期状態で全色選択
    this.selectedColorIds = new Set(
      options.selectedColorIds ?? colorpalette.map((c) => c.id)
    );

    // 現在選択中の色を取得
    if (this.options.showCurrentlySelected) {
      const selectedColorStr = window.localStorage.getItem("selected-color"); // TODO: src/utils/wplaceLocalStorage.ts使う
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
    // 並び替え処理
    let sortedColors = [...colorpalette];
    if (this.options.showColorStats && this.options.colorStats) {
      if (this.sortOrder === "most-missing") {
        // 統計あり/なしで分離
        const withStats: Array<{
          color: (typeof colorpalette)[0];
          remaining: number;
        }> = [];
        const withoutStats: typeof colorpalette = [];

        sortedColors.forEach((color) => {
          const [r, g, b] = color.rgb;
          const key = `${r},${g},${b}`;
          const stats = this.options.colorStats?.[key];
          if (stats) {
            const remaining = stats.total - stats.matched;
            withStats.push({ color, remaining });
          } else {
            withoutStats.push(color);
          }
        });

        // 統計あり色を残り降順ソート
        withStats.sort((a, b) => b.remaining - a.remaining);

        // 統計あり + 統計なし（default順）
        sortedColors = [...withStats.map((w) => w.color), ...withoutStats];
      } else if (this.sortOrder === "least-remaining") {
        sortedColors.sort((a, b) => {
          const [rA, gA, bA] = a.rgb;
          const [rB, gB, bB] = b.rgb;
          const keyA = `${rA},${gA},${bA}`;
          const keyB = `${rB},${gB},${bB}`;
          const statsA = this.options.colorStats?.[keyA];
          const statsB = this.options.colorStats?.[keyB];
          const remainingA = statsA ? statsA.total - statsA.matched : Infinity;
          const remainingB = statsB ? statsB.total - statsB.matched : Infinity;
          // 0はInfinity扱いで最後に
          const sortValueA = remainingA === 0 ? Infinity : remainingA;
          const sortValueB = remainingB === 0 ? Infinity : remainingB;
          return sortValueA - sortValueB; // 昇順
        });
      }
    }

    const paletteGrid = sortedColors
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

        // 統計表示
        const colorKey = `${r},${g},${b}`;
        const stats =
          this.options.showColorStats && this.options.colorStats?.[colorKey];
        const statsHtml = stats ? this.createStatsHtml(stats) : "";

        return `
        <div class="color-item cursor-pointer p-2 text-xs font-medium flex flex-col items-center justify-center min-h-[3rem]"
             style="background-color: ${backgroundColor}; color: ${textColor}; border-color: ${borderColor}; position: relative; 
             border-radius: 0.5rem; border-style: solid; border-width: 3px;"
             data-color-id="${color.id}"
             title="${color.name} (${color.premium ? "Premium" : "Free"})">
          ${enabledBadge}
          <span>${color.name}</span>
          ${premiumIcon}
          ${currentlySelectedIcon}
          ${statsHtml}
        </div>
      `;
      })
      .join("");

    const enhancedModes: Array<{
      value: EnhancedMode;
      labelKey: string;
    }> = [
      { value: "dot", labelKey: "enhanced_mode_dot" },
      { value: "cross", labelKey: "enhanced_mode_cross" },
      { value: "fill", labelKey: "enhanced_mode_fill" },
      { value: "red-cross", labelKey: "enhanced_mode_red_cross" },
      { value: "cyan-cross", labelKey: "enhanced_mode_cyan_cross" },
      { value: "dark-cross", labelKey: "enhanced_mode_dark_cross" },
      { value: "complement-cross", labelKey: "enhanced_mode_complement_cross" },
      { value: "red-border", labelKey: "enhanced_mode_red_border" },
    ];

    const sortOrderOptions: Array<{
      value: "default" | "most-missing" | "least-remaining";
      labelKey: string;
    }> = [
      { value: "default", labelKey: "sort_order_default" },
      { value: "most-missing", labelKey: "sort_order_most_missing" },
      { value: "least-remaining", labelKey: "sort_order_least_remaining" },
    ];

    const sortOrderSelectHTML = this.options.showColorStats
      ? `<div class="sort-order-container" style="position: relative;">
          <button class="sort-order-button" type="button" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.875rem; color: #374151;">${t`${"sort_by"}`}</span>
            <span class="sort-order-current-name" style="font-size: 0.875rem; font-weight: 600; color: #22c55e;">${t`${
              sortOrderOptions.find((o) => o.value === this.sortOrder)?.labelKey ??
              "sort_order_default"
            }`}</span>
          </button>
          <div class="sort-order-dropdown" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 0.25rem; background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.5rem; z-index: 1000; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); min-width: 200px;">
            <div class="sort-order-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
              ${sortOrderOptions
                .map((option) => {
                  const isSelected = this.sortOrder === option.value;
                  const borderColor = isSelected ? "#22c55e" : "#d1d5db";
                  const borderWidth = isSelected ? "2px" : "1px";
                  return `
                  <button class="sort-order-item" 
                          data-sort="${option.value}"
                          type="button"
                          style="padding: 0.5rem; border: ${borderWidth} solid ${borderColor}; border-radius: 0.375rem; background-color: white; cursor: pointer; text-align: left; font-size: 0.875rem;">
                    ${t`${option.labelKey}`}
                  </button>
                `;
                })
                .join("")}
            </div>
          </div>
        </div>`
      : "";

    const enhancedSelectHTML = this.options.showEnhancedSelect
      ? `<div class="enhanced-mode-container" style="position: relative;">
          <button class="enhanced-mode-button" type="button" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; width: 100%;">
            <img class="enhanced-mode-current-icon" src="${
              ENHANCED_MODE_ICONS[this.enhancedMode]
            }" alt="${
          this.enhancedMode
        }" style="width: 20px; height: 20px; image-rendering: pixelated;" />
            <span style="font-size: 0.875rem; color: #374151;">${t`${"enhanced_mode_label"}`}</span>
            <span class="enhanced-mode-current-name" style="font-size: 0.875rem; font-weight: 600; color: #22c55e;">${t`${
              enhancedModes.find((m) => m.value === this.enhancedMode)
                ?.labelKey ?? "enhanced_mode_dot"
            }`}</span>
          </button>
          <div class="enhanced-mode-dropdown" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 0.25rem; background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.5rem; z-index: 1000; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div class="enhanced-mode-grid" style="display: grid; gap: 0.5rem;">
              ${enhancedModes
                .map((mode) => {
                  const isSelected = this.enhancedMode === mode.value;
                  const borderColor = isSelected ? "#22c55e" : "#d1d5db";
                  const borderWidth = isSelected ? "3px" : "2px";
                  return `
                  <button class="enhanced-mode-item" 
                          data-mode="${mode.value}"
                          type="button"
                          title="${t`${mode.labelKey}`}"
                          style="padding: 0.5rem; border: ${borderWidth} solid ${borderColor}; border-radius: 0.375rem; background-color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                    <img src="${ENHANCED_MODE_ICONS[mode.value]}" alt="${
                    mode.value
                  }" style="width: 24px; height: 24px; image-rendering: pixelated;" />
                    <span style="font-size: 0.625rem; color: #6b7280; text-align: center;">${t`${mode.labelKey}`}</span>
                  </button>
                `;
                })
                .join("")}
            </div>
          </div>
        </div>`
      : "";

    const ownedColorsButtonHTML = this.options.hasExtraColorsBitmap
      ? `<button class="owned-colors-btn btn btn-outline btn-sm rounded" style="border-color: #a855f7; color: #a855f7;">${t`${"owned_colors_only"}`}</button>`
      : "";

    this.container.innerHTML = `
      <div class="color-palette-controls flex flex-wrap gap-2 mb-4 px-4 pt-4">
        <button class="enable-all-btn btn btn-outline btn-success btn-sm rounded">${t`${"enable_all"}`}</button>
        <button class="disable-all-btn btn btn-outline btn-error btn-sm rounded">${t`${"disable_all"}`}</button>
        <button class="free-colors-btn btn btn-outline btn-sm rounded" style="border-color: #3b82f6; color: #3b82f6;">${t`${"free_colors_only"}`}</button>
        ${ownedColorsButtonHTML}
        ${sortOrderSelectHTML}
        ${enhancedSelectHTML}
      </div>
      <div class="color-palette-grid grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2 px-4 pb-4">
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

      // Free Colors ボタン
      if (target.classList.contains("free-colors-btn")) {
        this.enableFreeColors();
        return;
      }

      // Owned Colors ボタン
      if (target.classList.contains("owned-colors-btn")) {
        this.enableOwnedColors();
        return;
      }

      // 色選択
      const colorItem = target.closest(".color-item");
      if (!colorItem) return;

      const colorId = parseInt((colorItem as HTMLElement).dataset.colorId!);
      this.toggleColor(colorId);
    });

    // Sort Order Button (ドロップダウンを開閉)
    const sortOrderButton = this.container.querySelector(".sort-order-button");
    const sortOrderDropdown = this.container.querySelector(
      ".sort-order-dropdown"
    ) as HTMLElement;

    if (sortOrderButton && sortOrderDropdown) {
      sortOrderButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = sortOrderDropdown.style.display !== "none";
        sortOrderDropdown.style.display = isVisible ? "none" : "block";
      });

      // Sort Order Items
      const sortOrderItems =
        this.container.querySelectorAll(".sort-order-item");
      sortOrderItems.forEach((item) => {
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          const sort = (item as HTMLElement).dataset.sort as
            | "default"
            | "most-missing"
            | "least-remaining";
          this.handleSortOrderChange(sort);
          sortOrderDropdown.style.display = "none";
        });
      });

      // 外側クリックで閉じる
      const closeSortDropdown = () => {
        sortOrderDropdown.style.display = "none";
      };
      document.addEventListener("click", closeSortDropdown);
    }

    // Enhanced Mode Button (ドロップダウンを開閉)
    const enhancedModeButton = this.container.querySelector(
      ".enhanced-mode-button"
    );
    const enhancedModeDropdown = this.container.querySelector(
      ".enhanced-mode-dropdown"
    ) as HTMLElement;

    if (enhancedModeButton && enhancedModeDropdown) {
      enhancedModeButton.addEventListener("click", (e) => {
        e.stopPropagation();
        const isVisible = enhancedModeDropdown.style.display !== "none";

        if (!isVisible) {
          // レスポンシブ対応: モバイルは2列、PCは4列
          const isMobile = window.innerWidth < 640;
          const enhancedModeGrid = enhancedModeDropdown.querySelector(
            ".enhanced-mode-grid"
          ) as HTMLElement;

          if (isMobile) {
            enhancedModeDropdown.style.minWidth = "";
            enhancedModeGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
          } else {
            enhancedModeDropdown.style.minWidth = "320px";
            enhancedModeGrid.style.gridTemplateColumns = "repeat(4, 1fr)";
          }
        }

        enhancedModeDropdown.style.display = isVisible ? "none" : "block";
      });

      // 外側クリックで閉じる
      document.addEventListener("click", () => {
        enhancedModeDropdown.style.display = "none";
      });
    }

    // Enhanced Mode Grid
    const enhancedModeButtons = this.container.querySelectorAll(
      ".enhanced-mode-item"
    );
    enhancedModeButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        const mode = (button as HTMLElement).dataset.mode as EnhancedMode;
        this.handleEnhancedModeChange(mode);
        if (enhancedModeDropdown) {
          enhancedModeDropdown.style.display = "none";
        }
      });
    });
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

  private enableFreeColors(): void {
    this.selectedColorIds = new Set(
      colorpalette.filter((c) => !c.premium).map((c) => c.id)
    );
    this.updateSelection();
    this.notifyChange();
  }

  private enableOwnedColors(): void {
    const ownedIds = window.mrWplace?.colorFilterManager?.getOwnedColorIds();
    if (!ownedIds) return;

    this.selectedColorIds = new Set(ownedIds);
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

  private createStatsHtml(stats: { matched: number; total: number }): string {
    const remaining = stats.total - stats.matched;
    const percentage =
      stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;

    // 残り0px（完成済み）なら非表示
    if (remaining === 0) return "";

    const pixelDisplay = `<div style="font-size: 0.625rem; margin-left: 0.125rem; white-space: nowrap;">${remaining}px</div>`;

    return `
      <div style="width: 100%; margin-top: 0.25rem; display: flex; align-items: center;">
        <div style="flex: 1; height: 0.5rem; background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 0.125rem; overflow: hidden;">
          <div style="height: 100%; background: linear-gradient(to right, #3b82f6, #60a5fa); width: ${percentage.toFixed(
            1
          )}%; transition: width 0.3s ease;"></div>
        </div>
        ${pixelDisplay}
      </div>
    `;
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
      const labelKey =
        [
          { value: "dot", labelKey: "enhanced_mode_dot" },
          { value: "cross", labelKey: "enhanced_mode_cross" },
          { value: "fill", labelKey: "enhanced_mode_fill" },
          { value: "red-cross", labelKey: "enhanced_mode_red_cross" },
          { value: "cyan-cross", labelKey: "enhanced_mode_cyan_cross" },
          { value: "dark-cross", labelKey: "enhanced_mode_dark_cross" },
          {
            value: "complement-cross",
            labelKey: "enhanced_mode_complement_cross",
          },
          { value: "red-border", labelKey: "enhanced_mode_red_border" },
        ].find((m) => m.value === mode)?.labelKey ?? "enhanced_mode_dot";
      currentName.textContent = t`${labelKey}`;
    }

    // ドロップダウン内の全ボタンの選択状態を更新
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

  private handleSortOrderChange(
    sort: "default" | "most-missing" | "least-remaining"
  ): void {
    this.sortOrder = sort;
    this.createPaletteUI();
    this.setupEventHandlers();
  }
}
