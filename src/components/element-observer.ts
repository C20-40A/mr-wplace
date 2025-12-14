export interface ElementConfig {
  id: string;
  getTargetElement: () => Element | null;
  createElement: (element: Element) => void;
}

/**
 * Elementを監視して、存在しない場合に生成する
 * 要素が削除された場合も再生成する
 */
export const setupElementObserver = (configs: ElementConfig[]): void => {
  const renderMissingItems = () => {
    configs.forEach((config) => {
      // IDを使って要素を検索し、既に存在する場合はスキップ
      if (document.querySelector(`#${config.id}`)) return;

      const target = config.getTargetElement();
      if (!target) return;

      config.createElement(target);
    });
  };

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      renderMissingItems();
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
  renderMissingItems();
};
