import {
  registerPaintToolbarButton,
  setPaintToolbarButtonActive,
} from "@/features/paint-toolbar";
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
    registerPaintToolbarButton({
      id: BUTTON_ID,
      tip: t("popup_paint_guide"),
      icon: ICON,
      isActive: getPaintGuide,
      onClick: () => void this.toggle(),
      onCreate: (button) => {
        this.button = button;
        console.log("🧑‍🎨 : Paint guide toggle button added");
      },
    });
  }

  private async toggle(): Promise<void> {
    const enabled = !getPaintGuide();
    await setPaintGuide(enabled);
    window.postMessage({ source: "mr-wplace-paint-guide-update", enabled }, "*");
    if (this.button) setPaintToolbarButtonActive(this.button, enabled);
    console.log("🧑‍🎨 : Paint guide toggled:", enabled);
  }
}
