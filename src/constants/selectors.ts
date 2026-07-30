const escapeAttrValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const PAINT_OPACITY_TEXTS = [
  "Toggle art opacity", // 英語 (ste)
  "Alterar opacidade", // ポルトガル語 (lte) - 前回の "Alternar opacidade da arte" から変更
  "切换作品不透明度", // 中国語 (cte)
  "Art-Transparenz umschalten", // ドイツ語 (ute)
  "Alternar opacidad del arte", // スペイン語 (hte)
  "Basculer l’opacité de l’art", // フランス語 (dte)
  "Modifica opacità", // イタリア語 (pte)
  "アートの不透明度を切り替え", // 日本語 (fte)
  "Przełącz przezroczystość grafik", // ポーランド語 (_te)
  "Переключить непрозрачность арта", // ロシア語 (mte)
  "Перемкнути прозорість арту", // ウクライナ語 (gte)
  "Chuyển độ trong suốt của art", // ベトナム語 (vte)
] as const;

const PAINT_PIXEL_HEADER_TEXTS = [
  "Paint pixel", // 英語 (WN)
  "Pintar pixel", // ポルトガル語 ($N)
  "绘制像素", // 中国語 (HN)
  "Pixel malen", // ドイツ語 (XN)
  "Pintar píxel", // スペイン語 (YN)
  "Peindre un pixel", // フランス語 (KN)
  "Dipingere pixel", // イタリア語 (JN)
  "ピクセルを塗る", // 日本語 (QN)
  "Pomaluj piksel", // ポーランド語 (eV)
  "Нарисовать пиксель", // ロシア語 (tV)
  "Намалювати піксель", // ウクライナ語 (rV)
  "Tô pixel", // ベトナム語 (nV)
] as const;

const PAINT_OPACITY_TOOLTIP_SELECTOR = PAINT_OPACITY_TEXTS.map(
  (text) => `[data-tip="${escapeAttrValue(text)}"]`,
).join(", ");

let cachedPaintPixelControls: Element | null = null;

const isValidPaintControlsCache = (candidate: Element | null): boolean => {
  if (!candidate?.isConnected) return false;

  // Cached要素内にopacity tooltipが残っている場合のみキャッシュ有効とする
  return !!candidate.querySelector(PAINT_OPACITY_TOOLTIP_SELECTOR);
};

export const findOpacityContainer = (): Element | null => {
  // 1. "Toggle art opacity" の多言語テキストリスト
  // ste, lte, cte, ute, hte, dte, pte, fte, _te, mte, gte, vte に対応
  const opacityButtonTitles = [
    "Toggle art opacity", // 英語 (ste)
    "Alterar opacidade", // ポルトガル語 (lte)
    "切换作品不透明度", // 中国語 (cte)
    "Art-Transparenz umschalten", // ドイツ語 (ute)
    "Alternar opacidad del arte", // スペイン語 (hte)
    "Basculer l’opacité de l’art", // フランス語 (dte)
    "Modifica opacità", // イタリア語 (pte)
    "アートの不透明度を切り替え", // 日本語 (fte)
    "Przełącz przezroczystość grafik", // ポーランド語 (_te)
    "Переключить непрозрачность арта", // ロシア語 (mte)
    "Перемкнути прозорість арту", // ウクライナ語 (gte)
    "Chuyển độ trong suốt của art", // ベトナム語 (vte)
  ];

  // 1. opacity button検索 → 親要素取得（多言語対応）
  // すべての多言語タイトルを OR 検索文字列として結合
  const titleSelectors = opacityButtonTitles
    .map((title) => `button[title="${title}"]`)
    .join(", ");

  const opacityButton = document.querySelector(titleSelectors);

  if (opacityButton?.parentElement) {
    // ボタンの親要素（コンテナを想定）を返します。
    return opacityButton.parentElement;
  }

  // 2. container直接検索 (元のロジックを維持)
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
  newContainer.style.bottom = "4.5rem"; // 既存コントロールの下に配置
  newContainer.id = containerId;
  document.body.appendChild(newContainer);
  return newContainer;
};

export const findPositionModal = (): Element | null => {
  // 1. classのstyleで検索
  const positionModal = document.querySelector(
    ".absolute.bottom-0.left-0.z-50.w-full.sm\\:left-1\\/2.sm\\:max-w-md.sm\\:-translate-x-1\\/2.md\\:max-w-lg",
  );
  if (positionModal) return positionModal;

  // 2. modalの中身で検索
  const modalContent = document.querySelector(
    ".rounded-t-box.bg-base-100.border-base-300.sm\\:rounded-b-box.w-full.border-t.pt-2.sm\\:mb-3.sm\\:shadow-xl",
  );
  if (modalContent?.parentElement) return modalContent.parentElement;

  return null;
};

export const findPaintPixelControls = (): Element | null => {
  if (isValidPaintControlsCache(cachedPaintPixelControls)) {
    return cachedPaintPixelControls;
  }

  // A. "Toggle art opacity" ボタンの親要素を取得
  const opacityTooltip = document.querySelector(PAINT_OPACITY_TOOLTIP_SELECTOR);
  if (opacityTooltip?.parentElement) {
    cachedPaintPixelControls = opacityTooltip.parentElement;
    return cachedPaintPixelControls;
  }

  // B. Paint pixel h2の親要素を取得
  const paintPixelHeaders = Array.from(document.querySelectorAll("h2"));
  const paintPixelHeader = paintPixelHeaders.find((h2) =>
    PAINT_PIXEL_HEADER_TEXTS.some((text) => h2.textContent?.includes(text)),
  );

  if (paintPixelHeader?.parentElement) {
    cachedPaintPixelControls = paintPixelHeader.parentElement;
    return cachedPaintPixelControls;
  }

  cachedPaintPixelControls = null;
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
  // 1. "Info" ボタンの多言語テキストリスト
  // BE, FE, OE, qE, NE, VE, ZE, UE, GE, WE, $E, HE に対応
  const infoButtonTitles = [
    "Info", // 英語 (BE, qE, NE)
    "Informações", // ポルトガル語 (FE)
    "信息", // 中国語 (OE)
    "Infos", // フランス語/ドイツ語の可能性 (VE)
    "Informazioni", // イタリア語 (ZE)
    "情報", // 日本語 (UE)
    "Informacje", // ポーランド語 (GE)
    "Инфо", // ロシア語 (WE)
    "Інформація", // ウクライナ語 ($E)
    "Thông tin", // ベトナム語 (HE)
  ];

  // 1. titleベース検索（多言語対応）
  // すべての多言語タイトルを OR 検索文字列として結合
  const titleSelectors = infoButtonTitles
    .map((title) => `button[title="${title}"]`)
    .join(", ");

  const infoButton = document.querySelector(titleSelectors);

  if (infoButton?.parentElement) return infoButton.parentElement;

  // 2. classベース検索 (元のロジックを維持)
  const topLeftContainer = document.querySelector(
    ".absolute.left-2.top-2.z-30.flex.flex-col.gap-3",
  );
  if (topLeftContainer) return topLeftContainer;

  // 3. 構造的検索 (左上のz-30要素)
  // title属性の部分一致検索で、多言語すべてに対応させます。
  const partialTitleSelectors = infoButtonTitles
    .map((title) => `button[title*="${title}"]`)
    .join(", ");

  const leftTopElements = document.querySelectorAll(
    ".absolute.left-2.top-2.z-30",
  );
  for (const element of leftTopElements) {
    if (element.querySelector(partialTitleSelectors)) {
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
  const markers = document.querySelectorAll(
    ".maplibregl-marker, .mapboxgl-marker",
  );

  for (const marker of markers) {
    // 1. opacity: 1 のマーカーのみ（表示中）
    const style = (marker as HTMLElement).style;
    const opacity = style.opacity || "1";
    if (parseFloat(opacity) < 1) continue;

    // 2. 現在地マーカー（青いピン）のSVGを持つか確認
    const svg = marker.querySelector('svg[viewBox="0 0 27 41"]');
    if (!svg) continue;

    // 3. 青いピンの特徴的なpathを確認
    const bluePinPath = svg.querySelector('path[d^="M27,13.5"]');
    if (!bluePinPath) continue;

    // 4. 画面内の座標にあるか確認（translate値が妥当な範囲）
    const transform = style.transform || "";
    const translateMatch = transform.match(
      /translate\((-?\d+)px,\s*(-?\d+)px\)/,
    );
    if (translateMatch) {
      const x = parseInt(translateMatch[1], 10);
      const y = parseInt(translateMatch[2], 10);

      // 画面サイズの範囲内か確認（マージン含む）
      if (
        x < -100 ||
        x > window.innerWidth + 100 ||
        y < -100 ||
        y > window.innerHeight + 100
      ) {
        continue;
      }
    }

    // すべての条件を満たすマーカーを返す
    return marker;
  }

  return null;
};

const MY_LOCATION_BUTTON_TITLES = [
  "My location", // 英語 (d7)
  "Minha localização", // ポルトガル語 (p7)
  "我的位置", // 中国語 (f7)
  "Mein Standort", // ドイツ語 (_7)
  "Mi ubicación", // スペイン語 (m7)
  "Ma position", // フランス語 (g7)
  "La mia posizione", // イタリア語 (v7)
  "現在地", // 日本語 (y7)
  "Moja lokalizacja", // ポーランド語 (x7)
  "Моё местоположение", // ロシア語 (b7)
  "Моє місцезнаходження", // ウクライナ語 (w7)
  "Vị trí của tôi", // ベトナム語 (T7)
] as const;

const myLocationTitleSelector = MY_LOCATION_BUTTON_TITLES
  .map((title) => `button[title="${title}"]`)
  .join(", ");

/**
 * "My location" ボタン自体を検索
 */
export const findMyLocationButton = (): Element | null =>
  document.querySelector(myLocationTitleSelector);

/**
 * Share placeモーダルのURL入力コンテナを検索
 * 構造: .modal-box > div(border-2 + input[readonly] + button.btn-primary)
 */
export const findShareModalUrlContainer = (
  modalBox: Element,
): HTMLElement | null => {
  const input = modalBox.querySelector("input[readonly]");
  if (!input?.parentElement) return null;
  const container = input.parentElement;
  if (container.querySelector(".btn-primary")) return container as HTMLElement;
  return null;
};

/**
 * ペイント確定ボタン(Paint)のコンテナを検索
 *
 * 構造: <div class="absolute bottom-0 left-1/2 -translate-x-1/2">
 *         <button class="btn ... btn-primary">...Paint...</button>
 *       </div>
 * 下書きモード中はこのコンテナごと隠し、代わりに保存ボタンを出す。
 */
export const findPaintSubmitContainer = (): HTMLElement | null => {
  const container = document.querySelector(
    ".absolute.bottom-0.left-1\\/2.-translate-x-1\\/2",
  );
  // btn-primary を含むものだけを対象にする(他の bottom-center 要素との誤爆回避)
  if (container?.querySelector("button.btn-primary"))
    return container as HTMLElement;
  return null;
};

/**
 * "My location" ボタンのコンテナを検索（右下）
 */
export const findMyLocationContainer = (): Element | null => {
  const myLocationButton = findMyLocationButton();

  if (myLocationButton?.parentElement) {
    return myLocationButton.parentElement;
  }

  // 2. container直接検索 (元のロジックを維持)
  const container = document.querySelector(".absolute.bottom-3.right-3.z-30");
  if (container) return container;

  // 3. 見つからない場合は新規作成 (元のロジックを維持)
  const containerId = "mr-wplace-bottom-right-container";
  const existingContainer = document.querySelector(`#${containerId}`);
  if (existingContainer) return existingContainer;

  const newContainer = document.createElement("div");
  newContainer.className = "absolute bottom-3 right-3 z-30 flex flex-col gap-1";
  newContainer.id = containerId;
  document.body.appendChild(newContainer);
  return newContainer;
};
