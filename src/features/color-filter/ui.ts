import { t } from "@/i18n/manager";
import { ColorFilterRouter } from "./router";
import { createModal, ModalElements } from "@/components/modal";
import { IMG_ICON_COLOR_FILTER } from "../../assets/iconImages";

const BADGE_POSITION_STYLE =
  "position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;pointer-events:none;";
const BADGE_BORDER_STYLE = "border:1.5px solid rgba(255,255,255,0.7);";
const DISABLED_OVERLAY_POSITION_STYLE =
  "position:absolute;top:0px;right:0px;width:15px;height:15px;border-radius:50%;pointer-events:none;";
const DISABLED_OVERLAY_CLASS = "color-filter-disabled-overlay";
const DISABLED_OVERLAY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:15px;height:15px;">
  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
  <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"></path>
  <path d="M3.5 20.5L20.5 3.5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" fill="none"></path>
</svg>`;
const DISABLED_OVERLAY_STYLE = `${DISABLED_OVERLAY_POSITION_STYLE}${BADGE_BORDER_STYLE}background:rgba(255,255,255,0.92);align-items:center;justify-content:center;color:rgba(0,0,0,0.72);overflow:hidden;`;

export const createColorFilterFAB = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "color-filter-fab-btn";
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30 relative";
  button.title = t`${"color_filter"}`;
  button.innerHTML = `<img src="${IMG_ICON_COLOR_FILTER}" alt="${t`${"color_filter"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">`;
  return button;
};

const COLOR_BADGE_CLASS = "color-filter-badge";

const updateColorBadge = (
  parent: HTMLElement,
  rgb: [number, number, number] | null,
): void => {
  let badge = parent.querySelector<HTMLSpanElement>(`.${COLOR_BADGE_CLASS}`);

  if (!rgb) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.className = COLOR_BADGE_CLASS;
    badge.style.cssText = `${BADGE_POSITION_STYLE}${BADGE_BORDER_STYLE}`;
    parent.appendChild(badge);
  }

  badge.style.backgroundColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
};

const updateDisabledOverlay = (
  parent: HTMLElement,
  disabled: boolean,
): void => {
  let overlay = parent.querySelector<HTMLSpanElement>(
    `.${DISABLED_OVERLAY_CLASS}`,
  );

  if (!disabled) {
    overlay?.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement("span");
    overlay.className = DISABLED_OVERLAY_CLASS;
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText = `display:flex;${DISABLED_OVERLAY_STYLE}`;
    overlay.innerHTML = DISABLED_OVERLAY_ICON;
    parent.appendChild(overlay);
  }
};

/** FAB + PaintPixelIcon の両方のバッジを更新 */
export const COLOR_BADGE_TARGETS = [
  "color-filter-fab-btn",
  "paint-pixel-icon-h2",
] as const;

export const updateColorFilterBadges = (
  rgb: [number, number, number] | null,
  disabled = false,
): void => {
  for (const id of COLOR_BADGE_TARGETS) {
    const el = document.getElementById(id);
    if (!el) continue;
    updateColorBadge(el, rgb);
    if (id === "color-filter-fab-btn") updateDisabledOverlay(el, disabled);
  }
};

export class ColorFilterModal {
  private modalElements: ModalElements | null = null;

  constructor(private router: ColorFilterRouter) {}

  showModal(): void {
    this.modalElements = createModal({
      id: "wplace-studio-color-filter-modal",
      title: t`${"color_filter"}`,
      router: this.router,
    });

    this.modalElements.modal.showModal();
  }

  closeModal(): void {
    this.modalElements?.modal.close();
  }

  getContainer(): HTMLElement {
    if (!this.modalElements) {
      throw new Error("Modal not initialized. Call showModal() first.");
    }
    return this.modalElements.container;
  }
}
