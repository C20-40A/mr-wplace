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
  private observedContainer: Element | null = null;
  private observedBigContainer: Element | null = null;

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
    if (this.observedBigContainer === container && this.bigObserver) return;

    this.bigObserver?.disconnect();
    this.observedBigContainer = container;

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

  private updateTileInfo(span: HTMLElement): void {
    const pos = getCurrentPosition();
    if (!pos) return;
    const c = latLngToTilePixel(pos.lat, pos.lng);
    const text = `${c.TLX}-${c.TLY}-${c.PxX}-${c.PxY}`;
    // 自身の書き換えで observer がループしないよう、変化時のみ更新
    if (span.textContent !== text) span.textContent = text;
  }

  /**
   * パネル全体を監視して座標を再計算する
   * (サイト側の座標spanは再描画で差し替わるため、span単体は監視しない)
   */
  private observeContainer(container: Element): void {
    if (this.observedContainer === container && this.observer) return;

    this.observer?.disconnect();
    this.observedContainer = container;
    let timer: ReturnType<typeof setTimeout> | undefined;
    this.observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const span = container.querySelector<HTMLElement>(
          "#position-tile-info",
        );
        if (span) this.updateTileInfo(span);
      }, 50);
    });
    this.observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });
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
      this.updateTileInfo(existingTileInfo);
      this.observeContainer(container);
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
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="none" stroke="currentColor" stroke-width="60" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 -translate-y-px"><path d="M480-110q-93-78-146.5-154T280-404q0-94 58-155t142-61q84 0 142 61t58 155q0 64-53.5 140T480-110Z"></path><circle cx="480" cy="-465" r="55"></circle></svg>',
    );
    markerButton.className =
      "btn btn-xs btn-ghost inline-flex items-center gap-1 p-0";
    markerButton.style.cssText =
      "height: 1.25rem; min-height: 1.25rem; width: auto; min-width: 0;";
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
    tileCoordSpan.addEventListener("click", async (event) => {
      event.stopPropagation();
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

    markerButton.append(tileCoordSpan);
    row1.append(markerButton, clockButton);
    toolbar.append(row1, row2);

    // モーダル本体の前に独立要素として挿入
    container.prepend(toolbar);

    // 閉じるボタンを大きくする
    if (this.bigEnabled) {
      this.scheduleCloseButtonBig(container);
      this.startBigObserver(container);
    }

    // 座標変更監視（パネル再描画・location 書き込み遅延に追従）
    this.observeContainer(container);
    setTimeout(() => this.updateTileInfo(tileCoordSpan), 50);
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
