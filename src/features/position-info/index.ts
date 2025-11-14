import { setupElementObserver } from "@/components/element-observer";
import { findPositionModal } from "@/constants/selectors";
import { getCurrentPosition } from "@/utils/position";
import { llzToTilePixel } from "@/utils/coordinate";
import { t } from "@/i18n/manager";
import { Toast } from "@/components/toast";

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

    // 座標情報表示要素（テキスト + コピーボタン）
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.gap = "8px";
    wrapper.style.paddingLeft = "0.75rem";

    this.infoElement = document.createElement("div");
    this.infoElement.id = "position-tile-info";
    this.infoElement.style.fontSize = "0.7rem";
    this.infoElement.style.color = "#888";

    const copyButton = document.createElement("button");
    copyButton.className = "btn btn-sm btn-ghost";
    copyButton.style.color = "#888";
    copyButton.style.height = "20px";
    copyButton.style.minHeight = "20px";
    copyButton.style.padding = "0 6px";
    copyButton.title = "Copy";
    copyButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
    `;

    copyButton.addEventListener("click", async () => {
      const position = getCurrentPosition();
      if (!position) return;

      const { lat, lng } = position;
      const coords = llzToTilePixel(lat, lng);
      const coordText = `${coords.TLX}-${coords.TLY}-${coords.PxX}-${coords.PxY}`;

      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy coordinates", err);
        Toast.error("Failed to copy");
      }
    });

    wrapper.appendChild(this.infoElement);
    wrapper.appendChild(copyButton);

    this.updateInfo();

    headerDiv.insertAdjacentElement("afterend", wrapper);

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

    const { lat, lng } = position;
    const coords = llzToTilePixel(lat, lng);

    this.infoElement.textContent = t`${"coordinates"} ${coords.TLX}-${
      coords.TLY
    }-${coords.PxX}-${coords.PxY}`;
  }
}
