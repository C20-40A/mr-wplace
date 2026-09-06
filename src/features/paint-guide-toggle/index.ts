import { setupElementObserver } from "@/components/element-observer";
import { getPaintToolbarContainer } from "@/features/paint-toolbar";
import {
  loadPaintGuideFromStorage,
  getPaintGuide,
  setPaintGuide,
} from "@/states/paint-guide";
import { t } from "@/i18n";

const BUTTON_ID = "paint-guide-toggle-btn";

const ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M8 12.5l2.5 2.5L16 9.5"/>
  </svg>
`;

/** paint toolbar から テンプレ一致インジケーター(paint guide) を ON/OFF する */
export class PaintGuideToggle {
  private button: HTMLButtonElement | null = null;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    await loadPaintGuideFromStorage();
    setupElementObserver([
      {
        id: BUTTON_ID,
        getTargetElement: getPaintToolbarContainer,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip tooltip-bottom";
          tooltip.setAttribute("data-tip", t("popup_paint_guide"));

          this.button = document.createElement("button");
          this.button.id = BUTTON_ID;
          this.button.type = "button";
          this.button.className = "btn btn-sm btn-circle btn-ghost";
          this.button.innerHTML = ICON;
          this.button.addEventListener("click", () => void this.toggle());

          tooltip.appendChild(this.button);
          container.appendChild(tooltip);
          this.updateButton(getPaintGuide());
          console.log("🧑‍🎨 : Paint guide toggle button added");
        },
      },
    ]);
  }

  private updateButton(enabled: boolean): void {
    if (!this.button) return;
    this.button.classList.toggle("text-primary", enabled);
    this.button.classList.toggle("text-base-content", !enabled);
    this.button.style.opacity = enabled ? "1" : "0.5";
  }

  private async toggle(): Promise<void> {
    const enabled = !getPaintGuide();
    await setPaintGuide(enabled);
    window.postMessage(
      { source: "mr-wplace-paint-guide-update", enabled },
      "*",
    );
    this.updateButton(enabled);
    console.log("🧑‍🎨 : Paint guide toggled:", enabled);
  }
}
