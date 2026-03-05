import { colorpalette } from "../../constants/colors";
import { t } from "../../i18n/manager";
import type { EnhancedMode } from "@/types/image";
import {
  SHOW_UNPLACED_ONLY_ICON_SVG,
  createEnhancedModeIcons,
} from "../../assets/enhanced-mode-icons";
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
  options: ColorPaletteOptions,
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
      const statsHtml = stats
        ? createStatsHtml(stats, options.colorStatsTotalOnly)
        : "";

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
                    transform: scale(1);                    cursor: pointer;
                    user-select: none;
                    -webkit-tap-highlight-color: transparent;"
             data-color-id="${color.id}"
             title="${color.name} (${color.premium ? "Premium" : "Free"})"
             onmouseenter="this.style.transform='scale(1.05) translateY(-2px)';"
             onmouseleave="this.style.transform='scale(1) translateY(0)';"
             onmousedown="this.style.transform='scale(0.95)';"
             onmouseup="this.style.transform='scale(1.05) translateY(-2px)';"
             ontouchstart="this.style.transform='scale(0.95)';"
             ontouchend="this.style.transform='scale(1.05) translateY(-2px)'; setTimeout(() => { this.style.transform='scale(1) translateY(0)'; }, 200);">
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
export function buildSortOrderSelectHtml(
  sortOrder: SortOrder,
  controlSize: "default" | "xs" = "default",
): string {
  const isXs = controlSize === "xs";
  const currentOption = SORT_ORDER_OPTIONS.find((o) => o.value === sortOrder);
  const currentLabelKey = currentOption?.labelKey ?? "sort_order_default";

  const sortIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; flex-shrink: 0;">
      <path d="M3 6h18M7 12h10M11 18h2"/>
      <path d="M18 6l3 3-3 3"/>
    </svg>
  `.trim();

  return `
    <div class="sort-order-container" style="position: relative;">
      <button class="sort-order-button" type="button"
              style="padding: ${isXs ? "0.15rem 0.3rem" : "0.2rem 0.4rem"};
                     border: 2px solid #d1d5db;
                     border-radius: ${isXs ? "0.4rem" : "0.5rem"};
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     gap: 0.5rem;
                     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);                     user-select: none;
                     -webkit-tap-highlight-color: transparent;"
              onmouseenter=" this.style.borderColor='#22c55e';"
              onmouseleave=" this.style.borderColor='#d1d5db';"
              onmousedown="this.style.transform='scale(0.98)';"
              onmouseup="this.style.transform='scale(1)';"
              ontouchstart="this.style.transform='scale(0.98)';"
              ontouchend="this.style.transform='scale(1)';">
        <span style="display: flex; align-items: center; color: #22c55e;">${sortIconSvg}</span>
        <span class="sort-order-current-name" style="font-size: ${isXs ? "0.75rem" : "0.875rem"}; font-weight: 600; color: #22c55e; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">${t`${currentLabelKey}`}</span>
      </button>
      <div class="sort-order-dropdown"
           style="display: none;
                  position: absolute;
                  top: 100%;
                  left: 0;
                  margin-top: 0.5rem;
                  background-color: var(--color-base-200, #f9fafb);
                  border: 2px solid var(--color-base-content, #e5e7eb);
                  border-radius: 0.5rem;
                  padding: 0.375rem;
                  z-index: 1000;                  min-width: ${isXs ? "150px" : "180px"};
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="sort-order-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${SORT_ORDER_OPTIONS.map((option) => {
            const isSelected = sortOrder === option.value;
            const borderColor = isSelected
              ? "#22c55e"
              : "var(--color-base-content, #e5e7eb)";
            const borderWidth = isSelected ? "2px" : "1px";
            const bgColor = isSelected
              ? "var(--color-primary, #22c55e)"
              : "var(--color-base-300, #f9fafb)";
            const textColor = isSelected
              ? "var(--color-primary-content, #fff)"
              : "var(--color-base-content, inherit)";
            return `
              <button class="sort-order-item"
                      data-sort="${option.value}"
                      type="button"
                      style="padding: ${isXs ? "0.35rem 0.5rem" : "0.5rem 0.75rem"};
                             background-color: ${bgColor};
                             border: ${borderWidth} solid ${borderColor};
                             border-radius: 0.375rem;
                             cursor: pointer;
                             text-align: left;
                             font-size: ${isXs ? "0.75rem" : "0.875rem"};
                             transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                             font-weight: ${isSelected ? "600" : "400"};
                             color: ${textColor};
                             user-select: none;
                             -webkit-tap-highlight-color: transparent;"
                      onmouseenter="this.style.backgroundColor='${
                        isSelected
                          ? "var(--color-primary, #dcfce7)"
                          : "var(--color-base-200, #f0f0f0)"
                      }'; this.style.transform='translateX(4px)'; this.style.borderColor='#22c55e';"
                      onmouseleave="this.style.backgroundColor='${bgColor}'; this.style.transform='translateX(0)'; this.style.borderColor='${borderColor}';"
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

const rgbToHex = ([r, g, b]: [number, number, number]): string =>
  `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

/**
 * EnhancedモードドロップダウンHTML生成
 */
export function buildEnhancedSelectHtml(
  enhancedMode: EnhancedMode,
  controlSize: "default" | "xs" = "default",
  enhancedColor: [number, number, number] = [255, 0, 0],
  selectedColorOnlyMark: boolean = false,
): string {
  const isXs = controlSize === "xs";
  const labelKey = getEnhancedModeLabelKey(enhancedMode);
  const icons = createEnhancedModeIcons(rgbToHex(enhancedColor));
  const colorHex = rgbToHex(enhancedColor);

  return `
    <div class="enhanced-mode-container" style="position: relative;">
      <button class="enhanced-mode-button" type="button"
              style="padding: ${isXs ? "0.15rem 0.3rem" : "0.2rem 0.4rem"};
                     border: 2px solid #d1d5db;
                     border-radius: ${isXs ? "0.4rem" : "0.5rem"};
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     gap: 0.5rem;
                     width: 100%;
                     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);                     user-select: none;
                     -webkit-tap-highlight-color: transparent;"
              onmouseenter=" this.style.borderColor='#22c55e';"
              onmouseleave=" this.style.borderColor='#d1d5db';"
              onmousedown="this.style.transform='scale(0.98)';"
              onmouseup="this.style.transform='scale(1)';"
              ontouchstart="this.style.transform='scale(0.98)';"
              ontouchend="this.style.transform='scale(1)';">
        <img class="enhanced-mode-current-icon"
             src="${icons[enhancedMode]}"
             alt="${enhancedMode}" 
             style="width: ${isXs ? "16px" : "20px"}; 
                    height: ${isXs ? "16px" : "20px"}; 
                    image-rendering: pixelated;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
                    transition: transform 0.2s ease;" />
        <span class="enhanced-mode-current-name" 
              style="font-size: ${isXs ? "0.75rem" : "0.875rem"}; 
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
                  background-color: var(--color-base-200, #f9fafb);
                  border: 2px solid var(--color-base-content, #e5e7eb);
                  border-radius: 0.5rem;
                  padding: 0.5rem;
                  z-index: 1000;                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="enhanced-mode-grid" style="display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));">
          ${ENHANCED_MODE_OPTIONS.map((mode) => {
            const isSelected = enhancedMode === mode.value;
            const borderColor = isSelected
              ? "#22c55e"
              : "var(--color-base-content, #e5e7eb)";
            const borderWidth = isSelected ? "3px" : "2px";
            const bgColor = isSelected
              ? "var(--color-primary, #22c55e)"
              : "var(--color-base-300, transparent)";
            const textColor = isSelected
              ? "var(--color-primary-content, #22c55e)"
              : "var(--color-base-content, #6b7280)";
            // Speed badge: fast=⚡, slow=⌛, normal=none
            const speedBadge =
              mode.speed === "fast"
                ? `<span style="position: absolute; top: -2px; right: -2px; font-size: ${
                    isXs ? "0.7rem" : "0.8rem"
                  };">⚡</span>`
                : mode.speed === "slow"
                  ? `<span style="position: absolute; top: -2px; right: -2px; font-size: ${
                      isXs ? "0.7rem" : "0.8rem"
                    };">⌛</span>`
                  : "";
            // Tooltip: label + max pixel limit (no i18n needed)
            const limitInfo =
              mode.maxPixels != null
                ? ` (MAX ${mode.maxPixels}px)`
                : mode.speed === "slow"
                  ? ` (∞)`
                  : "";
            return `
              <button class="enhanced-mode-item"
                      data-mode="${mode.value}"
                      type="button"
                      title="${t`${mode.labelKey}`}${limitInfo}"
                      style="position: relative;
                             padding: ${isXs ? "0.35rem" : "0.5rem"};
                             background-color: ${bgColor};
                             border: ${borderWidth} solid ${borderColor};
                             border-radius: ${isXs ? "0.4rem" : "0.5rem"};
                             cursor: pointer;
                             display: flex;
                             flex-direction: column;
                             align-items: center;
                             gap: ${isXs ? "0.35rem" : "0.5rem"};
                             transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                             user-select: none;
                             -webkit-tap-highlight-color: transparent;"
                      onmouseenter="this.style.transform='scale(1.05) translateY(-2px)'; this.style.borderColor='#22c55e'; this.querySelector('img').style.transform='scale(1.1) rotate(5deg)';"
                      onmouseleave="this.style.transform='scale(1) translateY(0)'; this.style.borderColor='${borderColor}'; this.querySelector('img').style.transform='scale(1) rotate(0deg)';"
                      onmousedown="this.style.transform='scale(0.95)';"
                      onmouseup="this.style.transform='scale(1.05) translateY(-2px)';"
                      ontouchstart="this.style.transform='scale(0.95)';"
                      ontouchend="this.style.transform='scale(1)';">
                ${speedBadge}
                <img src="${icons[mode.value]}"
                     alt="${mode.value}"
                     style="width: ${isXs ? "22px" : "28px"};
                            height: ${isXs ? "22px" : "28px"};
                            image-rendering: pixelated;
                            filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
                            transition: transform 0.2s ease;" />
                <span style="font-size: ${isXs ? "0.55rem" : "0.625rem"};
                             color: ${textColor};
                             text-align: center;
                             font-weight: ${
                               isSelected ? "600" : "400"
                             };">${t`${mode.labelKey}`}</span>
              </button>
            `;
          }).join("")}
        </div>
        <div class="enhanced-color-picker-container"
             style="display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 0.25rem 0;
                    border-top: 1px solid var(--color-base-content, #e5e7eb);
                    margin-top: 0.5rem;">
          <input type="color" class="enhanced-color-picker"
                 value="${colorHex}"
                 style="width: ${isXs ? "24px" : "28px"}; height: ${isXs ? "24px" : "28px"};
                        border: 2px solid #d1d5db; cursor: pointer; padding: 0;
                        border-radius: 4px; background: none;" />
          <span style="font-size: ${isXs ? "0.65rem" : "0.75rem"}; color: var(--color-base-content, #6b7280);">${t("marker_color")}</span>
          <button class="selected-color-only-mark-toggle" type="button"
                  style="margin-left: auto;
                         padding: ${isXs ? "0.15rem 0.35rem" : "0.2rem 0.5rem"};
                         border: 2px solid ${selectedColorOnlyMark ? "#22c55e" : "#d1d5db"};
                         border-radius: ${isXs ? "0.4rem" : "0.5rem"};
                         cursor: pointer;
                         font-size: ${isXs ? "0.65rem" : "0.75rem"};
                         font-weight: ${selectedColorOnlyMark ? "600" : "400"};
                         background-color: ${selectedColorOnlyMark ? "var(--color-success, #22c55e)" : "transparent"};
                         color: ${selectedColorOnlyMark ? "var(--color-primary-content, #fff)" : "var(--color-base-content, #6b7280)"};
                         transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                         white-space: nowrap;
                         user-select: none;
                         -webkit-tap-highlight-color: transparent;"
                  onmouseenter="this.style.borderColor='#22c55e';"
                  onmouseleave="this.style.borderColor='${selectedColorOnlyMark ? "#22c55e" : "#d1d5db"}';"
                  onmousedown="this.style.transform='scale(0.95)';"
                  onmouseup="this.style.transform='scale(1)';"
                  ontouchstart="this.style.transform='scale(0.95)';"
                  ontouchend="this.style.transform='scale(1)';">${t("selected_color_only_mark")}</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * ComputeDeviceドロップダウンHTML生成
 */
export function buildComputeDeviceSelectHtml(
  computeDevice: ComputeDevice,
  controlSize: "default" | "xs" = "default",
): string {
  const isXs = controlSize === "xs";
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
              style="padding: ${isXs ? "0.15rem 0.3rem" : "0.2rem 0.4rem"};
                     border: 2px solid #d1d5db;
                     border-radius: ${isXs ? "0.4rem" : "0.5rem"};
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     gap: 0.5rem;
                     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);                     user-select: none;
                     -webkit-tap-highlight-color: transparent;"
              onmouseenter=" this.style.borderColor='#22c55e';"
              onmouseleave=" this.style.borderColor='#d1d5db';"
              onmousedown="this.style.transform='scale(0.98)';"
              onmouseup="this.style.transform='scale(1)';"
              ontouchstart="this.style.transform='scale(0.98)';"
              ontouchend="this.style.transform='scale(1)';">
        <span style="font-size: ${isXs ? "0.75rem" : "0.875rem"};">${t`${"compute_device_label"}`}</span>
        <span class="compute-device-current-name" 
              style="font-size: ${isXs ? "0.75rem" : "0.875rem"}; 
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
                  background-color: var(--color-base-200, #f9fafb);
                  border: 2px solid var(--color-base-content, #e5e7eb);
                  border-radius: 0.5rem;
                  padding: 0.375rem;
                  z-index: 1000;                  min-width: ${isXs ? "90px" : "100px"};
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="compute-device-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${devices
            .map((device) => {
              const isSelected = computeDevice === device.value;
              const borderColor = isSelected
                ? "#22c55e"
                : "var(--color-base-content, #e5e7eb)";
              const borderWidth = isSelected ? "2px" : "1px";
              const bgColor = isSelected
                ? "var(--color-primary, #22c55e)"
                : "var(--color-base-300, #f9fafb)";
              const textColor = isSelected
                ? "var(--color-primary-content, #fff)"
                : "var(--color-base-content, inherit)";
              return `
              <button class="compute-device-item"
                      data-device="${device.value}"
                      type="button"
                      style="padding: ${isXs ? "0.15rem 0.3rem" : "0.2rem 0.4rem"};
                             background-color: ${bgColor};
                             border: ${borderWidth} solid ${borderColor};
                             border-radius: 0.375rem;
                             cursor: pointer;
                             text-align: left;
                             font-size: ${isXs ? "0.75rem" : "0.875rem"};
                             transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                             display: flex;
                             align-items: center;
                             gap: 0.5rem;
                             font-weight: ${isSelected ? "600" : "400"};
                             color: ${textColor};
                             user-select: none;
                             -webkit-tap-highlight-color: transparent;"
                      onmouseenter="this.style.backgroundColor='${
                        isSelected
                          ? "var(--color-primary, #dcfce7)"
                          : "var(--color-base-200, #f0f0f0)"
                      }'; this.style.transform='translateX(4px)'; this.style.borderColor='#22c55e';"
                      onmouseleave="this.style.backgroundColor='${bgColor}'; this.style.transform='translateX(0)'; this.style.borderColor='${borderColor}';"
                      onmousedown="this.style.transform='scale(0.98)';"
                      onmouseup="this.style.transform='translateX(4px)';"
                      ontouchstart="this.style.transform='scale(0.98)';"
                      ontouchend="this.style.transform='scale(1)';">
                <span style="font-size: ${isXs ? "0.85rem" : "1rem"}; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));">${
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
 * Overlay modeドロップダウンHTML生成
 */
export function buildOverlayModeSelectHtml(
  enabled: boolean,
  controlSize: "default" | "xs" = "default",
): string {
  const isXs = controlSize === "xs";
  const options: Array<{
    value: "true" | "false";
    labelKey: string;
  }> = [
    { value: "false", labelKey: "popup_overlay_mode_composite" },
    { value: "true", labelKey: "popup_overlay_mode_layer" },
  ];
  const currentOption = options.find((o) => (o.value === "true") === enabled);
  const currentLabelKey =
    currentOption?.labelKey ?? "popup_overlay_mode_composite";

  return `
    <div class="overlay-mode-container" style="position: relative;">
      <button class="overlay-mode-button" type="button"
              style="padding: ${isXs ? "0.15rem 0.3rem" : "0.2rem 0.4rem"};
                     border: 2px solid #d1d5db;
                     border-radius: ${isXs ? "0.4rem" : "0.5rem"};
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     gap: 0.5rem;
                     transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);                     user-select: none;
                     -webkit-tap-highlight-color: transparent;"
              onmouseenter=" this.style.borderColor='#22c55e';"
              onmouseleave=" this.style.borderColor='#d1d5db';"
              onmousedown="this.style.transform='scale(0.98)';"
              onmouseup="this.style.transform='scale(1)';"
              ontouchstart="this.style.transform='scale(0.98)';"
              ontouchend="this.style.transform='scale(1)';">
        <span style="font-size: ${isXs ? "0.75rem" : "0.875rem"};">${t`${"popup_overlay_mode"}`}</span>
        <span class="overlay-mode-current-name"
              style="font-size: ${isXs ? "0.75rem" : "0.875rem"};
                     font-weight: 600;
                     color: #22c55e;
                     text-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">${t`${currentLabelKey}`}</span>
      </button>
      <div class="overlay-mode-dropdown"
           style="display: none;
                  position: absolute;
                  top: 100%;
                  left: 0;
                  margin-top: 0.5rem;
                  background-color: var(--color-base-200, #f9fafb);
                  border: 2px solid var(--color-base-content, #e5e7eb);
                  border-radius: 0.5rem;
                  padding: 0.375rem;
                  z-index: 1000;                  min-width: ${isXs ? "150px" : "180px"};
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="overlay-mode-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${options
            .map((option) => {
              const isSelected = (option.value === "true") === enabled;
              const borderColor = isSelected
                ? "#22c55e"
                : "var(--color-base-content, #e5e7eb)";
              const borderWidth = isSelected ? "2px" : "1px";
              const bgColor = isSelected
                ? "var(--color-primary, #22c55e)"
                : "var(--color-base-300, #f9fafb)";
              const textColor = isSelected
                ? "var(--color-primary-content, #fff)"
                : "var(--color-base-content, inherit)";
              return `
              <button class="overlay-mode-item"
                      data-overlay-mode="${option.value}"
                      type="button"
                      style="padding: ${isXs ? "0.35rem 0.5rem" : "0.5rem 0.75rem"};
                             background-color: ${bgColor};
                             border: ${borderWidth} solid ${borderColor};
                             border-radius: 0.375rem;
                             cursor: pointer;
                             text-align: left;
                             font-size: ${isXs ? "0.75rem" : "0.875rem"};
                             transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                             font-weight: ${isSelected ? "600" : "400"};
                             color: ${textColor};
                             user-select: none;
                             -webkit-tap-highlight-color: transparent;"
                      onmouseenter="this.style.backgroundColor='${
                        isSelected
                          ? "var(--color-primary, #dcfce7)"
                          : "var(--color-base-200, #f0f0f0)"
                      }'; this.style.transform='translateX(4px)'; this.style.borderColor='#22c55e';"
                      onmouseleave="this.style.backgroundColor='${bgColor}'; this.style.transform='translateX(0)'; this.style.borderColor='${borderColor}';"
                      onmousedown="this.style.transform='scale(0.98)';"
                      onmouseup="this.style.transform='translateX(4px)';"
                      ontouchstart="this.style.transform='scale(0.98)';"
                      ontouchend="this.style.transform='scale(1)';">
                ${t`${option.labelKey}`}
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
 * Show Unplaced Only トグルHTML生成
 */
export function buildShowUnplacedOnlyToggleHtml(
  enabled: boolean,
  showUnplacedColor: [number, number, number] = [160, 160, 160],
  controlSize: "default" | "xs" = "default",
): string {
  const isXs = controlSize === "xs";
  const colorHex = rgbToHex(showUnplacedColor);
  const bgColor = enabled
    ? "var(--color-success, #22c55e)"
    : "var(--color-base-300, #e5e7eb)";
  const textColor = enabled
    ? "var(--color-primary-content, #fff)"
    : "var(--color-base-content, #6b7280)";
  const borderColor = enabled ? "#22c55e" : "#d1d5db";
  const sizeClass = isXs ? "btn-xs XS" : "btn-sm";

  return `
    <button class="show-unplaced-only-toggle btn ${sizeClass} rounded"
            type="button"
            style="padding: ${isXs ? "0.3rem 0.45rem" : "0.4rem 0.6rem"};
                   border: 2px solid ${borderColor};
                   border-radius: ${isXs ? "0.4rem" : "0.5rem"};
                   cursor: pointer;
                   display: flex;
                   align-items: center;
                   gap: 0.5rem;
                   background-color: ${bgColor};
                   color: ${textColor};
                   transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);                   user-select: none;
                   -webkit-tap-highlight-color: transparent;"
            onmouseenter=" this.style.transform='translateY(-1px)';"
            onmouseleave=" this.style.transform='translateY(0)';"
            onmousedown="this.style.transform='scale(0.95)';"
            onmouseup="this.style.transform='scale(1)';"
            ontouchstart="this.style.transform='scale(0.95)';"
            ontouchend="this.style.transform='scale(1)';">
      <span style="display: flex; align-items: center; width: ${isXs ? "18px" : "24px"}; height: ${isXs ? "18px" : "24px"};">${SHOW_UNPLACED_ONLY_ICON_SVG}</span>
      <span style="font-size: ${isXs ? "0.75rem" : "0.875rem"}; font-weight: 600;">${t("show_unplaced_only")}</span>
      <input type="color"
             class="show-unplaced-color-picker"
             value="${colorHex}"
             title="${t("show_unplaced_color")}"
             style="width: ${isXs ? "16px" : "20px"};
                    height: ${isXs ? "16px" : "20px"};
                    border: 1px solid rgba(255,255,255,0.45);
                    border-radius: 4px;
                    background: none;
                    cursor: pointer;
                    padding: 0;
                    flex-shrink: 0;" />
    </button>
  `;
}

/**
 * コントロールボタン群HTML生成
 */
export function buildControlsHtml(
  hasExtraColorsBitmap: boolean,
  showColorStats: boolean,
  showEnhancedSelect: boolean,
  showOverlayModeSelect: boolean,
  showComputeDeviceSelect: boolean,
  sortOrder: SortOrder,
  enhancedMode: EnhancedMode,
  overlayMode: boolean,
  computeDevice: ComputeDevice,
  showUnplacedOnlyToggle: boolean = false,
  showUnplacedOnly: boolean = false,
  showUnplacedColor: [number, number, number] = [160, 160, 160],
  showDisableUnusedButton: boolean = false,
  controlSize: "default" | "xs" = "default",
  enhancedColor: [number, number, number] = [255, 0, 0],
  selectedColorOnlyMark: boolean = false,
): string {
  const isXs = controlSize === "xs";
  const sizeClass = isXs ? "btn-xs XS" : "btn-sm";
  const buttonBaseStyle = `
    padding: ${isXs ? "0.3rem 0.6rem" : "0.625rem 1.25rem"};
    border-radius: ${isXs ? "0.4rem" : "0.5rem"};
    font-size: ${isXs ? "0.75rem" : "0.875rem"};
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);    user-select: none;
    -webkit-tap-highlight-color: transparent;
  `;
  const iconButtonBaseStyle = `
    width: ${isXs ? "1.8rem" : "2.25rem"};
    height: ${isXs ? "1.8rem" : "2.25rem"};
    min-width: ${isXs ? "1.8rem" : "2.25rem"};
    min-height: ${isXs ? "1.8rem" : "2.25rem"};
    padding: 0;
    border-radius: 9999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: ${isXs ? "0.9rem" : "1rem"};
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);    user-select: none;
    -webkit-tap-highlight-color: transparent;
  `;
  const enableAllIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         style="width: ${isXs ? "0.95rem" : "1.1rem"}; height: ${isXs ? "0.95rem" : "1.1rem"}; display: block; pointer-events: none;">
      <path d="M20 6L9 17l-5-5" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();
  const disableAllIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         style="width: ${isXs ? "0.95rem" : "1.1rem"}; height: ${isXs ? "0.95rem" : "1.1rem"}; display: block; pointer-events: none;">
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `.trim();

  const ownedColorsButtonHTML = hasExtraColorsBitmap
    ? `<button class="owned-colors-btn btn btn-outline ${sizeClass} rounded"
               style="${buttonBaseStyle}
                      border: 2px solid var(--color-secondary, #9333ea);
                      color: var(--color-secondary, #9333ea);
               onmouseenter="this.style.backgroundColor='var(--color-base-300, #f0f0f0)'; this.style.borderColor='var(--color-secondary, #9333ea)';"
               onmouseleave="this.style.backgroundColor='transparent';"
               onmousedown="this.style.transform='scale(0.95)';"
               onmouseup="this.style.transform='scale(1)';"
               ontouchstart="this.style.transform='scale(0.95)';"
               ontouchend="this.style.transform='scale(1)';">${t`${"owned_colors_only"}`}</button>`
    : "";

  const sortOrderSelectHTML = showColorStats
    ? buildSortOrderSelectHtml(sortOrder, controlSize)
    : "";

  const enhancedSelectHTML = showEnhancedSelect
    ? buildEnhancedSelectHtml(
        enhancedMode,
        controlSize,
        enhancedColor,
        selectedColorOnlyMark,
      )
    : "";

  const overlayModeSelectHTML = showOverlayModeSelect
    ? buildOverlayModeSelectHtml(overlayMode, controlSize)
    : "";

  const computeDeviceSelectHTML = showComputeDeviceSelect
    ? buildComputeDeviceSelectHtml(computeDevice, controlSize)
    : "";

  const showUnplacedOnlyToggleHTML = showUnplacedOnlyToggle
    ? buildShowUnplacedOnlyToggleHtml(
        showUnplacedOnly,
        showUnplacedColor,
        controlSize,
      )
    : "";

  const disableUnusedButtonHTML = showDisableUnusedButton
    ? `<button class="disable-unused-btn btn btn-outline ${sizeClass} rounded"
               style="${buttonBaseStyle}
                      border: 2px solid var(--color-warning, #f59e0b);
                      color: var(--color-warning, #f59e0b);
               onmouseenter="this.style.backgroundColor='var(--color-base-300, #f0f0f0)'; this.style.borderColor='var(--color-warning, #f59e0b)'; this.style.color='var(--color-warning, #f59e0b)';"
               onmouseleave="this.style.backgroundColor='transparent'; this.style.color='var(--color-warning, #f59e0b)';"
               onmousedown="this.style.transform='scale(0.95)';"
               onmouseup="this.style.transform='scale(1)';"
               ontouchstart="this.style.transform='scale(0.95)';"
               ontouchend="this.style.transform='scale(1)';">${t`${"disable_unused_colors"}`}</button>`
    : "";

  return `
    <div class="color-palette-controls flex flex-wrap gap-2 px-4 pb-2">
      <button class="enable-all-btn btn btn-outline ${sizeClass} rounded-full"
              style="${iconButtonBaseStyle}
                     background: linear-gradient(145deg, #4ade80 0%, #22c55e 55%, #16a34a 100%);
                     border: 2px solid #15803d;
                     color: #fff;              onmouseenter="this.style.filter='brightness(1.05)'; this.style.transform='translateY(-1px)';"
              onmouseleave="this.style.filter='brightness(1)'; this.style.transform='translateY(0)';"
              onmousedown="this.style.transform='scale(0.95)';"
              onmouseup="this.style.transform='translateY(-1px)';"
              ontouchstart="this.style.transform='scale(0.95)';"
              ontouchend="this.style.transform='scale(1)';"
              title="${t`${"enable_all"}`}">${enableAllIconSvg}</button>
      <button class="disable-all-btn btn btn-outline ${sizeClass} rounded-full"
              style="${iconButtonBaseStyle}
                     background: linear-gradient(145deg, #f87171 0%, #ef4444 55%, #dc2626 100%);
                     border: 2px solid #b91c1c;
                     color: #fff;              onmouseenter="this.style.filter='brightness(1.05)'; this.style.transform='translateY(-1px)';"
              onmouseleave="this.style.filter='brightness(1)'; this.style.transform='translateY(0)';"
              onmousedown="this.style.transform='scale(0.95)';"
              onmouseup="this.style.transform='translateY(-1px)';"
              ontouchstart="this.style.transform='scale(0.95)';"
              ontouchend="this.style.transform='scale(1)';"
              title="${t`${"disable_all"}`}">${disableAllIconSvg}</button>
      <button class="free-colors-btn btn btn-outline ${sizeClass} rounded-full"
              style="${iconButtonBaseStyle}
                     border: 2px solid var(--color-info, #2563eb);
                     color: var(--color-info, #2563eb);
              onmouseenter="this.style.backgroundColor='var(--color-base-300, #f0f0f0)'; this.style.borderColor='var(--color-info, #2563eb)';"
              onmouseleave="this.style.backgroundColor='transparent';"
              onmousedown="this.style.transform='scale(0.95)';"
              onmouseup="this.style.transform='scale(1)';"
              ontouchstart="this.style.transform='scale(0.95)';"
              ontouchend="this.style.transform='scale(1)';"
              title="${t`${"free_colors_only"}`}">💧</button>
      ${ownedColorsButtonHTML}
      ${disableUnusedButtonHTML}
      ${sortOrderSelectHTML}
      ${enhancedSelectHTML}
      ${showUnplacedOnlyToggleHTML}
      ${overlayModeSelectHTML}
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
