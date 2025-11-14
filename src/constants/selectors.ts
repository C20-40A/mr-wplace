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

export const findPaintPixelControls = (): Element | null => {
  // "Toggle art opacity" ボタンの親要素を取得
  const opacityTooltip = document.querySelector('[data-tip="Toggle art opacity"]');
  if (opacityTooltip?.parentElement) return opacityTooltip.parentElement;
  
  // Paint pixel h2の親要素を取得
  const paintPixelHeaders = Array.from(document.querySelectorAll('h2'));
  const paintPixelHeader = paintPixelHeaders.find(
    h2 => h2.textContent?.includes('Paint pixel')
  );
  if (paintPixelHeader?.parentElement) return paintPixelHeader.parentElement;
  
  return null;
};

export const findColorPalette = (): Element | null => {
  // 色ボタンの最初の1つを取得し、その親の親の親を取得
  // <div class="grid ..."> <div class="tooltip"> <button id="color-X"> の構造を想定
  const firstColorButton = document.querySelector('button[id^="color-"]');
  if (firstColorButton?.parentElement?.parentElement) {
    return firstColorButton.parentElement.parentElement; // grid container
  }
  return null;
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

/**
 * マップピン（現在地マーカー）を検索
 * MapLibre GLの現在地マーカー（青いピン）のみを対象とする
 */
export const findMapPin = (): Element | null => {
  // すべてのmaplibregl-markerを取得
  const markers = document.querySelectorAll('.maplibregl-marker, .mapboxgl-marker');

  for (const marker of markers) {
    // 1. opacity: 1 のマーカーのみ（表示中）
    const style = (marker as HTMLElement).style;
    const opacity = style.opacity || '1';
    if (parseFloat(opacity) < 1) continue;

    // 2. 現在地マーカー（青いピン）のSVGを持つか確認
    const svg = marker.querySelector('svg[viewBox="0 0 27 41"]');
    if (!svg) continue;

    // 3. 青いピンの特徴的なpathを確認
    const bluePinPath = svg.querySelector('path[d^="M27,13.5"]');
    if (!bluePinPath) continue;

    // 4. 画面内の座標にあるか確認（translate値が妥当な範囲）
    const transform = style.transform || '';
    const translateMatch = transform.match(/translate\((-?\d+)px,\s*(-?\d+)px\)/);
    if (translateMatch) {
      const x = parseInt(translateMatch[1], 10);
      const y = parseInt(translateMatch[2], 10);

      // 画面サイズの範囲内か確認（マージン含む）
      if (x < -100 || x > window.innerWidth + 100 ||
          y < -100 || y > window.innerHeight + 100) {
        continue;
      }
    }

    // すべての条件を満たすマーカーを返す
    return marker;
  }

  return null;
};

/**
 * "My location" ボタンのコンテナを検索（右下）
 */
export const findMyLocationContainer = (): Element | null => {
  // 1. "My location" / "Minha localização" ボタンを検索 → 親要素取得
  const myLocationButton = document.querySelector(
    'button[title="My location"], button[title="Minha localização"]'
  );
  if (myLocationButton?.parentElement) return myLocationButton.parentElement;

  // 2. container直接検索
  const container = document.querySelector(".absolute.bottom-3.right-3.z-30");
  if (container) return container;

  // 3. 見つからない場合は新規作成
  const containerId = "mr-wplace-bottom-right-container";
  const existingContainer = document.querySelector(`#${containerId}`);
  if (existingContainer) return existingContainer;

  const newContainer = document.createElement("div");
  newContainer.className = "absolute bottom-3 right-3 z-30 flex flex-col gap-1";
  newContainer.id = containerId;
  document.body.appendChild(newContainer);
  return newContainer;
};
