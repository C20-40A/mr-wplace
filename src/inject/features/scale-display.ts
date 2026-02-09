import { getMapInstanceFromWplace } from "./map-instance";

const SCALE_CONTAINER_ID = "mr-wplace-scale-display";
const SCALE_POSITION_KEY = "mr-wplace-scale-position";

let scaleEnabled = false;
let scaleContainer: HTMLDivElement | null = null;
let updateHandler: (() => void) | null = null;

// ドラッグ状態
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

/**
 * デバイスDPIを計算
 */
const getDeviceDpi = (): number => {
  const userAgent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return 288 / window.devicePixelRatio;
  } else if (/Windows/.test(userAgent)) {
    return 144 / window.devicePixelRatio;
  } else {
    return 96 / window.devicePixelRatio;
  }
};

/**
 * ズームレベルと緯度からメートル/ピクセルを計算
 */
const getMetersPerPixel = (zoomLevel: number, latitude: number): number => {
  const EARTH_CIRCUMFERENCE = 40075017;
  const TILE_SIZE = 512;

  const latitudeInRadians = (latitude * Math.PI) / 180;
  const latitudeCircumference =
    EARTH_CIRCUMFERENCE * Math.cos(latitudeInRadians);
  const pixelsAtEquator = Math.pow(2, zoomLevel) * TILE_SIZE;
  const metersPerPixel = latitudeCircumference / pixelsAtEquator;
  return metersPerPixel;
};

/**
 * スケールバーに適した距離を計算（100, 200, 500, 1000など）
 */
const getNiceDistance = (
  maxMeters: number,
): { distance: number; unit: string } => {
  // キロメートル単位で表示すべきか判定
  if (maxMeters >= 1000) {
    const maxKm = maxMeters / 1000;
    const niceKm = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

    for (let i = niceKm.length - 1; i >= 0; i--) {
      if (niceKm[i] <= maxKm) {
        return { distance: niceKm[i] * 1000, unit: "km" };
      }
    }
  }

  // メートル単位で表示
  const niceMeters = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

  for (let i = niceMeters.length - 1; i >= 0; i--) {
    if (niceMeters[i] <= maxMeters) {
      return { distance: niceMeters[i], unit: "m" };
    }
  }

  return { distance: 1, unit: "m" };
};

/**
 * スケールバーを作成
 */
const createScaleDisplay = (): HTMLDivElement => {
  const container = document.createElement("div");
  container.id = SCALE_CONTAINER_ID;

  // 保存された位置を読み込み
  const savedPosition = localStorage.getItem(SCALE_POSITION_KEY);
  let positionStyle = "bottom: 150px; right: 10px;";

  if (savedPosition) {
    const { bottom, right } = JSON.parse(savedPosition);
    positionStyle = `bottom: ${bottom}px; right: ${right}px;`;
  }

  container.style.cssText = `
    position: fixed;
    ${positionStyle}
    z-index: 1000;
    user-select: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    cursor: move;
    pointer-events: auto;
  `;

  // スケールバー本体
  const scaleBar = document.createElement("div");
  scaleBar.className = "mr-wplace-scale-bar";
  scaleBar.style.cssText = `
    background: rgba(255, 255, 255, 0.9);
    border: 2px solid #333;
    border-top: none;
    height: 8px;
    position: relative;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  `;

  // スケールテキスト
  const scaleText = document.createElement("div");
  scaleText.className = "mr-wplace-scale-text";
  scaleText.style.cssText = `
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: #333;
    text-align: center;
    border-radius: 3px 3px 0 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    margin-bottom: -1px;
  `;

  container.appendChild(scaleText);
  container.appendChild(scaleBar);

  // ドラッグイベントを設定
  setupDragHandlers(container);

  return container;
};

/**
 * ドラッグハンドラーを設定
 */
const setupDragHandlers = (container: HTMLDivElement): void => {
  const onMouseDown = (e: MouseEvent) => {
    isDragging = true;

    const rect = container.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    container.style.cursor = "grabbing";
    e.preventDefault();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = container.getBoundingClientRect();

    // 右端からの距離を計算
    const right = viewportWidth - (e.clientX - dragOffsetX + rect.width);
    // 下端からの距離を計算
    const bottom = viewportHeight - (e.clientY - dragOffsetY + rect.height);

    // 画面内に収める
    const clampedRight = Math.max(
      0,
      Math.min(right, viewportWidth - rect.width),
    );
    const clampedBottom = Math.max(
      0,
      Math.min(bottom, viewportHeight - rect.height),
    );

    container.style.right = `${clampedRight}px`;
    container.style.bottom = `${clampedBottom}px`;
  };

  const onMouseUp = () => {
    if (!isDragging) return;

    isDragging = false;
    container.style.cursor = "move";

    // 位置を保存
    const right = parseInt(container.style.right);
    const bottom = parseInt(container.style.bottom);
    localStorage.setItem(SCALE_POSITION_KEY, JSON.stringify({ right, bottom }));
  };

  container.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
};

/**
 * スケールバーを更新
 */
const updateScaleDisplay = (map: any): void => {
  if (!scaleContainer) return;

  const scaleBar = scaleContainer.querySelector(
    ".mr-wplace-scale-bar",
  ) as HTMLDivElement;
  const scaleText = scaleContainer.querySelector(
    ".mr-wplace-scale-text",
  ) as HTMLDivElement;

  if (!scaleBar || !scaleText) return;

  const zoomLevel = map.getZoom();
  const center = map.getCenter();
  const latitude = center.lat;

  // メートル/ピクセルを計算
  const metersPerPixel = getMetersPerPixel(zoomLevel, latitude);

  // 最大150pxのスケールバーとして適切な距離を計算
  const maxMeters = metersPerPixel * 150;
  const { distance, unit } = getNiceDistance(maxMeters);

  // スケールバーの幅を計算
  const widthInPixels = distance / metersPerPixel;
  scaleBar.style.width = `${widthInPixels}px`;

  // テキストを更新
  const displayValue = unit === "km" ? distance / 1000 : distance;
  scaleText.textContent = `${displayValue} ${unit}`;
};

/**
 * スケール表示を追加
 */
const addScaleDisplay = (map: any): void => {
  if (scaleContainer) return;

  // 既存の要素をチェック
  const existing = document.getElementById(SCALE_CONTAINER_ID);
  if (existing) {
    scaleContainer = existing as HTMLDivElement;
  } else {
    scaleContainer = createScaleDisplay();
    document.body.appendChild(scaleContainer);
  }

  // マップイベントにリスナーを追加
  updateHandler = () => updateScaleDisplay(map);
  map.on("zoom", updateHandler);
  map.on("move", updateHandler);

  // 初回更新
  updateScaleDisplay(map);

  console.log("🧑‍🎨 : Scale display added");
};

/**
 * スケール表示を削除
 */
const removeScaleDisplay = (map: any): void => {
  if (updateHandler) {
    map.off("zoom", updateHandler);
    map.off("move", updateHandler);
    updateHandler = null;
  }

  if (scaleContainer) {
    scaleContainer.remove();
    scaleContainer = null;
  }

  console.log("🧑‍🎨 : Scale display removed");
};

/**
 * スケール表示を切り替え
 */
export const setScaleDisplayEnabled = (enabled: boolean): void => {
  const map = getMapInstanceFromWplace() as any;
  if (!map) {
    console.warn("🧑‍🎨 : Map instance not available for scale display");
    return;
  }

  scaleEnabled = enabled;

  if (enabled) {
    addScaleDisplay(map);
  } else {
    removeScaleDisplay(map);
  }

  console.log("🧑‍🎨 : Scale display enabled:", enabled);
};

/**
 * styledataイベントでスケール表示を再適用
 */
export const setupScaleDisplayOnMapReady = (mapInstance: any): void => {
  const map = mapInstance as any;

  const onStyleData = () => {
    if (!scaleEnabled) return;
    // スケール表示を再追加
    if (scaleContainer) {
      scaleContainer.remove();
      scaleContainer = null;
    }
    addScaleDisplay(map);
  };

  map.on("styledata", onStyleData);
  console.log("🧑‍🎨 : Scale display listener setup complete");
};
