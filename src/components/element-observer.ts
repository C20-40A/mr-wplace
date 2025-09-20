export interface ElementConfig {
  id: string;
  getTargetElement: () => Element | null;
  createElement: (element: Element) => void;
}

/**
 * Elementを監視して、存在しない場合に生成する
 */
export const setupElementObserver = (configs: ElementConfig[]): void => {
  const renderMissingItems = () => {
    configs.forEach((config) => {
      // IDを使って要素を検索し、既に存在する場合はスキップ
      if (document.querySelector(`#${config.id}`)) return;

      const getTargetElement = config.getTargetElement();
      if (!getTargetElement) return;
      config.createElement(getTargetElement);

      // 新しく作成された要素をIDで特定し、IDを設定
      const createdElement = getTargetElement.querySelector(`#${config.id}`);
      if (createdElement) createdElement.id = config.id;
    });
  };

  const observer = new MutationObserver(() => {
    // TODO: debounce
    renderMissingItems();
  });

  // document_end なので即座に実行可能
  observer.observe(document.body, { childList: true, subtree: true });
  renderMissingItems();
};
