import { colorpalette } from "@/constants/colors";
import type { ColorPaletteOptions } from "../types";
import {
  CURRENTLY_SELECTED_ICON_HTML,
  DISABLED_BADGE_HTML,
  ENABLED_BADGE_HTML,
  createStatsHtml,
  getColorKey,
  getContrastTextColor,
} from "../utils";
import { INTERACTIVE_BASE_STYLE } from "./shared";

export function buildColorGrid(
  selectedColorIds: Set<number>,
  currentlySelectedColorId: number | null,
  sortedColors: typeof colorpalette,
  options: ColorPaletteOptions,
): string {
  const isXs = options.controlSize === "xs";

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
        <div class="color-item cursor-pointer ${isXs ? "p-1" : "p-2"} font-medium flex flex-col items-center justify-center min-h-[3rem]"
             style="background-color: ${backgroundColor};
                    color: ${textColor};
                    border-color: ${borderColor};
                    position: relative;
                    border-radius: 0.5rem;
                    border-style: solid;
                    border-width: 3px;
                    font-size: ${isXs ? "0.6rem" : "0.75rem"};
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: scale(1);
                    cursor: pointer;
                    ${INTERACTIVE_BASE_STYLE}"
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
