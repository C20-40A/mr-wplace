import { getAggregatedColorStats } from "@/features/tile-draw";
import { getCurrentTiles } from "@/states/currentTile";
import { colorpalette } from "@/constants/colors";

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
    }
  );

  // NodeListOf<Element>の代わりにElement[]を返していますが、
  // 呼び出し元（forEachを使用）では問題なく動作します。
  // TypeScriptの厳密な型を維持するため、NodeListOfに変換して返すことも可能ですが、
  // シンプルな実装としてElement[]を使用します。
  return validButtons as unknown as NodeListOf<Element>; // 互換性のために型キャスト
};

// stats element作成を分離
const createStatsElement = (remaining: number): HTMLDivElement => {
  const div = document.createElement("div");
  div.className = "paint-stats-remaining";
  div.textContent = remaining.toString();
  div.style.cssText = `
    position: absolute;
    top: 2px;
    left: 2px;
    font-size: 8px;
    font-weight: 600;
    color: rgb(10,10,10);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.7));
    padding: 2px 3px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    line-height: 1;
  `;
  return div;
};

// button群へのstats追加
const attachStatsToButtons = (
  colorStats: Record<string, { matched: number; total: number }>
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

    // remainingが0より大きい場合のみ表示
    if (remaining > 0) {
      (button as HTMLElement).style.position = "relative";
      (button as HTMLElement).style.overflow = "clip";
      button.appendChild(createStatsElement(remaining));
    }
  });
};

// 統計取得
const getColorStats = async (): Promise<Record<
  string,
  { matched: number; total: number }
> | null> => {
  const currentTiles = getCurrentTiles();
  if (!currentTiles || currentTiles.size === 0) return null;

  const { GalleryStorage } = await import("@/features/gallery/storage");
  const galleryStorage = new GalleryStorage();
  const allImages = await galleryStorage.getAll();

  const targetImageKeys = allImages
    .filter(
      (img) =>
        img.drawEnabled &&
        img.drawPosition &&
        currentTiles.has(`${img.drawPosition.TLX},${img.drawPosition.TLY}`)
    )
    .map((img) => img.key);

  if (targetImageKeys.length === 0) return null;

  const stats = getAggregatedColorStats(targetImageKeys);
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

// 初期化（画面遷移のたびにstats再表示）
export const initPaintStats = (): void => {
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
