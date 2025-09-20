const findOpacityContainer = (): Element | null => {
  // 1. opacity button検索 → 親要素取得
  const opacityButton = document.querySelector(
    'button[title="Toggle art opacity"]'
  );
  if (opacityButton?.parentElement) return opacityButton.parentElement;

  // 2. container直接検索
  const container = document.querySelector(".absolute.bottom-3.left-3.z-30");
  if (container) return container;

  return null;
};

const findPositionModal = (): Element | null => {
  const positionModal = document.querySelector(
    ".absolute.bottom-0.left-0.z-50.w-full.sm\\:left-1\\/2.sm\\:max-w-md.sm\\:-translate-x-1\\/2.md\\:max-w-lg"
  );
  if (positionModal) return positionModal;

  return null;
};

export const SELECTORS = {
  toggleOpacityContainer: findOpacityContainer,
  positionModal: findPositionModal,
};
