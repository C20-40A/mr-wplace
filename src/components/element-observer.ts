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
  const createdElements = new Map<string, Element>();

  const renderMissingItems = () => {
    configs.forEach((config) => {
      const existing = createdElements.get(config.id);
      // element.isConnected はO(1)でDOMクエリ不要
      if (existing?.isConnected) return;

      const target = config.getTargetElement();
      if (!target) return;

      config.createElement(target);

      // 作成された要素の参照を保持
      const created = document.getElementById(config.id);
      if (created) createdElements.set(config.id, created);
    });
  };

  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    // 全要素が作成済み && removedNodesがない場合はスキップ
    if (createdElements.size === configs.length) {
      const hasRemovals = mutations.some((m) => m.removedNodes.length > 0);
      if (!hasRemovals) return;
    }

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
