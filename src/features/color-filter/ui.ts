import { t } from "../../i18n/manager";
import { ColorFilterRouter } from "./router";
import { createModal, ModalElements } from "@/components/modal";
import { IMG_ICON_COLOR_FILTER } from "../../assets/iconImages";

export const createColorFilterFAB = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "color-filter-fab-btn";
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30 relative";
  button.title = t`${"color_filter"}`;
  button.innerHTML = `<img src="${IMG_ICON_COLOR_FILTER}" alt="${t`${"color_filter"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">`;
  return button;
};

const COLOR_BADGE_ID = "color-filter-fab-badge";

export const updateColorFilterFABBadge = (
  rgb: [number, number, number] | null
): void => {
  const button = document.getElementById("color-filter-fab-btn");
  if (!button) return;

  let badge = button.querySelector<HTMLSpanElement>(`#${COLOR_BADGE_ID}`);

  if (!rgb) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement("span");
    badge.id = COLOR_BADGE_ID;
    badge.style.cssText =
      "position:absolute;top:2px;right:2px;width:10px;height:10px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.7);pointer-events:none;";
    button.appendChild(badge);
  }

  badge.style.backgroundColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
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
