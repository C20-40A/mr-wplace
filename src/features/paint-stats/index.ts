import { getAggregatedColorStats } from "@/features/tile-draw";
import { getCurrentTiles } from "@/states/currentTile";
import { colorpalette } from "@/constants/colors";

// selector統一
const findColorButtons = (): NodeListOf<Element> => {
  return document.querySelectorAll('button[id^="color-"]');
};

// stats element作成を分離
const createStatsElement = (remaining: number): HTMLDivElement => {
  const div = document.createElement("div");
  div.className = "paint-stats-remaining";
  div.textContent = remaining.toString();
  div.style.cssText = `
    position: absolute;
    bottom: 1px;
    right: 1px;
    font-size: 9px;
    font-weight: 600;
    color: white;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.85));
    padding: 2px 4px;
    border-radius: 4px;
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
    const id = button.getAttribute("id");
    if (!id) return;

    const colorId = parseInt(id.replace("color-", ""));
    const color = colorpalette.find((c) => c.id === colorId);
    if (!color) return;

    const rgbKey = color.rgb.join(",");
    const stats = colorStats[rgbKey];
    if (!stats) return;

    const remaining = stats.total - stats.matched;

    (button as HTMLElement).style.position = "relative";
    button.appendChild(createStatsElement(remaining));
  });
};

// 統計取得
const getColorStats = async (): Promise<
  Record<string, { matched: number; total: number }> | null
> => {
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
