import { t } from "@/i18n/manager";
import { withOfficialNote } from "../../../official-overlay";
import type { GalleryItem } from "@/states/galleryStorage";
import { runtime } from "@/utils/browser-api";
import { attachScrollFallback } from "@/utils/scroll";
import { ensureStyle } from "@/utils/style";
import {
  ensureGaugeStyles,
  gaugeHtml,
} from "@/components/progress-gauge";
import { Tutorial } from "@/features/tutorial";

const ITEM_STYLE_ID = "wps-gallery-item-style";

/** タッチ入力がある端末に付ける html クラス（hover 出し分けを無効化する） */
const TOUCH_DEVICE_CLASS = "wps-touch-device";

/**
 * タッチ入力がある端末（スマホ/タブレット/タッチ対応PC）を html に記録する。
 *
 * アクションボタンの「ホバー時だけ表示」はマウス操作のデスクトップ専用にしたい。
 * タブレットは hover: hover を名乗ることがあり、その状態でタップすると
 * ボタンが隠れていて誤操作になるため、タッチがある端末は常時表示に固定する。
 */
const markTouchDevice = (): void => {
  if (navigator.maxTouchPoints > 0) {
    document.documentElement.classList.add(TOUCH_DEVICE_CLASS);
  }
};

/**
 * アイテム用スタイル。
 * - カードは hover で少し浮き上がる（transform なのでレイアウトは動かない）
 * - アクションボタンの「ホバー時だけ表示」はマウス操作のデスクトップ限定。
 *   条件は @media (hover: hover) and (pointer: fine) かつ 非タッチ端末。
 *   スマホ/タブレット/タッチ対応PCでは常時表示のまま（タップ時の誤操作防止）
 * - ただし描画が「非表示(hide)」のアイテムの目玉ボタンは例外で、状態が一目で
 *   分かるようホバーしていなくても常に表示する (.gallery-item-action-pinned)
 *
 * NOTE: ページ側 Tailwind はビルド済みのため、存在しないユーティリティは効かない。
 * hover 系はタッチ端末での「張り付き hover」を避けるため自前 CSS にしている
 * （テーマ依存の色は daisyUI の共通クラス側で指定）。
 */
const ensureItemStyles = (): void => {
  ensureStyle(
    ITEM_STYLE_ID,
    `
    .gallery-item .gallery-item-action {
      opacity: var(--wps-action-opacity, 0.72);
      transition: opacity 0.15s ease;
    }
    /* デスクトップ（マウス操作 & 非タッチ）だけ hover で出し分ける */
    @media (hover: hover) and (pointer: fine) {
      html:not(.${TOUCH_DEVICE_CLASS}) .gallery-item:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 22px -8px rgba(0, 0, 0, 0.28), 0 4px 10px -4px rgba(0, 0, 0, 0.16);
      }
      /* hide 中の目玉(pinned)は常時表示したいので、隠す対象から除外する */
      html:not(.${TOUCH_DEVICE_CLASS}) .gallery-item .gallery-item-action:not(.gallery-item-action-pinned) {
        opacity: 0;
        pointer-events: none;
      }
      html:not(.${TOUCH_DEVICE_CLASS}) .gallery-item:hover .gallery-item-action,
      html:not(.${TOUCH_DEVICE_CLASS}) .gallery-item:focus-within .gallery-item-action {
        opacity: var(--wps-action-opacity, 0.72);
        pointer-events: auto;
      }
    }
    `,
  );
};

export interface ImageGridOptions {
  items: GalleryItem[];
  isSelectionMode?: boolean;
  onImageClick?: (item: GalleryItem) => void;
  onImageSelect?: (item: GalleryItem) => void;
  onImageDelete?: (key: string) => void;
  onDrawToggle?: (key: string) => void; // 描画状態切り替えコールバック
  onGotoPosition?: (item: GalleryItem) => void; // マップ移動コールバック
  showDeleteButton?: boolean;
  showAddButton?: boolean;
  showDrawToggleButton?: boolean; // 描画切り替えボタンを表示するか
  showGotoPositionButton?: boolean; // マップピンボタンを表示するか
  onAddClick?: () => void;
  emptyStateMessage?: string;
  emptyStateButtonText?: string; // 空状態のボタンテキスト（i18nキー）
  emptyStateButtonStyle?: "fab" | "primary"; // 空状態のボタンスタイル
  gridCols?: string;
}

export class ImageGridComponent {
  private container: HTMLElement;
  private options: ImageGridOptions;
  private tutorial: Tutorial;
  private readonly overlayIconFilter =
    "drop-shadow(0 0 1px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 2px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 1px rgba(255, 255, 255, 0.45))";

  constructor(container: HTMLElement, options: ImageGridOptions) {
    this.container = container;
    this.options = {
      isSelectionMode: false,
      showDeleteButton: true,
      showAddButton: true,
      showDrawToggleButton: true, // デフォルトで目アイコンを表示
      showGotoPositionButton: true, // デフォルトでピンアイコンを表示
      emptyStateMessage: t`${"no_saved_images"}`,
      emptyStateButtonStyle: "fab", // デフォルトはFABボタン
      gridCols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      ...options,
    };
    this.tutorial = new Tutorial();
    markTouchDevice();
    ensureItemStyles();
    ensureGaugeStyles();
  }

  /**
   * オプションを更新して再描画
   */
  updateOptions(newOptions: Partial<ImageGridOptions>): void {
    this.options = { ...this.options, ...newOptions };
    this.render();
  }

  /**
   * 画像グリッドをレンダリング
   */
  render(): void {
    if (this.options.items.length === 0) {
      this.renderEmptyState();
      this.tutorial.createButton(this.container);
      return;
    }

    this.renderImageGrid();
    this.tutorial.createButton(this.container);
  }

  /**
   * 空の状態を表示
   */
  private renderEmptyState(): void {
    // 空の状態では常に大きなprimaryボタンを表示
    const addButtonHtml = this.options.showAddButton
      ? this.createPrimaryAddButtonHtml()
      : "";

    const tutorialGifUrl = runtime.getURL(
      "assets/images/tutorial/how_to_draw.gif",
    );

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 2rem; min-height: 300px;">
        <img src="${tutorialGifUrl}" alt="How to draw" style="width: 18rem; height: auto; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">

        <div style="text-align: center; max-width: 400px;">
          <p style="font-size: 1rem; margin-bottom: 0.5rem;">${t`${"empty_gallery_message"}`}</p>
        </div>

        ${addButtonHtml}
      </div>
    `;

    this.attachAddButtonListener();
  }

  /**
   * 画像グリッドを表示
   */
  private renderImageGrid(): void {
    const itemsHtml = this.options.items
      .map((item) => this.createImageItemHtml(item))
      .join("");

    this.container.innerHTML = `
      <div class="grid ${this.options.gridCols} gap-4" role="list">
        ${itemsHtml}
      </div>
      
      ${this.options.showAddButton ? this.createAddButtonHtml() : ""}
    `;

    this.attachEventListeners();
  }

  /**
   * 画像アイテムのHTMLを生成
   */
  private createImageItemHtml(item: GalleryItem): string {
    const showDeleteBtn =
      this.options.showDeleteButton && !this.options.isSelectionMode;
    const showDrawToggleBtn =
      this.options.showDrawToggleButton && !this.options.isSelectionMode;
    const showGotoPositionBtn =
      this.options.showGotoPositionButton &&
      !this.options.isSelectionMode &&
      item.drawPosition;

    const hasSizeBadge = !!(item.width && item.height);
    const progressHtml = this.createProgressBarHtml(item);
    const titleHtml = this.createTitleHtml(item, !!progressHtml, hasSizeBadge);
    const sizeBadgeHtml = hasSizeBadge
      ? `<span class="absolute right-2 bottom-2 rounded-[var(--game-radius,5px)] bg-base-100/80 px-1.5 py-0.5 font-mono text-[10px] text-base-content/70 shadow-sm">${item.width} × ${item.height}</span>`
      : "";

    return `
      <div
        class="group relative flex min-w-0 flex-col overflow-hidden rounded-[var(--game-radius,13px)] border border-base-300/70 shadow-md transition gallery-item"
        role="listitem"
        style="display: flex; flex-direction: column;"
        data-item-key="${item.key}"
      >
        <button
          type="button"
          class="w-full min-w-0 cursor-pointer text-left"
          style="flex: 1; display: flex; flex-direction: column; background: none; border: none; padding: 0;"
        >
          <div class="relative w-full overflow-hidden">
            <img
              src="${item.thumbnail || item.dataUrl}"
              alt="Gallery item"
              class="pixelated aspect-square w-full object-contain p-2"
              style="image-rendering: pixelated; object-fit: contain;"
              draggable="false"
            >
            ${sizeBadgeHtml}
          </div>
          ${titleHtml}
          ${progressHtml}
        </button>
        ${showDeleteBtn ? this.createDeleteButtonHtml(item.key) : ""}
        ${
          showDrawToggleBtn && item.drawPosition
            ? this.createDrawToggleButtonHtml(item)
            : ""
        }
        ${showGotoPositionBtn ? this.createGotoPositionButtonHtml(item) : ""}
      </div>
    `;
  }

  /**
   * オーバーレイアイコンボタン共通ファクトリ
   */
  private createOverlayIconButton(config: {
    dataAttr: string;
    value: string;
    position: { top?: string; left?: string; right?: string; bottom?: string };
    iconPath: string;
    title?: string;
    opacity?: number;
    /** true のとき、ホバーしていなくても常に表示する（状態表示用） */
    pinned?: boolean;
  }): string {
    const {
      dataAttr,
      value,
      position,
      iconPath,
      title,
      opacity = 0.72,
      pinned = false,
    } = config;
    const pos = Object.entries(position)
      .map(([k, v]) => `${k}: ${v};`)
      .join(" ");
    const titleAttr = title ? `title="${title}"` : "";
    return `
      <button
        class="btn btn-xs btn-circle btn-ghost gallery-item-action${pinned ? " gallery-item-action-pinned" : ""}"
        ${dataAttr}="${value}"
        ${titleAttr}
        style="position: absolute; ${pos} z-index: 10; background: none; border: none; padding: 0; --wps-action-opacity: ${opacity};"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4" style="filter: ${this.overlayIconFilter};">
          ${iconPath}
        </svg>
      </button>
    `;
  }

  private createDeleteButtonHtml(itemKey: string): string {
    return this.createOverlayIconButton({
      dataAttr: "data-delete",
      value: itemKey,
      position: { top: "0.25rem", right: "0.25rem" },
      iconPath: `<path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>`,
    });
  }

  private createGotoPositionButtonHtml(item: GalleryItem): string {
    return this.createOverlayIconButton({
      dataAttr: "data-goto-position",
      value: item.key,
      position: { top: "0.25rem", left: "2rem" },
      title: "Go to map position",
      iconPath: `<path fill-rule="evenodd" d="m11.54 22.351.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>`,
    });
  }

  private createDrawToggleButtonHtml(item: GalleryItem): string {
    const isEnabled = item.drawEnabled;
    const eyeIcon = isEnabled
      ? `<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>`
      : `<path fill-rule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM7.823 9.177A4.31 4.31 0 006.586 12 4.31 4.31 0 0012 17.411c1.02 0 1.958-.351 2.696-.937L13.177 15c-.465.465-1.102.75-1.177.75a3 3 0 01-3-3c0-.075.285-.712.75-1.177L7.823 9.177zM7.29 6.696l8.014 8.014a4.31 4.31 0 001.282-3.123A4.31 4.31 0 0012 6.075a4.31 4.31 0 00-4.71.621z" clip-rule="evenodd"/>`;

    return this.createOverlayIconButton({
      dataAttr: "data-draw-toggle",
      value: item.key,
      position: { top: "0.25rem", left: "0.25rem" },
      title: isEnabled ? "Hide drawing" : "Show drawing",
      iconPath: eyeIcon,
      // hide 中は「その状態である」ことが一目で分かるよう常時表示にする
      opacity: isEnabled ? 0.72 : 0.9,
      pinned: !isEnabled,
    });
  }

  /**
   * 追加ボタン（FAB）のHTMLを生成
   */
  private createAddButtonHtml(): string {
    return `
      <button 
        id="wps-gallery-add-btn" 
        class="btn btn-circle btn-primary z-20 shadow-lg" 
        style="position: fixed; bottom: 1rem; right: 1rem;"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
          <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
        </svg>
      </button>
    `;
  }

  /**
   * 追加ボタン（Primary）のHTMLを生成
   */
  private createPrimaryAddButtonHtml(): string {
    const buttonText = this.options.emptyStateButtonText
      ? t`${this.options.emptyStateButtonText}`
      : t`${"add_first_image"}`;
    return `
      <button id="wps-gallery-add-btn" class="btn btn-primary btn-lg" style="padding: 1rem 2rem; font-size: 1.125rem; gap: 0.75rem;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1.5rem; height: 1.5rem;">
          <path fill-rule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
        </svg>
        ${buttonText}
      </button>
    `;
  }

  /**
   * イベントリスナーを設定
   */
  private attachEventListeners(): void {
    this.attachAddButtonListener();
    this.attachDeleteButtonListeners();
    this.attachDrawToggleButtonListeners();
    this.attachGotoPositionButtonListeners();
    this.attachImageClickListeners();
    attachScrollFallback(this.container, ".gallery-item");
  }

  /**
   * 追加ボタンのイベントリスナーを設定
   */
  private attachAddButtonListener(): void {
    if (!this.options.showAddButton) return;

    const addBtn = this.container.querySelector(
      "#wps-gallery-add-btn",
    ) as HTMLButtonElement;
    addBtn?.addEventListener("click", () => {
      this.options.onAddClick?.();
    });
  }

  /**
   * 削除ボタンのイベントリスナーを設定
   */
  private attachDeleteButtonListeners(): void {
    if (!this.options.showDeleteButton || this.options.isSelectionMode) return;

    this.container.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-delete",
        );
        if (key && confirm(withOfficialNote(t`${"delete_image_confirm"}`, key))) {
          this.options.onImageDelete?.(key);
        }
      });
    });
  }

  /**
   * マップピンボタンのイベントリスナーを設定
   */
  private attachGotoPositionButtonListeners(): void {
    if (!this.options.showGotoPositionButton || this.options.isSelectionMode) {
      console.log("🔍 Goto position button disabled");
      return;
    }

    const buttons = this.container.querySelectorAll("[data-goto-position]");
    console.log("🔍 Found goto position buttons:", buttons.length);

    buttons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-goto-position",
        );
        if (!key) throw new Error("No key found on button");
        const selectedItem = this.options.items.find(
          (item) => item.key === key,
        );
        console.log("🔍 Selected item:", selectedItem);
        if (!selectedItem) throw new Error("Selected item not found");
        this.options.onGotoPosition?.(selectedItem);
      });
    });
  }
  private attachDrawToggleButtonListeners(): void {
    if (!this.options.showDrawToggleButton || this.options.isSelectionMode)
      return;

    this.container.querySelectorAll("[data-draw-toggle]").forEach((button) => {
      button.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-draw-toggle",
        );
        if (key) {
          this.options.onDrawToggle?.(key);
        }
      });
    });
  }

  /**
   * タイトルのHTMLを生成
   */
  private createTitleHtml(
    item: GalleryItem,
    hasProgress: boolean,
    hasSizeBadge: boolean,
  ): string {
    if (!item.title) return "";

    const bottomPosition = hasProgress ? "3.5rem" : "0.5rem";
    // 右下のサイズバッジと重ならないように右側を空ける
    const maxWidth = hasSizeBadge
      ? "calc(100% - 5rem)"
      : "calc(100% - 1rem)";

    return `
      <div class="absolute truncate rounded-[var(--game-radius,5px)] border border-base-300/60 bg-base-100/90 px-2 py-1 text-xs font-medium text-base-content shadow-sm"
           style="left: 0.5rem; bottom: ${bottomPosition}; z-index: 5; max-width: ${maxWidth}; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);">
        ${item.title}
      </div>
    `;
  }

  /**
   * 進捗バーのHTMLを生成
   */
  private createProgressBarHtml(item: GalleryItem): string {
    if (!item.matchedColorStats || !item.totalColorStats) return "";

    const matched = Object.values(item.matchedColorStats).reduce(
      (sum, count) => sum + count,
      0,
    );
    const total = Object.values(item.totalColorStats).reduce(
      (sum, count) => sum + count,
      0,
    );

    if (total === 0) return "";

    const remaining = total - matched;
    // 100%未満なのに100.0%と表示されるのを防ぐ（99.95%以上で丸められる）
    const rawPercentage = (matched / total) * 100;
    const percentage = remaining > 0 ? Math.min(rawPercentage, 99.9) : 100;

    // 100% Complete: リッチな達成表示（背景色は --color-warning から作るのでテーマ対応）
    if (remaining === 0) {
      const completeLogoUrl = runtime.getURL(
        "assets/images/gallery/complete-logo.png",
      );
      return `
        <div class="wps-complete" style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding-bottom: 0.2rem;">
          <div style="display: flex; flex-direction: column; align-items: center;">
            <img src="${completeLogoUrl}" alt="COMPLETE" class="wps-complete-logo" draggable="false">
            <span class="wps-complete-sub">${total.toLocaleString()} pixels</span>
          </div>
        </div>
      `;
    }

    // 進行中: 通常のプログレスゲージ
    const timeStr = this.formatEstimatedTime(remaining);
    const percentageText = percentage.toFixed(1);

    return `
      <div class="border-t border-base-300/70 bg-base-100" style="flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 0.375rem 0.625rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
          <span class="text-sm font-bold tabular-nums text-primary" style="font-family: ui-monospace, monospace; line-height: 1;">${percentageText}%</span>
          ${gaugeHtml({ percentage: Number(percentageText), style: "flex: 1;" })}
        </div>
        <div class="tabular-nums text-base-content/60" style="display: flex; justify-content: space-between; font-size: 0.6875rem; font-family: ui-monospace, monospace; letter-spacing: 0.025em; flex-wrap: wrap;">
          <span style="margin-right: 0.5rem;">${matched.toLocaleString()}/${total.toLocaleString()}</span>
          ${
            remaining > 0
              ? `<span>${remaining}px(${timeStr})</span>`
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * 予想完成時間をフォーマット (30秒/ピクセル)
   */
  private formatEstimatedTime(remainingPixels: number): string {
    const totalSeconds = remainingPixels * 30;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join("") : "<1m";
  }

  /**
   * 画像クリックのイベントリスナーを設定
   */
  private attachImageClickListeners(): void {
    this.container.querySelectorAll(".gallery-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        // 削除ボタン、描画切り替えボタン、マップピンボタンクリック時は処理しない
        if (
          (e.target as HTMLElement).closest("[data-delete]") ||
          (e.target as HTMLElement).closest("[data-draw-toggle]") ||
          (e.target as HTMLElement).closest("[data-goto-position]")
        ) {
          return;
        }

        const key = (e.currentTarget as HTMLElement).getAttribute(
          "data-item-key",
        );
        if (key) {
          const selectedItem = this.options.items.find(
            (item) => item.key === key,
          );
          if (selectedItem) {
            if (this.options.isSelectionMode) {
              // 選択モード: 選択コールバック実行
              this.options.onImageSelect?.(selectedItem);
            } else {
              // 通常モード: 画像クリックコールバック実行
              this.options.onImageClick?.(selectedItem);
            }
          }
        }
      });
    });
  }

  /**
   * コンポーネントをクリーンアップ
   */
  destroy(): void {
    this.container.innerHTML = "";
    this.tutorial.destroy();
  }
}
