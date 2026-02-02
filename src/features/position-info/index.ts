import { setupElementObserver } from "@/components/element-observer";
import { findPositionModal } from "@/constants/selectors";
import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { t } from "@/i18n/manager";
import { Toast } from "@/components/toast";

/**
 * 位置情報モーダルにタイル座標を表示
 */
export class PositionInfo {
  private observer: MutationObserver | null = null;

  constructor() {
    setupElementObserver([
      {
        id: "position-tile-info",
        getTargetElement: findPositionModal,
        createElement: (container) => {
          this.addTileInfo(container);
        },
      },
    ]);
  }

  private addTileInfo(container: Element): void {
    // 座標表示スパンを探す（.text-base-content/70 .shrink-0 .text-xs）
    const coordSpan = container.querySelector(
      "span.text-base-content\\/70.shrink-0.text-xs",
    );
    if (!coordSpan) return;

    // 既に追加済みかチェック
    if (coordSpan.previousElementSibling?.id === "position-tile-info") {
      return;
    }

    const position = getCurrentPosition();
    if (!position) return;

    const { lat, lng } = position;
    const coords = latLngToTilePixel(lat, lng);

    // タイル座標テキストを作成
    const tileCoordSpan = document.createElement("span");
    tileCoordSpan.id = "position-tile-info";
    tileCoordSpan.className = "text-base-content/70 shrink-0 text-xs";
    tileCoordSpan.textContent = `${coords.TLX}-${coords.TLY}-${coords.PxX}-${coords.PxY}`;

    // コピーボタンを作成
    const copyButton = document.createElement("button");
    copyButton.className = "btn btn-xs btn-ghost shrink-0";
    copyButton.style.cssText = `
      color: rgb(156 163 175 / 0.7);
      height: 1.25rem;
      min-height: 1.25rem;
      padding: 0;
    `;
    copyButton.title = "Copy tile coordinates";
    copyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `;

    copyButton.addEventListener("click", async () => {
      const coordText = `${coords.TLX}-${coords.TLY}-${coords.PxX}-${coords.PxY}`;

      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy coordinates", err);
        Toast.error("Failed to copy");
      }
    });

    // タイル座標とコピーボタンを既存座標の前に挿入
    coordSpan.insertAdjacentElement("beforebegin", tileCoordSpan);
    tileCoordSpan.insertAdjacentElement("afterend", copyButton);

    // MutationObserver: 座標変更監視
    this.observer = new MutationObserver(() => {
      const newPosition = getCurrentPosition();
      if (!newPosition) return;

      const { lat, lng } = newPosition;
      const newCoords = latLngToTilePixel(lat, lng);
      tileCoordSpan.textContent = `${newCoords.TLX}-${newCoords.TLY}-${newCoords.PxX}-${newCoords.PxY}`;
    });
    this.observer.observe(coordSpan, { childList: true, subtree: true });
  }
}
