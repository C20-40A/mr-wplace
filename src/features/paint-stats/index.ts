import { getAggregatedColorStats } from "@/utils/inject-bridge";
import { colorpalette } from "@/constants/colors";
import { getAllGalleryMetadata } from "@/core/bridge/gallery-storage-bridge";
import { findNearestGalleryItem } from "@/utils/gallery-helpers";

// selector統一
const findColorButtons = (): NodeListOf<Element> => {
  // 1. まず「color-」で始まるIDを持つボタンをすべて取得（DOM負荷を抑える）
  const allColorButtons = document.querySelectorAll('button[id^="color-"]');

  // 2. JavaScriptで厳密にフィルタリング（パフォーマンスと正確性の向上）
  const validButtons: Element[] = Array.from(allColorButtons).filter(
    (button) => {
      const id = button.getAttribute("id");
      if (!id) return false;

      // IDが「color-」で始まり、その後に「1回以上の数字」のみが続くかを正規表現でチェック
      // 例: color-0, color-35, color-64 はOK
      // 例: color-filter-fab-btn はNG
      return /^color-\d+$/.test(id);
    },
  );

  // NodeListOf<Element>の代わりにElement[]を返していますが、
  // 呼び出し元（forEachを使用）では問題なく動作します。
  // TypeScriptの厳密な型を維持するため、NodeListOfに変換して返すことも可能ですが、
  // シンプルな実装としてElement[]を使用します。
  return validButtons as unknown as NodeListOf<Element>; // 互換性のために型キャスト
};

const getContrastColor = (r: number, g: number, b: number): string => {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.5 ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)";
};

// 完了チェックマーク
const createCheckElement = (textColor: string): HTMLDivElement => {
  const div = document.createElement("div");
  div.className = "paint-stats-remaining";
  div.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.style.cssText = `opacity: 0.25;`;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M8 12l3 3 6-7");
  path.setAttribute("stroke-width", "3");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", textColor);
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  div.appendChild(svg);
  return div;
};

// stats element作成（中央テキスト + ボトムゲージ）
const createStatsElement = (
  remaining: number,
  percentage: number,
  textColor: string,
): HTMLDivElement => {
  const div = document.createElement("div");
  div.className = "paint-stats-remaining";
  div.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  // 中央テキスト
  const text = document.createElement("span");
  text.textContent = remaining.toString();
  text.style.cssText = `
    font-size: 8px;
    font-weight: 700;
    color: ${textColor};
    line-height: 1;
    text-shadow: 0 0 2px rgba(0,0,0,0.3);
  `;
  // ボトムゲージ
  const gauge = document.createElement("div");
  gauge.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: rgba(255,255,255,0.3);
  `;
  const bar = document.createElement("div");
  bar.style.cssText = `
    height: 100%;
    width: ${percentage}%;
    background: rgba(100,200,255,0.7);
  `;
  gauge.appendChild(bar);
  div.appendChild(text);
  div.appendChild(gauge);
  return div;
};

// button群へのstats追加
const attachStatsToButtons = (
  colorStats: Record<string, { matched: number; total: number }>,
): void => {
  const colorButtons = findColorButtons();

  colorButtons.forEach((button) => {
    // 既存のstats要素があれば削除（再表示時の対応）
    const existingStats = button.querySelector(".paint-stats-remaining");
    if (existingStats) {
      existingStats.remove();
    }

    const id = button.getAttribute("id");
    if (!id) return;

    const colorId = parseInt(id.replace("color-", ""));
    const color = colorpalette.find((c) => c.id === colorId);
    if (!color) return;

    const rgbKey = color.rgb.join(",");
    const stats = colorStats[rgbKey];
    if (!stats) return;

    const remaining = stats.total - stats.matched;
    const percentage =
      stats.total > 0 ? (stats.matched / stats.total) * 100 : 0;
    const [r, g, b] = color.rgb;
    const textColor = getContrastColor(r, g, b);

    (button as HTMLElement).style.position = "relative";
    (button as HTMLElement).style.overflow = "clip";

    if (remaining > 0)
      button.appendChild(createStatsElement(remaining, percentage, textColor));
    else button.appendChild(createCheckElement(textColor));
  });
};

// 統計取得
const getColorStats = async (): Promise<Record<
  string,
  { matched: number; total: number }
> | null> => {
  const allMetadata = await getAllGalleryMetadata();
  // coords が存在するアイテムのみを型安全に抽出
  const drawableItems = allMetadata.filter(
    (m): m is typeof m & { coords: NonNullable<typeof m.coords> } =>
      m.visible && !!m.coords,
  );

  if (drawableItems.length === 0) return null;

  // 最寄り1件を選択
  const nearest = findNearestGalleryItem(drawableItems);
  if (!nearest) return null;

  const stats = await getAggregatedColorStats([nearest.id]);
  console.log(
    `🧑‍🎨 : Paint stats: nearest template: ${nearest.title || nearest.id}`,
  );

  return Object.keys(stats).length > 0 ? stats : null;
};

// 統計表示
const displayColorStats = async (): Promise<void> => {
  const colorStats = await getColorStats();
  if (!colorStats) {
    console.log("🧑‍🎨 : Paint stats: no stats available");
    return;
  }

  attachStatsToButtons(colorStats);
  console.log("🧑‍🎨 : Paint stats: displayed on all color buttons");
};

// debounce付きstats更新
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_DEBOUNCE_MS = 300;

const scheduleRefresh = (): void => {
  // color buttonsがDOM上にない = ペイントモードでないなら不要
  if (findColorButtons().length === 0) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    displayColorStats();
  }, REFRESH_DEBOUNCE_MS);
};

// inject側のタイルレンダリング後のstats更新を listen
const setupStatsUpdateListener = (): void => {
  window.addEventListener("message", (event) => {
    if (event.data?.source === "mr-wplace-stats-updated") {
      scheduleRefresh();
    }
  });
};

// 初期化（画面遷移のたびにstats再表示 + stats更新のリアルタイム反映）
export const initPaintStats = (): void => {
  setupStatsUpdateListener();

  const observer = new MutationObserver(() => {
    const colorButtons = findColorButtons();
    if (colorButtons.length === 0) return;

    // 既にstats表示済みならスキップ
    if (document.querySelector(".paint-stats-remaining")) return;

    // stats計算・表示
    displayColorStats();
  });

  observer.observe(document.body, { childList: true, subtree: true });
};
