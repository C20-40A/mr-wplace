import { setupElementObserver } from "@/components/element-observer";
import { findPositionModal } from "@/constants/selectors";
import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { t } from "@/i18n/manager";
import { Toast } from "@/components/toast";
import {
  loadCloseButtonSwapFromStorage,
  getCloseButtonSwap,
} from "@/states/close-button-swap";

const CLOSE_SVG_PATH =
  "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z";
const CLOSE_PROXY_ID = "position-close-proxy";
const DROPDOWN_SWAP_ID = "position-swap-dropdown";

/**
 * 位置情報モーダルにタイル座標を表示
 */
export class PositionInfo {
  private observer: MutationObserver | null = null;
  private swapObserver: MutationObserver | null = null;
  private swapEnabled = false;
  private swapScheduled = false;
  private static readonly SWAP_MARKER_ID = "position-close-swap-marker";

  constructor() {
    this.init();
  }

  private init = async () => {
    await loadCloseButtonSwapFromStorage();
    this.swapEnabled = getCloseButtonSwap();

    setupElementObserver([
      {
        id: "position-tile-info",
        getTargetElement: findPositionModal,
        createElement: (container: Element) => {
          this.addTileInfo(container);
        },
      },
      {
        id: PositionInfo.SWAP_MARKER_ID,
        getTargetElement: findPositionModal,
        createElement: (container: Element) => {
          this.ensureSwapMarker(container);
          if (this.swapEnabled) {
            this.scheduleCloseButtonSwap(container);
            this.startSwapObserver(container);
          }
        },
      },
    ]);
  };

  /**
   * 閉じるボタンと三点メニューの位置を入れ替え
   */
  private applyCloseButtonSwap(container: Element): boolean {
    const headerRow = container.querySelector<HTMLElement>(
      ".flex.items-center.gap-2",
    );
    const footerRow = container.querySelector<HTMLElement>(
      ".border-base-300.flex.items-center.justify-between",
    );
    if (!headerRow || !footerRow) return false;

    const closeButton = footerRow.querySelector<HTMLButtonElement>(
      `button:has(path[d="${CLOSE_SVG_PATH}"])`,
    );
    if (!closeButton) return false;

    const dropdowns = Array.from(
      container.querySelectorAll<HTMLElement>(
        ".dropdown.dropdown-top.dropdown-left.shrink-0",
      ),
    );
    if (dropdowns.length === 0) return false;

    const dropdownInHeader = dropdowns.find((el) => headerRow.contains(el));
    const dropdownInFooter = dropdowns.find((el) => footerRow.contains(el));
    const dropdown = dropdownInHeader || dropdownInFooter || dropdowns[0];
    if (!dropdown) return false;

    const dropdownInFooterNow = footerRow.contains(dropdown);

    if (!dropdownInFooterNow) {
      footerRow.appendChild(dropdown);
    }

    dropdown.id = DROPDOWN_SWAP_ID;
    for (const extra of dropdowns) {
      if (extra === dropdown) continue;
      if (extra.id === DROPDOWN_SWAP_ID) {
        extra.remove();
      }
    }

    // もとの閉じるボタンはフッターに残し、ヘッダーにプロキシを置く
    closeButton.classList.add("hidden");

    let proxyButton = headerRow.querySelector<HTMLButtonElement>(
      `#${CLOSE_PROXY_ID}`,
    );
    if (!proxyButton) {
      proxyButton = document.createElement("button");
      proxyButton.id = CLOSE_PROXY_ID;
      proxyButton.type = "button";
      proxyButton.className = closeButton.className;
      proxyButton.classList.remove("btn-xs");
      proxyButton.classList.remove("hidden");
      proxyButton.innerHTML = closeButton.innerHTML;
      proxyButton.addEventListener("click", () => {
        const latestCloseButton = footerRow.querySelector<HTMLButtonElement>(
          `button:has(path[d="${CLOSE_SVG_PATH}"])`,
        );
        latestCloseButton?.click();
      });
    } else {
      proxyButton.className = closeButton.className;
      proxyButton.classList.remove("btn-xs");
      proxyButton.classList.remove("hidden");
      proxyButton.innerHTML = closeButton.innerHTML;
    }

    const headerDropdown =
      headerRow.querySelector<HTMLElement>(`#${DROPDOWN_SWAP_ID}`) ??
      headerRow.querySelector<HTMLElement>(
        ".dropdown.dropdown-top.dropdown-left.shrink-0",
      );
    if (headerDropdown) {
      headerRow.insertBefore(proxyButton, headerDropdown);
    } else {
      headerRow.appendChild(proxyButton);
    }

    return true;
  }

  private scheduleCloseButtonSwap(
    container: Element,
    attempts = 6,
  ): void {
    if (!this.swapEnabled) return;
    if (this.swapScheduled) return;

    this.swapScheduled = true;
    requestAnimationFrame(() => {
      this.swapScheduled = false;
      const swapped = this.applyCloseButtonSwap(container);
      if (!swapped && attempts > 0) {
        setTimeout(
          () => this.scheduleCloseButtonSwap(container, attempts - 1),
          50,
        );
      }
    });
  }

  private startSwapObserver(container: Element): void {
    if (!this.swapEnabled) return;

    this.swapObserver?.disconnect();

    let scheduled = false;
    this.swapObserver = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        this.scheduleCloseButtonSwap(container);
      });
    });
    this.swapObserver.observe(container, { childList: true, subtree: true });
  }

  private ensureSwapMarker(container: Element): void {
    if (container.querySelector(`#${PositionInfo.SWAP_MARKER_ID}`)) return;

    const marker = document.createElement("span");
    marker.id = PositionInfo.SWAP_MARKER_ID;
    marker.style.display = "none";
    container.appendChild(marker);
  }

  private addTileInfo(container: Element): void {
    // 座標表示スパンを探す（.text-base-content/70 .shrink-0 .text-xs）
    const coordSpan = container.querySelector(
      "span.text-base-content\\/70.shrink-0.text-xs",
    );
    if (!coordSpan) return;

    // 既に追加済みかチェック
    if (coordSpan.previousElementSibling?.id === "position-tile-info") {
      if (this.swapEnabled) {
        this.scheduleCloseButtonSwap(container);
        this.startSwapObserver(container);
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
      const coordText = `${coords.TLX}-${coords.TLY}-${coords.PxX}-${coords.PxY}`;

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
      const zoom = position.zoom ?? 11;
      const url = `https://wplace.eralyon.net/?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}&zoom=${zoom}`;
      window.open(url, "_blank");
    });

    // タイル座標とボタンを既存座標の前に挿入
    coordSpan.insertAdjacentElement("beforebegin", tileCoordSpan);
    tileCoordSpan.insertAdjacentElement("afterend", copyButton);
    copyButton.insertAdjacentElement("afterend", clockButton);

    // 閉じるボタンのスワップを適用
    if (this.swapEnabled) {
      this.scheduleCloseButtonSwap(container);
      this.startSwapObserver(container);
    }

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
