import { setupElementObserver } from "../../components/element-observer";
import { findPositionModal } from "../../constants/selectors";
import { getCurrentPosition } from "../../utils/position";
import { llzToTilePixel } from "../../utils/coordinate";

/**
 * 位置情報モーダルにタイル座標を表示
 */
export class PositionInfo {
  private infoElement: HTMLDivElement | null = null;
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
    const headerDiv = container.querySelector(".flex.gap-2.px-3");
    if (!headerDiv) return;

    // 座標情報表示要素
    this.infoElement = document.createElement("div");
    this.infoElement.id = "position-tile-info";
    this.infoElement.style.fontSize = "0.7rem";
    this.infoElement.style.color = "#888";
    this.infoElement.style.paddingLeft = "0.75rem";

    this.updateInfo();

    headerDiv.insertAdjacentElement("afterend", this.infoElement);

    // MutationObserver: h2変更監視
    const h2 = headerDiv.querySelector("h2");
    if (h2) {
      this.observer = new MutationObserver(() => this.updateInfo());
      this.observer.observe(h2, { childList: true, subtree: true });
    }
  }

  private updateInfo(): void {
    if (!this.infoElement) return;

    const position = getCurrentPosition();
    if (!position) {
      this.infoElement.textContent = "(Position unavailable)";
      return;
    }

    const { lat, lng, zoom } = position;
    const coords = llzToTilePixel(lat, lng);
    this.infoElement.textContent = `Coordinates: (${coords.TLX}, ${coords.TLY}, ${coords.PxX}, ${coords.PxY})`;
  }
}
