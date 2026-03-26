import type { EnhancedMode } from "@/types/image";
import { t } from "@/i18n/manager";
import type { ComputeDevice } from "../storage";
import type { SortOrder } from "../types";
import { getCommonBaseStyle, HANDLERS_SCALE_95 } from "./shared";
import {
  buildComputeDeviceSelectHtml,
  buildEnhancedSelectHtml,
  buildOverlayModeSelectHtml,
  buildShowUnplacedOnlyToggleHtml,
  buildSortOrderSelectHtml,
} from "./selects";

export function buildControlsHtml(
  hasExtraColorsBitmap: boolean,
  showColorStats: boolean,
  showEnhancedSelect: boolean,
  showOverlayModeSelect: boolean,
  showComputeDeviceSelect: boolean,
  sortOrder: SortOrder,
  enhancedMode: EnhancedMode,
  overlayMode: boolean,
  overlayLightweightMode: boolean,
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
  ${getCommonBaseStyle(isXs)}
  padding: ${isXs ? "0 0.6rem" : "0 1.25rem"};
  font-size: ${isXs ? "0.75rem" : "0.875rem"};
  font-weight: 500;
`;

  const iconButtonBaseStyle = `
  ${getCommonBaseStyle(isXs)}
  width: ${isXs ? "1.8rem" : "2.25rem"};
  min-width: ${isXs ? "1.8rem" : "2.25rem"};
  padding: 0;
  font-size: ${isXs ? "0.9rem" : "1rem"};
  font-weight: 700;
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
                      color: var(--color-secondary, #9333ea);"
               onmouseenter="this.style.backgroundColor='var(--color-base-300, #f0f0f0)';"
               onmouseleave="this.style.backgroundColor='transparent';"
               ${HANDLERS_SCALE_95}>${t`${"owned_colors_only"}`}</button>`
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
    ? buildOverlayModeSelectHtml(
        overlayMode,
        overlayLightweightMode,
        controlSize,
      )
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
                      color: var(--color-warning, #f59e0b);"
               onmouseenter="this.style.backgroundColor='var(--color-base-300, #f0f0f0)'; this.style.color='var(--color-warning, #f59e0b)';"
               onmouseleave="this.style.backgroundColor='transparent'; this.style.color='var(--color-warning, #f59e0b)';"
               ${HANDLERS_SCALE_95}>${t`${"disable_unused_colors"}`}</button>`
    : "";

  return `
    <div class="color-palette-controls flex flex-wrap gap-2 px-4 pb-2">
      <button class="enable-all-btn btn btn-outline ${sizeClass} rounded-full"
              style="${buttonBaseStyle}
                     background: linear-gradient(145deg, #4ade80 0%, #22c55e 55%, #16a34a 100%);
                     border: 2px solid #15803d;
                     color: #fff;"
              onmouseenter="this.style.filter='brightness(1.05)'; this.style.transform='translateY(-1px)';"
              onmouseleave="this.style.filter='brightness(1)'; this.style.transform='translateY(0)';"
              ${HANDLERS_SCALE_95}
              title="${t`${"enable_all"}`}">${enableAllIconSvg}${t("all_short")}</button>
      <button class="disable-all-btn btn btn-outline ${sizeClass} rounded-full"
              style="${iconButtonBaseStyle}
                     background: linear-gradient(145deg, #f87171 0%, #ef4444 55%, #dc2626 100%);
                     border: 2px solid #b91c1c;
                     color: #fff;"
              onmouseenter="this.style.filter='brightness(1.05)'; this.style.transform='translateY(-1px)';"
              onmouseleave="this.style.filter='brightness(1)'; this.style.transform='translateY(0)';"
              ${HANDLERS_SCALE_95}
              title="${t`${"disable_all"}`}">${disableAllIconSvg}</button>
      <button class="free-colors-btn btn btn-outline ${sizeClass} rounded-full"
              style="${iconButtonBaseStyle}
                     border: 2px solid var(--color-info, #2563eb);
                     color: var(--color-info, #2563eb);"
              onmouseenter="this.style.backgroundColor='var(--color-base-300, #f0f0f0)';"
              onmouseleave="this.style.backgroundColor='transparent';"
              ${HANDLERS_SCALE_95}
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
