export const findOpacityContainer = (): Element | null => {
  // 1. opacity button検索 → 親要素取得
  // NOTE: EN."Toggle art opacity"  PT."Alterar opacidade"
  const opacityButton = document.querySelector(
    'button[title="Toggle art opacity"], button[title="Alterar opacidade"]'
  );
  if (opacityButton?.parentElement) return opacityButton.parentElement;

  // 2. container直接検索
  const container = document.querySelector(".absolute.bottom-3.left-3.z-30");
  if (container) return container;

  // 3. 見つからない場合は作る
  const containerId = "mr-wplace-bottom-left-container";
  // もし既に同じIDの要素があれば追加しない
  const existingContainer = document.querySelector(`#${containerId}`);
  if (existingContainer) return existingContainer;
  // absoluteで左下に配置
  const newContainer = document.createElement("div");
  newContainer.className = "absolute left-3 z-30 flex flex-col gap-1";
  newContainer.style.bottom = "4.5rem";
  newContainer.id = containerId;
  document.body.appendChild(newContainer);
  return newContainer;
};



export const findPositionModal = (): Element | null => {
  // 1. classのstyleで検索
  const positionModal = document.querySelector(
    ".absolute.bottom-0.left-0.z-50.w-full.sm\\:left-1\\/2.sm\\:max-w-md.sm\\:-translate-x-1\\/2.md\\:max-w-lg"
  );
  if (positionModal) return positionModal;

  // 2. modalの中身で検索
  const modalContent = document.querySelector(
    ".rounded-t-box.bg-base-100.border-base-300.sm\\:rounded-b-box.w-full.border-t.pt-2.sm\\:mb-3.sm\\:shadow-xl"
  );
  if (modalContent?.parentElement) return modalContent.parentElement;

  return null;

  // 見つからない場合は作る
  // Modalはdynamicに出たり消えたりするので、ここでは作らない
  // {
  //   const modalId = "mr-wplace-position-modal";
  //   // もし既に同じIDの要素があれば追加しない
  //   const existingModal = document.querySelector(`#${modalId}`);
  //   if (existingModal) return existingModal;
  //   // absoluteで上部中央に配置
  //   const newModal = document.createElement("div");
  //   newModal.className =
  //     "absolute top-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 rounded-lg";
  //   newModal.id = modalId;
  //   document.body.appendChild(newModal);
  //   return newModal;
  // }
};

export const findTopLeftControls = (): Element | null => {
  // 1. titleベース検索（多言語対応）
  // EN: "Info", "Zoom in", "Zoom out"
  // PT: "Informações", "Aumentar zoom", "Diminuir zoom"
  const infoButton = document.querySelector(
    'button[title="Info"], button[title="Informações"]'
  );
  if (infoButton?.parentElement?.parentElement) {
    return infoButton.parentElement.parentElement; // .flex.flex-col.gap-3
  }

  // 2. classベース検索
  const topLeftContainer = document.querySelector(
    ".absolute.left-2.top-2.z-30.flex.flex-col.gap-3"
  );
  if (topLeftContainer) return topLeftContainer;

  // 3. 構造的検索 (左上のz-30要素)
  const leftTopElements = document.querySelectorAll(".absolute.left-2.top-2.z-30");
  for (const element of leftTopElements) {
    if (element.querySelector('button[title*="Info"], button[title*="Informações"]')) {
      return element;
    }
  }

  // 4. 見つからない場合は新規作成
  const containerId = "mr-wplace-top-left-container";
  const existingContainer = document.querySelector(`#${containerId}`);
  if (existingContainer) return existingContainer;

  const newContainer = document.createElement("div");
  newContainer.className = "absolute left-2 z-30 flex flex-col gap-1";
  newContainer.style.top = "5.5rem"; // 既存コントロールの下に配置
  newContainer.id = containerId;
  document.body.appendChild(newContainer);
  return newContainer;
};
