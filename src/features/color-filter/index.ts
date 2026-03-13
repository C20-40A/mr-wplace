import { setupElementObserver } from "../../components/element-observer";
import { findOpacityContainer } from "../../constants/selectors";
import { ColorFilterRouter } from "./router";
import {
  ColorFilterModal,
  createColorFilterFAB,
  updateColorFilterBadges,
} from "./ui";
import { renderColorFilters } from "./routes/list";
import { showFeatureHint } from "../feature-hints";

/**
 * カラーフィルター機能
 * - 色パレット表示・選択
 */
export class ColorFilter {
  private static instance: ColorFilter | null = null;
  private colorFilterModal: ColorFilterModal;
  private router: ColorFilterRouter;

  constructor() {
    this.router = new ColorFilterRouter();
    this.colorFilterModal = new ColorFilterModal(this.router);
    ColorFilter.instance = this;
    this.init();
  }

  public static getInstance(): ColorFilter | null {
    return ColorFilter.instance;
  }

  private init(): void {
    this.router.setOnRouteChange((route) => {
      this.renderCurrentRoute(route);
    });

    setupElementObserver([
      {
        id: "color-filter-fab-btn",
        getTargetElement: findOpacityContainer,
        createElement: (container) => {
          const button = createColorFilterFAB();
          button.id = "color-filter-fab-btn"; // 重複チェック用ID設定
          button.addEventListener("click", () => this.showModal());
          container.className += " flex flex-col-reverse gap-1";
          container.appendChild(button);
          showFeatureHint("blue-marble-color-palette", button);
          const mgr = window.mrWplace?.colorFilterManager;
          if (mgr) {
            button.style.filter =
              mgr.selectedRGBs.length === 0 ? "grayscale(1)" : "";
            this.refreshFABBadge();
          }
        },
      },
    ]);
  }

  private async renderCurrentRoute(route: string): Promise<void> {
    const container = this.colorFilterModal.getContainer();
    if (!container) return;

    switch (route) {
      case "color-filter":
        await renderColorFilters(container);
        break;
    }
  }

  public showModal(): void {
    this.colorFilterModal.showModal(); // モーダルを先に作成
    this.router.initialize("color-filter");
  }

  public hideModal(): void {
    this.colorFilterModal.closeModal();
  }

  public refreshFABBadge(): void {
    const mgr = window.mrWplace?.colorFilterManager;
    if (!mgr) return;
    const rgbs = mgr.selectedRGBs;
    updateColorFilterBadges(rgbs.length === 1 ? rgbs[0] : null);
  }
}
