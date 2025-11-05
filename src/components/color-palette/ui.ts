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
        ? '<span style="position: absolute; right: 0.25rem; top: 0.25rem; font-size: 0.75rem; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;">💧</span>'
        : "";
      const enabledBadge = isSelected
        ? ENABLED_BADGE_HTML
        : DISABLED_BADGE_HTML;
      const currentlySelectedIcon =
        options.showCurrentlySelected && currentlySelectedColorId === color.id
          ? CURRENTLY_SELECTED_ICON_HTML
          : "";

      const colorKey = getColorKey(r, g, b);
      const stats = options.showColorStats && options.colorStats?.[colorKey];
      const statsHtml = stats ? createStatsHtml(stats) : "";

      return `
        <div class="color-item cursor-pointer p-2 text-xs font-medium flex flex-col items-center justify-center min-h-[3rem]"
             style="background-color: ${backgroundColor}; 
                    color: ${textColor}; 
                    border-color: ${borderColor}; 
                    position: relative; 
                    border-radius: 0.5rem; 
                    border-style: solid; 
                    border-width: 3px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: scale(1);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    cursor: pointer;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;"
             data-color-id="${color.id}"
             title="${color.name} (${color.premium ? "Premium" : "Free"})"
             onmouseenter="this.style.transform='scale(1.05) translateY(-2px)'; this.style.boxShadow='0 8px 16px rgba(0, 0, 0, 0.2)';"
             onmouseleave="this.style.transform='scale(1) translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.1)';"
             onmousedown="this.style.transform='scale(0.95)';"
             onmouseup="this.style.transform='scale(1.05) translateY(-2px)';"
             ontouchstart="this.style.transform='scale(0.95)'; this.style.boxShadow='0 1px 2px rgba(0, 0, 0, 0.1)';"
             ontouchend="this.style.transform='scale(1.05) translateY(-2px)'; this.style.boxShadow='0 8px 16px rgba(0, 0, 0, 0.2)'; setTimeout(() => { this.style.transform='scale(1) translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0, 0, 0, 0.1)'; }, 200);">
          ${enabledBadge}
          <span style="text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);">${
            color.name
          }</span>
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
      <button class="sort-order-button" type="button" 
              style="padding: 0.2rem 0.4rem; 
                     border: 2px solid #d1d5db; 
                     border-radius: 0.5rem; 
                     background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
                     cursor: pointer; 
                     display: flex; 
                     align-items: center; 
                     gap: 0.5rem;
                     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                     box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                     user-select: none;
                     -webkit-tap-highlight-color: transparent;"
              onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#22c55e';"
              onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'; this.style.borderColor='#d1d5db';"
              onmousedown="this.style.transform='scale(0.98)';"
              onmouseup="this.style.transform='translateY(-1px)';"
              ontouchstart="this.style.transform='scale(0.98)'; this.style.boxShadow='0 1px 2px rgba(0, 0, 0, 0.1)';"
              ontouchend="this.style.transform='scale(1)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)';">
        <span style="font-size: 0.875rem; color: #374151;">${t`${"sort_by"}`}</span>
        <span class="sort-order-current-name" style="font-size: 0.875rem; font-weight: 600; color: #22c55e; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">${t`${currentLabelKey}`}</span>
      </button>
      <div class="sort-order-dropdown" 
           style="display: none; 
                  position: absolute; 
                  top: 100%; 
                  left: 0; 
                  margin-top: 0.5rem; 
                  background-color: white; 
                  border: 2px solid #e5e7eb; 
                  border-radius: 0.5rem; 
                  padding: 0.375rem; 
                  z-index: 1000; 
                  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                  min-width: 180px;
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="sort-order-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${SORT_ORDER_OPTIONS.map((option) => {
            const isSelected = sortOrder === option.value;
            const borderColor = isSelected ? "#22c55e" : "#e5e7eb";
            const borderWidth = isSelected ? "2px" : "1px";
            const backgroundColor = isSelected ? "#f0fdf4" : "white";
            return `
              <button class="sort-order-item" 
                      data-sort="${option.value}"
                      type="button"
                      style="padding: 0.5rem 0.75rem; 
                             border: ${borderWidth} solid ${borderColor}; 
                             border-radius: 0.375rem; 
                             background-color: ${backgroundColor};
                             cursor: pointer; 
                             text-align: left; 
                             font-size: 0.875rem;
                             transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                             font-weight: ${isSelected ? "600" : "400"};
                             color: ${isSelected ? "#22c55e" : "#374151"};
                             user-select: none;
                             -webkit-tap-highlight-color: transparent;"
                      onmouseenter="this.style.backgroundColor='${
                        isSelected ? "#dcfce7" : "#f9fafb"
                      }'; this.style.transform='translateX(4px)'; this.style.borderColor='#22c55e';"
                      onmouseleave="this.style.backgroundColor='${backgroundColor}'; this.style.transform='translateX(0)'; this.style.borderColor='${borderColor}';"
                      onmousedown="this.style.transform='scale(0.98)';"
                      onmouseup="this.style.transform='translateX(4px)';"
                      ontouchstart="this.style.transform='scale(0.98)';"
                      ontouchend="this.style.transform='scale(1)';">
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
      <button class="enhanced-mode-button" type="button" 
              style="padding: 0.2rem 0.4rem; 
                     border: 2px solid #d1d5db; 
                     border-radius: 0.5rem; 
                     background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
                     cursor: pointer; 
                     display: flex; 
                     align-items: center; 
                     gap: 0.5rem; 
                     width: 100%;
                     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                     box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                     user-select: none;
                     -webkit-tap-highlight-color: transparent;"
              onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#22c55e';"
              onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'; this.style.borderColor='#d1d5db';"
              onmousedown="this.style.transform='scale(0.98)';"
              onmouseup="this.style.transform='translateY(-1px)';"
              ontouchstart="this.style.transform='scale(0.98)'; this.style.boxShadow='0 1px 2px rgba(0, 0, 0, 0.1)';"
              ontouchend="this.style.transform='scale(1)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)';">
        <img class="enhanced-mode-current-icon" 
             src="${ENHANCED_MODE_ICONS[enhancedMode]}" 
             alt="${enhancedMode}" 
             style="width: 20px; 
                    height: 20px; 
                    image-rendering: pixelated;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
                    transition: transform 0.2s ease;" />
        <span style="font-size: 0.875rem; color: #374151;">${t`${"enhanced_mode_label"}`}</span>
        <span class="enhanced-mode-current-name" 
              style="font-size: 0.875rem; 
                     font-weight: 600; 
                     color: #22c55e;
                     text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">${t`${labelKey}`}</span>
      </button>
      <div class="enhanced-mode-dropdown" 
           style="display: none; 
                  position: absolute; 
                  top: 100%; 
                  left: 0; 
                  margin-top: 0.5rem; 
                  background-color: white; 
                  border: 2px solid #e5e7eb; 
                  border-radius: 0.5rem; 
                  padding: 0.5rem; 
                  z-index: 1000; 
                  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="enhanced-mode-grid" style="display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));">
          ${ENHANCED_MODE_OPTIONS.map((mode) => {
            const isSelected = enhancedMode === mode.value;
            const borderColor = isSelected ? "#22c55e" : "#e5e7eb";
            const borderWidth = isSelected ? "3px" : "2px";
            const backgroundColor = isSelected ? "#f0fdf4" : "white";
            return `
              <button class="enhanced-mode-item" 
                      data-mode="${mode.value}"
                      type="button"
                      title="${t`${mode.labelKey}`}"
                      style="padding: 0.5rem; 
                             border: ${borderWidth} solid ${borderColor}; 
                             border-radius: 0.5rem; 
                             background-color: ${backgroundColor};
                             cursor: pointer; 
                             display: flex; 
                             flex-direction: column; 
                             align-items: center; 
                             gap: 0.5rem;
                             transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                             user-select: none;
                             -webkit-tap-highlight-color: transparent;"
                      onmouseenter="this.style.transform='scale(1.05) translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#22c55e'; this.querySelector('img').style.transform='scale(1.1) rotate(5deg)';"
                      onmouseleave="this.style.transform='scale(1) translateY(0)'; this.style.boxShadow='none'; this.style.borderColor='${borderColor}'; this.querySelector('img').style.transform='scale(1) rotate(0deg)';"
                      onmousedown="this.style.transform='scale(0.95)';"
                      onmouseup="this.style.transform='scale(1.05) translateY(-2px)';"
                      ontouchstart="this.style.transform='scale(0.95)';"
                      ontouchend="this.style.transform='scale(1)';">
                <img src="${ENHANCED_MODE_ICONS[mode.value]}" 
                     alt="${mode.value}" 
                     style="width: 28px; 
                            height: 28px; 
                            image-rendering: pixelated;
                            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
                            transition: transform 0.2s ease;" />
                <span style="font-size: 0.625rem; 
                             color: ${isSelected ? "#22c55e" : "#6b7280"}; 
                             text-align: center;
                             font-weight: ${
                               isSelected ? "600" : "400"
                             };">${t`${mode.labelKey}`}</span>
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
export function buildComputeDeviceSelectHtml(
  computeDevice: ComputeDevice
): string {
  const devices: Array<{ value: ComputeDevice; label: string; icon: string }> =
    [
      { value: "gpu", label: "GPU", icon: "🚀" },
      { value: "cpu", label: "CPU", icon: "⚙️" },
    ];

  const currentDevice = devices.find((d) => d.value === computeDevice);
  const currentLabel = currentDevice?.label ?? "GPU";

  return `
    <div class="compute-device-container" style="position: relative;">
      <button class="compute-device-button" type="button" 
              style="padding: 0.2rem 0.4rem; 
                     border: 2px solid #d1d5db; 
                     border-radius: 0.5rem; 
                     background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
                     cursor: pointer; 
                     display: flex; 
                     align-items: center; 
                     gap: 0.5rem;
                     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                     box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                     user-select: none;
                     -webkit-tap-highlight-color: transparent;"
              onmouseenter="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(0, 0, 0, 0.15)'; this.style.borderColor='#22c55e';"
              onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'; this.style.borderColor='#d1d5db';"
              onmousedown="this.style.transform='scale(0.98)';"
              onmouseup="this.style.transform='translateY(-1px)';"
              ontouchstart="this.style.transform='scale(0.98)'; this.style.boxShadow='0 1px 2px rgba(0, 0, 0, 0.1)';"
              ontouchend="this.style.transform='scale(1)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)';">
        <span style="font-size: 0.875rem; color: #374151;">${t`${"compute_device_label"}`}</span>
        <span class="compute-device-current-name" 
              style="font-size: 0.875rem; 
                     font-weight: 600; 
                     color: #22c55e;
                     text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">${currentLabel}</span>
      </button>
      <div class="compute-device-dropdown" 
           style="display: none; 
                  position: absolute; 
                  top: 100%; 
                  left: 0; 
                  margin-top: 0.5rem; 
                  background-color: white; 
                  border: 2px solid #e5e7eb; 
                  border-radius: 0.5rem; 
                  padding: 0.375rem; 
                  z-index: 1000; 
                  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
                  min-width: 100px;
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="compute-device-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${devices
            .map((device) => {
              const isSelected = computeDevice === device.value;
              const borderColor = isSelected ? "#22c55e" : "#e5e7eb";
              const borderWidth = isSelected ? "2px" : "1px";
              const backgroundColor = isSelected ? "#f0fdf4" : "white";
              return `
              <button class="compute-device-item" 
                      data-device="${device.value}"
                      type="button"
                      style="padding: 0.2rem 0.4rem; 
                             border: ${borderWidth} solid ${borderColor}; 
                             border-radius: 0.375rem; 
                             background-color: ${backgroundColor};
                             cursor: pointer; 
                             text-align: left; 
                             font-size: 0.875rem;
                             transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                             display: flex;
                             align-items: center;
                             gap: 0.5rem;
                             font-weight: ${isSelected ? "600" : "400"};
                             color: ${isSelected ? "#22c55e" : "#374151"};
                             user-select: none;
                             -webkit-tap-highlight-color: transparent;"
                      onmouseenter="this.style.backgroundColor='${
                        isSelected ? "#dcfce7" : "#f9fafb"
                      }'; this.style.transform='translateX(4px)'; this.style.borderColor='#22c55e';"
                      onmouseleave="this.style.backgroundColor='${backgroundColor}'; this.style.transform='translateX(0)'; this.style.borderColor='${borderColor}';"
                      onmousedown="this.style.transform='scale(0.98)';"
                      onmouseup="this.style.transform='translateX(4px)';"
                      ontouchstart="this.style.transform='scale(0.98)';"
                      ontouchend="this.style.transform='scale(1)';">
                <span style="font-size: 1rem; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));">${
                  device.icon
                }</span>
                <span>${device.label}</span>
              </button>
            `;
            })
            .join("")}
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
  const buttonBaseStyle = `
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  `;

  const ownedColorsButtonHTML = hasExtraColorsBitmap
    ? `<button class="owned-colors-btn btn btn-outline btn-sm rounded" 
               style="${buttonBaseStyle} 
                      border: 2px solid #a855f7; 
                      color: #a855f7;
                      background: linear-gradient(135deg, #ffffff 0%, #faf5ff 100%);"
               onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(168, 85, 247, 0.3)'; this.style.backgroundColor='#faf5ff';"
               onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'; this.style.background='linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)';"
               onmousedown="this.style.transform='scale(0.95)';"
               onmouseup="this.style.transform='translateY(-2px)';"
               ontouchstart="this.style.transform='scale(0.95)';"
               ontouchend="this.style.transform='scale(1)';">${t`${"owned_colors_only"}`}</button>`
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
    <div class="color-palette-controls flex flex-wrap gap-2 px-4 pb-2">
      <button class="enable-all-btn btn btn-outline btn-success btn-sm rounded" 
              style="${buttonBaseStyle} 
                     border: 2px solid #22c55e; 
                     color: #22c55e;
                     background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);"
              onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(34, 197, 94, 0.3)'; this.style.backgroundColor='#dcfce7';"
              onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'; this.style.background='linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)';"
              onmousedown="this.style.transform='scale(0.95)';"
              onmouseup="this.style.transform='translateY(-2px)';"
              ontouchstart="this.style.transform='scale(0.95)';"
              ontouchend="this.style.transform='scale(1)';">${t`${"enable_all"}`}</button>
      <button class="disable-all-btn btn btn-outline btn-error btn-sm rounded" 
              style="${buttonBaseStyle} 
                     border: 2px solid #ef4444; 
                     color: #ef4444;
                     background: linear-gradient(135deg, #ffffff 0%, #fef2f2 100%);"
              onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(239, 68, 68, 0.3)'; this.style.backgroundColor='#fee2e2';"
              onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'; this.style.background='linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)';"
              onmousedown="this.style.transform='scale(0.95)';"
              onmouseup="this.style.transform='translateY(-2px)';"
              ontouchstart="this.style.transform='scale(0.95)';"
              ontouchend="this.style.transform='scale(1)';">${t`${"disable_all"}`}</button>
      <button class="free-colors-btn btn btn-outline btn-sm rounded" 
              style="${buttonBaseStyle} 
                     border: 2px solid #3b82f6; 
                     color: #3b82f6;
                     background: linear-gradient(135deg, #ffffff 0%, #eff6ff 100%);"
              onmouseenter="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.3)'; this.style.backgroundColor='#dbeafe';"
              onmouseleave="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.1)'; this.style.background='linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)';"
              onmousedown="this.style.transform='scale(0.95)';"
              onmouseup="this.style.transform='translateY(-2px)';"
              ontouchstart="this.style.transform='scale(0.95)';"
              ontouchend="this.style.transform='scale(1)';">${t`${"free_colors_only"}`}</button>
      ${ownedColorsButtonHTML}
      ${sortOrderSelectHTML}
      ${enhancedSelectHTML}
      ${computeDeviceSelectHTML}
    </div>
    <style>
      @keyframes slideDown {
        from {
          opacity: 0;
          transform: translateY(-10px) scaleY(0.9);
        }
        to {
          opacity: 1;
          transform: translateY(0) scaleY(1);
        }
      }
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    </style>
  `;
}
