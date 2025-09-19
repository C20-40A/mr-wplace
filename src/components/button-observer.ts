export interface ButtonConfig {
  id: string;
  selector: string;
  containerSelector: string;
  create: (container: Element) => void;
}

/**
 * ボタン監視セットアップ（関数型・シンプル実装）
 */
export function setupButtonObserver(configs: ButtonConfig[]): void {
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

  const observer = new MutationObserver(() => {
    ensureButtons();
  });

  const init = () => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, { childList: true, subtree: true });
        ensureButtons();
      });
    } else {
      observer.observe(document.body, { childList: true, subtree: true });
      ensureButtons();
    }
  };

  init();
}
