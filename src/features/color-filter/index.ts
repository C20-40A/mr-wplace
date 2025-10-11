import { setupElementObserver } from "../../components/element-observer";
import { findOpacityContainer } from "../../constants/selectors";
import { ColorFilterRouter } from "./router";
import { ColorFilterModal, createColorFilterFAB } from "./ui";
import { renderColorFilters } from "./routes/list";

/**
 * カラーフィルター機能
 * - 色パレット表示・選択
 */
export class ColorFilter {
  private colorFilterModal: ColorFilterModal;
  private router: ColorFilterRouter;

  constructor() {
    this.router = new ColorFilterRouter();
    this.colorFilterModal = new ColorFilterModal(this.router);
    this.init();
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

  private showModal(): void {
    this.router.initialize("color-filter");
    this.colorFilterModal.showModal();
  }

  public hideModal(): void {
    this.colorFilterModal.closeModal();
  }
}
