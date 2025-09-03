export interface ButtonConfig {
  id: string;
  selector: string;
  containerSelector: string;
  create: (container: Element) => void;
}

export class ButtonObserver {
  private observer: MutationObserver | null = null;

  startObserver(configs: ButtonConfig[]): void {
    const ensureButtons = () => {
      configs.forEach((config) => {
        if (!document.querySelector(config.selector)) {
          const container = document.querySelector(config.containerSelector);
          if (container) {
            config.create(container);
          }
        }
      });
    };

    this.observer = new MutationObserver(() => {
      ensureButtons();
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
    ensureButtons();
  }

  stopObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
