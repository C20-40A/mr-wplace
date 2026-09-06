export interface ElementConfig {
  id: string;
  getTargetElement: () => Element | null;
  createElement: (element: Element) => void;
}

interface ObserverGroup {
  configs: ElementConfig[];
  createdElements: Map<string, Element>;
}

const observerGroups: ObserverGroup[] = [];
let sharedObserver: MutationObserver | null = null;
let renderScheduled = false;

const renderMissingItems = (group: ObserverGroup): void => {
  group.configs.forEach((config) => {
    const existing = group.createdElements.get(config.id);
    // element.isConnected はO(1)でDOMクエリ不要
    if (existing?.isConnected) return;

    // Another observer group may already have created the same id. Reuse it
    // instead of adding duplicate DOM ids when a feature is initialized twice.
    const existingInDocument = document.getElementById(config.id);
    if (existingInDocument) {
      group.createdElements.set(config.id, existingInDocument);
      return;
    }

    const target = config.getTargetElement();
    if (!target) return;

    config.createElement(target);

    // 作成された要素の参照を保持
    const created = document.getElementById(config.id);
    if (created) group.createdElements.set(config.id, created);
  });
};

const renderAllGroups = (): void => {
  observerGroups.forEach(renderMissingItems);
};

const scheduleRenderAllGroups = (): void => {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderAllGroups();
  });
};

const shouldRenderGroup = (
  group: ObserverGroup,
  mutations: MutationRecord[],
): boolean => {
  if (group.createdElements.size !== group.configs.length) return true;
  return mutations.some((mutation) => mutation.removedNodes.length > 0);
};

const ensureSharedObserver = (): void => {
  if (sharedObserver) return;

  sharedObserver = new MutationObserver((mutations) => {
    if (!observerGroups.some((group) => shouldRenderGroup(group, mutations))) {
      return;
    }

    scheduleRenderAllGroups();
  });

  sharedObserver.observe(document.body, { childList: true, subtree: true });
};

/**
 * Elementを監視して、存在しない場合に生成する
 * 要素が削除された場合も再生成する
 */
export const setupElementObserver = (configs: ElementConfig[]): void => {
  const group: ObserverGroup = {
    configs,
    createdElements: new Map(),
  };

  observerGroups.push(group);
  ensureSharedObserver();
  renderMissingItems(group);
};
