import { t } from "@/i18n/manager";
import type { EnhancedMode } from "@/types/image";
import {
  SHOW_UNPLACED_ONLY_ICON_SVG,
  createEnhancedModeIcons,
} from "@/assets/enhanced-mode-icons";
import type { SortOrder } from "../types";
import type { ComputeDevice } from "../storage";
import {
  ENHANCED_MODE_OPTIONS,
  SORT_ORDER_OPTIONS,
  getEnhancedModeLabelKey,
} from "../utils";
import {
  buildDropdownItems,
  getCommonBaseStyle,
  getDropdownTriggerBaseStyle,
  HANDLERS_BORDER_HOVER,
  HANDLERS_SCALE_95,
  HANDLERS_SCALE_98,
  INTERACTIVE_BASE_STYLE,
  rgbToHex,
} from "./shared";

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
              style="${getDropdownTriggerBaseStyle(isXs)}"
              ${HANDLERS_BORDER_HOVER("#d1d5db")}
              ${HANDLERS_SCALE_98}>
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
                  z-index: 1000;
                  min-width: ${isXs ? "150px" : "180px"};
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="sort-order-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${buildDropdownItems({
            options: SORT_ORDER_OPTIONS,
            isXs,
            selected: (option) => sortOrder === option.value,
            itemClass: "sort-order-item",
            dataAttr: "data-sort",
            getValue: (option) => option.value,
            getLabel: (option) => t`${option.labelKey}`,
            padding: { xs: "0.35rem 0.5rem", default: "0.5rem 0.75rem" },
          })}
        </div>
      </div>
    </div>
  `;
}

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
              style="${getDropdownTriggerBaseStyle(isXs, true)}"
              ${HANDLERS_BORDER_HOVER("#d1d5db")}
              ${HANDLERS_SCALE_98}>
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
                  z-index: 1000;
                  animation: slideDown 0.2s ease-out;
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
                             ${INTERACTIVE_BASE_STYLE}"
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
                         ${INTERACTIVE_BASE_STYLE}"
                  ${HANDLERS_BORDER_HOVER(
                    selectedColorOnlyMark ? "#22c55e" : "#d1d5db",
                  )}
                  ${HANDLERS_SCALE_95}>${t("selected_color_only_mark")}</button>
        </div>
      </div>
    </div>
  `;
}

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
              style="${getDropdownTriggerBaseStyle(isXs)}"
              ${HANDLERS_BORDER_HOVER("#d1d5db")}
              ${HANDLERS_SCALE_98}>
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
                  z-index: 1000;
                  min-width: ${isXs ? "90px" : "100px"};
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="compute-device-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${buildDropdownItems({
            options: devices,
            isXs,
            selected: (device) => computeDevice === device.value,
            itemClass: "compute-device-item",
            dataAttr: "data-device",
            getValue: (device) => device.value,
            getLabel: (device) => device.label,
            getIcon: (device) =>
              `<span style="font-size: ${isXs ? "0.85rem" : "1rem"}; filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));">${device.icon}</span>`,
            padding: { xs: "0.15rem 0.3rem", default: "0.2rem 0.4rem" },
          })}
        </div>
      </div>
    </div>
  `;
}

export function buildOverlayModeSelectHtml(
  enabled: boolean,
  lightweightMode: boolean = false,
  controlSize: "default" | "xs" = "default",
): string {
  const isXs = controlSize === "xs";
  const layerIconSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; flex-shrink: 0;">
      <path d="M12 3l9 4.5-9 4.5-9-4.5L12 3z"/>
      <path d="M3 12l9 4.5 9-4.5"/>
      <path d="M3 16.5L12 21l9-4.5"/>
    </svg>
  `.trim();
  const options: Array<{
    value: "true" | "false" | "false-lite";
    labelKey: string;
    descriptionKey: string;
  }> = [
    {
      value: "true",
      labelKey: "popup_overlay_mode_layer",
      descriptionKey: "popup_overlay_mode_layer_detail",
    },
    {
      value: "false",
      labelKey: "popup_overlay_mode_composite",
      descriptionKey: "popup_overlay_mode_composite_detail",
    },
    {
      value: "false-lite",
      labelKey: "popup_overlay_mode_composite_lite",
      descriptionKey: "popup_overlay_mode_composite_lite_detail",
    },
  ];
  const currentOption = options.find((o) => {
    if (enabled) return o.value === "true";
    if (lightweightMode) return o.value === "false-lite";
    return o.value === "false";
  });
  const currentLabelKey = currentOption?.labelKey ?? "popup_overlay_mode_layer";

  return `
    <div class="overlay-mode-container" style="position: relative;">
      <button class="overlay-mode-button" type="button"
              data-tip="${t("popup_overlay_mode")}"
              title="${t("popup_overlay_mode")}"
              style="${getDropdownTriggerBaseStyle(isXs)}"
              ${HANDLERS_BORDER_HOVER("#d1d5db")}
              ${HANDLERS_SCALE_98}>
        <span style="display: flex; align-items: center; color: #22c55e;">${layerIconSvg}</span>
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
                  z-index: 1000;
                  min-width: ${isXs ? "150px" : "180px"};
                  animation: slideDown 0.2s ease-out;
                  transform-origin: top;
                  backdrop-filter: blur(10px);">
        <div class="overlay-mode-list" style="display: flex; flex-direction: column; gap: 0.25rem;">
          ${buildDropdownItems({
            options,
            isXs,
            selected: (option) => {
              if (enabled) return option.value === "true";
              if (lightweightMode) return option.value === "false-lite";
              return option.value === "false";
            },
            itemClass: "overlay-mode-item",
            dataAttr: "data-overlay-mode",
            getValue: (option) => option.value,
            getLabel: (option) => t`${option.labelKey}`,
            getDescription: (option) => t`${option.descriptionKey}`,
            padding: { xs: "0.35rem 0.5rem", default: "0.5rem 0.75rem" },
          })}
        </div>
      </div>
    </div>
  `;
}

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
            style="${getCommonBaseStyle(isXs)}
                   padding: ${isXs ? "0 0.45rem" : "0 0.6rem"};
                   border: 2px solid ${borderColor};
                   gap: 0.5rem;
                   background-color: ${bgColor};
                   color: ${textColor};"
            onmouseenter=" this.style.transform='translateY(-1px)';"
            onmouseleave=" this.style.transform='translateY(0)';"
            ${HANDLERS_SCALE_95}>
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
