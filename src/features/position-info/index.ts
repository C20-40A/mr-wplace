import { setupElementObserver } from "@/components/element-observer";
import { findPositionModal } from "@/constants/selectors";
import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { t } from "@/i18n/manager";
import { Toast } from "@/components/toast";
import {
  loadCloseButtonBigFromStorage,
  getCloseButtonBig,
} from "@/states/close-button-big";

const CLOSE_SVG_PATH =
  "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z";
const CLOSE_BIG_MARKER_ID = "position-close-big-marker";

/**
 * 位置情報モーダルにタイル座標を表示
 */
export class PositionInfo {
  private observer: MutationObserver | null = null;
  private bigObserver: MutationObserver | null = null;
  private bigEnabled = false;
  private bigScheduled = false;

  constructor() {
    this.init();
  }

  private init = async () => {
    await loadCloseButtonBigFromStorage();
    this.bigEnabled = getCloseButtonBig();

    setupElementObserver([
      {
        id: "position-tile-info",
        getTargetElement: findPositionModal,
        createElement: (container: Element) => {
          this.addTileInfo(container);
        },
      },
      {
        id: CLOSE_BIG_MARKER_ID,
        getTargetElement: findPositionModal,
        createElement: (container: Element) => {
          this.ensureBigMarker(container);
          if (this.bigEnabled) {
            this.scheduleCloseButtonBig(container);
            this.startBigObserver(container);
          }
        },
      },
    ]);
  };

  /**
   * 閉じるボタンを大きくする
   */
  private applyCloseButtonBig(container: Element): boolean {
    const closeButton = container.querySelector<HTMLButtonElement>(
      `button.btn-circle:has(path[d="${CLOSE_SVG_PATH}"])`,
    );
    if (!closeButton) return false;

    closeButton.classList.remove("btn-xs");

    // SVGサイズも合わせて大きくする
    const svg = closeButton.querySelector("svg");
    if (svg) {
      svg.classList.remove("size-3.5");
      svg.classList.add("size-5");
    }

    return true;
  }

  private scheduleCloseButtonBig(container: Element, attempts = 6): void {
    if (!this.bigEnabled) return;
    if (this.bigScheduled) return;

    this.bigScheduled = true;
    requestAnimationFrame(() => {
      this.bigScheduled = false;
      const applied = this.applyCloseButtonBig(container);
      if (!applied && attempts > 0) {
        setTimeout(
          () => this.scheduleCloseButtonBig(container, attempts - 1),
          50,
        );
      }
    });
  }

  private startBigObserver(container: Element): void {
    if (!this.bigEnabled) return;

    this.bigObserver?.disconnect();

    let scheduled = false;
    this.bigObserver = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        this.scheduleCloseButtonBig(container);
      });
    });
    this.bigObserver.observe(container, { childList: true, subtree: true });
  }

  private ensureBigMarker(container: Element): void {
    if (container.querySelector(`#${CLOSE_BIG_MARKER_ID}`)) return;

    const marker = document.createElement("span");
    marker.id = CLOSE_BIG_MARKER_ID;
    marker.style.display = "none";
    container.appendChild(marker);
  }

  private addTileInfo(container: Element): void {
    // 座標表示スパンを探す（.text-base-content/70 .shrink-0 .text-xs、ただし自前の要素は除外）
    const coordSpan = container.querySelector(
      "span.text-base-content\\/70.shrink-0.text-xs:not(#position-tile-info)",
    );
    if (!coordSpan) return;

    // 既に追加済みの場合は座標を更新して終了
    const existingTileInfo =
      container.querySelector<HTMLElement>("#position-tile-info");
    if (existingTileInfo) {
      const newPosition = getCurrentPosition();
      if (newPosition) {
        const newCoords = latLngToTilePixel(newPosition.lat, newPosition.lng);
        existingTileInfo.textContent = `${newCoords.TLX}-${newCoords.TLY}-${newCoords.PxX}-${newCoords.PxY}`;
      }
      if (this.bigEnabled) {
        this.scheduleCloseButtonBig(container);
        this.startBigObserver(container);
      }
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
      const currentPos = getCurrentPosition();
      if (!currentPos) return;
      const currentCoords = latLngToTilePixel(currentPos.lat, currentPos.lng);
      const coordText = `${currentCoords.TLX}-${currentCoords.TLY}-${currentCoords.PxX}-${currentCoords.PxY}`;

      try {
        await navigator.clipboard.writeText(coordText);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy coordinates", err);
        Toast.error("Failed to copy");
      }
    });

    // 時計アイコンボタンを作成
    const clockButton = document.createElement("button");
    clockButton.className = "btn btn-xs btn-ghost shrink-0";
    clockButton.style.cssText = `
      color: rgb(156 163 175 / 0.7);
      height: 1.25rem;
      min-height: 1.25rem;
      padding: 0;
      margin-left: 2px;
    `;
    clockButton.title = "Open in Eralyon";
    clockButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    `;

    clockButton.addEventListener("click", () => {
      const currentPos = getCurrentPosition();
      if (!currentPos) return;
      const zoom = currentPos.zoom ?? 11;
      const url = `https://wplace.eralyon.net/?lat=${currentPos.lat.toFixed(6)}&lng=${currentPos.lng.toFixed(6)}&zoom=${zoom}`;
      window.open(url, "_blank");
    });

    // タイル座標とボタンを既存座標の前に挿入
    coordSpan.insertAdjacentElement("beforebegin", tileCoordSpan);
    tileCoordSpan.insertAdjacentElement("afterend", copyButton);
    copyButton.insertAdjacentElement("afterend", clockButton);

    // 閉じるボタンを大きくする
    if (this.bigEnabled) {
      this.scheduleCloseButtonBig(container);
      this.startBigObserver(container);
    }

    // MutationObserver: 座標変更監視
    this.observer = new MutationObserver(() => {
      setTimeout(() => {
        const newPosition = getCurrentPosition();
        if (!newPosition) return;
        const { lat, lng } = newPosition;
        const newCoords = latLngToTilePixel(lat, lng);
        tileCoordSpan.textContent = `${newCoords.TLX}-${newCoords.TLY}-${newCoords.PxX}-${newCoords.PxY}`;
      }, 50);
    });
    this.observer.observe(coordSpan, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}
