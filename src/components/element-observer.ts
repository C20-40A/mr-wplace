export interface ElementConfig {
  id: string;
  getTargetElement: () => Element | null;
  createElement: (element: Element) => void;
}

/**
 * Elementを監視して、存在しない場合に生成する
 */
export const setupElementObserver = (configs: ElementConfig[]): void => {
  const existingIds = new Set<string>();

  const renderMissingItems = () => {
    configs.forEach((config) => {
      if (existingIds.has(config.id)) return;

      const target = config.getTargetElement();
      if (!target) return;

      // IDを使って要素を検索し、既に存在する場合はスキップ
      if (target.querySelector(`#${config.id}`)) {
        existingIds.add(config.id);
        return;
      }

      config.createElement(target);
      existingIds.add(config.id);
    });

    if (existingIds.size === configs.length) {
      observer.disconnect();
    }
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
