import { setupElementObserver } from "@/components/element-observer";
import { findPositionModal } from "@/constants/selectors";
import { getCurrentPosition, gotoPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { t } from "@/i18n/manager";
import { Toast } from "@/components/toast";
import {
  loadCloseButtonBigFromStorage,
  getCloseButtonBig,
} from "@/states/close-button-big";

export const TOOLBAR_ID = "mr-wplace-modal-toolbar";
export const TOOLBAR_ROW1_ID = "mr-wplace-toolbar-row1";
export const TOOLBAR_ROW2_ID = "mr-wplace-toolbar-row2";
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
    // 既存ツールバーがあれば座標だけ更新
    const existingTileInfo = container.querySelector<HTMLElement>(
      "#position-tile-info",
    );
    if (existingTileInfo) {
      const pos = getCurrentPosition();
      if (pos) {
        const c = latLngToTilePixel(pos.lat, pos.lng);
        existingTileInfo.textContent = `${c.TLX}-${c.TLY}-${c.PxX}-${c.PxY}`;
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

    // ツールバーをモーダル上部に作成（2段構造）
    const toolbar = document.createElement("div");
    toolbar.id = TOOLBAR_ID;
    toolbar.className =
      "bg-base-100/60 backdrop-blur-sm rounded-box flex flex-col px-3 py-1.5 mb-1 shadow-sm mx-auto";
    toolbar.style.cssText = "width: fit-content; justify-self: center;";

    const row1 = document.createElement("div");
    row1.id = TOOLBAR_ROW1_ID;
    row1.className = "flex items-center gap-1.5";

    const row2 = document.createElement("div");
    row2.id = TOOLBAR_ROW2_ID;
    row2.className = "flex items-center gap-1.5";
    row2.style.display = "none";

    // 左端アイコン（クリックで現在座標へジャンプ）
    const markerButton = this.createToolbarButton(
      "Jump to current coordinates",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="fill-primary size-4"><path d="M480-480q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Zm0 400Q319-217 239.5-334.5T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 100-79.5 217.5T480-80Z"></path></svg>',
    );
    markerButton.addEventListener("click", () => {
      const pos = getCurrentPosition();
      if (!pos) return;
      gotoPosition({ lat: pos.lat, lng: pos.lng, zoom: pos.zoom ?? 11 });
    });

    const tileCoordSpan = document.createElement("span");
    tileCoordSpan.id = "position-tile-info";
    tileCoordSpan.className =
      "text-base-content/70 text-xs font-mono cursor-pointer hover:text-primary transition-colors";
    tileCoordSpan.textContent = `${coords.TLX}-${coords.TLY}-${coords.PxX}-${coords.PxY}`;
    tileCoordSpan.title = "Copy tile coordinates";
    tileCoordSpan.addEventListener("click", async () => {
      const pos = getCurrentPosition();
      if (!pos) return;
      const c = latLngToTilePixel(pos.lat, pos.lng);
      const text = `${c.TLX}-${c.TLY}-${c.PxX}-${c.PxY}`;
      try {
        await navigator.clipboard.writeText(text);
        Toast.success(t`${"copied"}`);
      } catch (err) {
        console.error("🧑‍🎨 : Failed to copy coordinates", err);
        Toast.error("Failed to copy");
      }
    });

    // Eralyonリンクボタン
    const clockButton = this.createToolbarButton(
      "Open in Eralyon",
      `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>`,
    );
    clockButton.addEventListener("click", () => {
      const pos = getCurrentPosition();
      if (!pos) return;
      const zoom = pos.zoom ?? 11;
      window.open(
        `https://wplace.eralyon.net/?lat=${pos.lat.toFixed(6)}&lng=${pos.lng.toFixed(6)}&zoom=${zoom}`,
        "_blank",
      );
    });

    row1.append(markerButton, tileCoordSpan, clockButton);
    toolbar.append(row1, row2);

    // モーダル本体の前に独立要素として挿入
    container.prepend(toolbar);

    // 閉じるボタンを大きくする
    if (this.bigEnabled) {
      this.scheduleCloseButtonBig(container);
      this.startBigObserver(container);
    }

    // MutationObserver: 座標変更監視（サイト側の座標spanを監視）
    const coordSpan = container.querySelector(
      "span.text-base-content\\/70.text-xs:not(#position-tile-info)",
    );
    if (coordSpan) {
      this.observer = new MutationObserver(() => {
        setTimeout(() => {
          const pos = getCurrentPosition();
          if (!pos) return;
          const c = latLngToTilePixel(pos.lat, pos.lng);
          tileCoordSpan.textContent = `${c.TLX}-${c.TLY}-${c.PxX}-${c.PxY}`;
        }, 50);
      });
      this.observer.observe(coordSpan, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  }

  private createToolbarButton(
    title: string,
    svgHTML: string,
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "btn btn-xs btn-ghost";
    btn.style.cssText =
      "height: 1.25rem; min-height: 1.25rem; width: 1.25rem; min-width: 1.25rem; padding: 0;";
    btn.title = title;
    btn.innerHTML = svgHTML;
    return btn;
  }
}
