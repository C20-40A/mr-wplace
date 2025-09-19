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
      if (document.querySelector(config.selector)) return;
      const container = document.querySelector(config.containerSelector);
      if (container) config.create(container);
    });
  };

  const observer = new MutationObserver(() => {
    ensureButtons();
  });

  // document_end なので即座に実行可能
  observer.observe(document.body, { childList: true, subtree: true });
  ensureButtons();
}
