export interface ElementConfig {
  id: string;
  selector: string;
  containerSelector: string;
  create: (container: Element) => void;
}

/**
 * Elementを監視して、存在しない場合に生成する
 */
export const setupElementObserver = (configs: ElementConfig[]): void => {
  const renderMissingItems = () => {
    configs.forEach((config) => {
      if (document.querySelector(config.selector)) return;
      const container = document.querySelector(config.containerSelector);
      if (container) config.create(container);
    });
  };

  const observer = new MutationObserver(() => {
    renderMissingItems();
  });

  // document_end なので即座に実行可能
  observer.observe(document.body, { childList: true, subtree: true });
  renderMissingItems();
};
