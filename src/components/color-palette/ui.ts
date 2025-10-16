import { colorpalette } from "../../constants/colors";
import { t } from "../../i18n/manager";
import type { EnhancedMode } from "../../features/tile-draw/types";
import { ENHANCED_MODE_ICONS } from "../../assets/enhanced-mode-icons";
import type { SortOrder, ColorPaletteOptions } from "./types";
import type { ComputeDevice } from "./storage";
import {
  ENABLED_BADGE_HTML,
  DISABLED_BADGE_HTML,
  CURRENTLY_SELECTED_ICON_HTML,
  ENHANCED_MODE_OPTIONS,
  SORT_ORDER_OPTIONS,
  getContrastTextColor,
  getColorKey,
  createStatsHtml,
  getEnhancedModeLabelKey,
} from "./utils";

/**
 * カラーパレットグリッドHTML生成
 */
export function buildColorGrid(
  selectedColorIds: Set<number>,
  currentlySelectedColorId: number | null,
  sortedColors: typeof colorpalette,
  options: ColorPaletteOptions
): string {
  return sortedColors
    .map((color) => {
      const [r, g, b] = color.rgb;
      const backgroundColor = `rgb(${r}, ${g}, ${b})`;
      const textColor = getContrastTextColor(r, g, b);
      const isSelected = selectedColorIds.has(color.id);
      const borderColor = isSelected ? "#22c55e" : "#ef4444";

      const premiumIcon = color.premium
        ? '<span style="position: absolute; right: 0.25rem; top: 0.25rem; font-size: 0.75rem;">💧</span>'
        : "";
      const enabledBadge = isSelected ? ENABLED_BADGE_HTML : DISABLED_BADGE_HTML;
      const currentlySelectedIcon =
        options.showCurrentlySelected && currentlySelectedColorId === color.id
          ? CURRENTLY_SELECTED_ICON_HTML
          : "";

      const colorKey = getColorKey(r, g, b);
      const stats =
        options.showColorStats && options.colorStats?.[colorKey];
      const statsHtml = stats ? createStatsHtml(stats) : "";

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
}

/**
 * ソート順ドロップダウンHTML生成
 */
export function buildSortOrderSelectHtml(sortOrder: SortOrder): string {
  const currentOption = SORT_ORDER_OPTIONS.find((o) => o.value === sortOrder);
  const currentLabelKey = currentOption?.labelKey ?? "sort_order_default";

  return `
    <div class="sort-order-container" style="position: relative;">
      <button class="sort-order-button" type="button" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 0.875rem; color: #374151;">${t`${"sort_by"}`}</span>
        <span class="sort-order-current-name" style="font-size: 0.875rem; font-weight: 600; color: #22c55e;">${t`${currentLabelKey}`}</span>
      </button>
      <div class="sort-order-dropdown" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 0.25rem; background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.5rem; z-index: 1000; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); min-width: 200px;">
        <div class="sort-order-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${SORT_ORDER_OPTIONS.map((option) => {
            const isSelected = sortOrder === option.value;
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
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * EnhancedモードドロップダウンHTML生成
 */
export function buildEnhancedSelectHtml(enhancedMode: EnhancedMode): string {
  const labelKey = getEnhancedModeLabelKey(enhancedMode);

  return `
    <div class="enhanced-mode-container" style="position: relative;">
      <button class="enhanced-mode-button" type="button" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; width: 100%;">
        <img class="enhanced-mode-current-icon" src="${ENHANCED_MODE_ICONS[enhancedMode]}" alt="${enhancedMode}" style="width: 20px; height: 20px; image-rendering: pixelated;" />
        <span style="font-size: 0.875rem; color: #374151;">${t`${"enhanced_mode_label"}`}</span>
        <span class="enhanced-mode-current-name" style="font-size: 0.875rem; font-weight: 600; color: #22c55e;">${t`${labelKey}`}</span>
      </button>
      <div class="enhanced-mode-dropdown" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 0.25rem; background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.5rem; z-index: 1000; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div class="enhanced-mode-grid" style="display: grid; gap: 0.5rem;">
          ${ENHANCED_MODE_OPTIONS.map((mode) => {
            const isSelected = enhancedMode === mode.value;
            const borderColor = isSelected ? "#22c55e" : "#d1d5db";
            const borderWidth = isSelected ? "3px" : "2px";
            return `
              <button class="enhanced-mode-item" 
                      data-mode="${mode.value}"
                      type="button"
                      title="${t`${mode.labelKey}`}"
                      style="padding: 0.5rem; border: ${borderWidth} solid ${borderColor}; border-radius: 0.375rem; background-color: white; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
                <img src="${ENHANCED_MODE_ICONS[mode.value]}" alt="${mode.value}" style="width: 24px; height: 24px; image-rendering: pixelated;" />
                <span style="font-size: 0.625rem; color: #6b7280; text-align: center;">${t`${mode.labelKey}`}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * ComputeDeviceドロップダウンHTML生成
 */
export function buildComputeDeviceSelectHtml(computeDevice: ComputeDevice): string {
  const devices: Array<{ value: ComputeDevice; label: string }> = [
    { value: "gpu", label: "GPU" },
    { value: "cpu", label: "CPU" },
  ];

  const currentLabel = devices.find((d) => d.value === computeDevice)?.label ?? "GPU";

  return `
    <div class="compute-device-container" style="position: relative;">
      <button class="compute-device-button" type="button" style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 0.875rem; color: #374151;">${t`${"compute_device_label"}`}</span>
        <span class="compute-device-current-name" style="font-size: 0.875rem; font-weight: 600; color: #22c55e;">${currentLabel}</span>
      </button>
      <div class="compute-device-dropdown" style="display: none; position: absolute; top: 100%; left: 0; margin-top: 0.25rem; background-color: white; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.5rem; z-index: 1000; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); min-width: 120px;">
        <div class="compute-device-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${devices.map((device) => {
            const isSelected = computeDevice === device.value;
            const borderColor = isSelected ? "#22c55e" : "#d1d5db";
            const borderWidth = isSelected ? "2px" : "1px";
            return `
              <button class="compute-device-item" 
                      data-device="${device.value}"
                      type="button"
                      style="padding: 0.5rem; border: ${borderWidth} solid ${borderColor}; border-radius: 0.375rem; background-color: white; cursor: pointer; text-align: left; font-size: 0.875rem;">
                ${device.label}
              </button>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

/**
 * コントロールボタン群HTML生成
 */
export function buildControlsHtml(
  hasExtraColorsBitmap: boolean,
  showColorStats: boolean,
  showEnhancedSelect: boolean,
  showComputeDeviceSelect: boolean,
  sortOrder: SortOrder,
  enhancedMode: EnhancedMode,
  computeDevice: ComputeDevice
): string {
  const ownedColorsButtonHTML = hasExtraColorsBitmap
    ? `<button class="owned-colors-btn btn btn-outline btn-sm rounded" style="border-color: #a855f7; color: #a855f7;">${t`${"owned_colors_only"}`}</button>`
    : "";

  const sortOrderSelectHTML = showColorStats
    ? buildSortOrderSelectHtml(sortOrder)
    : "";

  const enhancedSelectHTML = showEnhancedSelect
    ? buildEnhancedSelectHtml(enhancedMode)
    : "";

  const computeDeviceSelectHTML = showComputeDeviceSelect
    ? buildComputeDeviceSelectHtml(computeDevice)
    : "";

  return `
    <div class="color-palette-controls flex flex-wrap gap-2 mb-4 px-4 pt-4">
      <button class="enable-all-btn btn btn-outline btn-success btn-sm rounded">${t`${"enable_all"}`}</button>
      <button class="disable-all-btn btn btn-outline btn-error btn-sm rounded">${t`${"disable_all"}`}</button>
      <button class="free-colors-btn btn btn-outline btn-sm rounded" style="border-color: #3b82f6; color: #3b82f6;">${t`${"free_colors_only"}`}</button>
      ${ownedColorsButtonHTML}
      ${sortOrderSelectHTML}
      ${enhancedSelectHTML}
      ${computeDeviceSelectHTML}
    </div>
  `;
}
