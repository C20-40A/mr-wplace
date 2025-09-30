import { Router } from "../utils/router";
import { createModal, ModalElements } from "../utils/modal";

export interface ModalConfig {
  id: string;
  title: string;
  maxWidth?: string;
}

/**
 * Modal UI統一基盤クラス
 */
export abstract class BaseModalUI<T extends Router<any>> {
  protected modalElements!: ModalElements;
  protected router: T;

  constructor(router: T) {
    this.router = router;
    this.createModal();
  }

  abstract getModalConfig(): ModalConfig;

  private createModal(): void {
    const config = this.getModalConfig();
    this.modalElements = createModal({
      id: config.id,
      title: config.title,
      hasBackButton: false,
      maxWidth: config.maxWidth,
      onBack: () => this.router.navigateBack(),
    });

    this.router.setHeaderElements(
      this.modalElements.titleElement,
      this.modalElements.backButton
    );
  }

  showModal(): void {
    this.modalElements.modal.showModal();
  }

  closeModal(): void {
    this.modalElements.modal.close();
  }

  getContainer(): HTMLElement | null {
    return this.modalElements.container;
  }
}
