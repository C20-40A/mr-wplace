import { GalleryItem } from "@/states/galleryStorage";
import { ImageGridComponent } from "./components/ImageGridComponent";
import { gotoMapPosition, toggleDrawState } from "../../common-actions";
import { t } from "@/i18n";
import { showFeatureHint } from "@/features/feature-hints";
import { runtime } from "@/utils/browser-api";
import { Toast } from "@/components/toast";
import { exportGallery } from "@/utils/inject-bridge";
import { showDownloadFormatDialog } from "../image-detail/download-dialog";

export type GallerySortType = "layer" | "distance" | "created";

export class GalleryListUI {
  private container: HTMLElement | null = null;
  private imageGrid: ImageGridComponent | null = null;
  private importListener: ((e: MessageEvent) => void) | null = null;

  // コールバックを保存して再描画時に再利用
  private onDelete?: (key: string) => void;
  private onImageClick?: (item: GalleryItem) => void;
  private onAddClick?: () => void;
  private onCloseModal?: () => void;
  private onSortChange?: (sortType: GallerySortType) => void;
  private onRefresh?: () => void; // 統計データ込みで再描画
  private sortType: GallerySortType = "layer";

  constructor() {}

  render(
    items: GalleryItem[],
    onDelete: (key: string) => void,
    container?: HTMLElement,
    onAddClick?: () => void,
    onImageClick?: (item: GalleryItem) => void,
    onCloseModal?: () => void,
    sortType?: GallerySortType,
    onSortChange?: (sortType: GallerySortType) => void,
    onRefresh?: () => void,
  ): void {
    if (!container) return;

    // 状態を保存
    this.container = container;
    this.onDelete = onDelete;
    this.onImageClick = onImageClick;
    this.onAddClick = onAddClick;
    this.onCloseModal = onCloseModal;
    this.onSortChange = onSortChange;
    this.onRefresh = onRefresh;
    if (sortType) this.sortType = sortType;

    this.renderGalleryList(items);
  }

  private renderGalleryList(items: GalleryItem[]): void {
    if (!this.container) return;

    this.container.innerHTML = "";
    this.container.style.paddingBottom = "1.6rem"; // 下部スペース確保（FABと被らないように）

    // Sort dropdown + Import/Export buttons
    const sortContainer = document.createElement("div");
    sortContainer.className = "flex items-center gap-2 mb-4";
    sortContainer.innerHTML = `
      <select id="wps-gallery-sort" class="select select-sm select-bordered">
        <option value="layer">${t`${"sort_layer"}`}</option>
        <option value="distance">${t`${"sort_distance"}`}</option>
        <option value="created">${t`${"sort_created"}`}</option>
      </select>
      <button id="wps-gallery-import-export-btn" class="btn btn-outline btn-sm ml-auto">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
          <path d="M440-367v-465l-64 64-56-57 160-160 160 160-56 57-64-64v465h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
        </svg>
        ${t`${"import_export"}`}
      </button>
    `;
    this.container.appendChild(sortContainer);

    const sortSelect = sortContainer.querySelector(
      "#wps-gallery-sort",
    ) as HTMLSelectElement;
    sortSelect.value = this.sortType;
    sortSelect.addEventListener("change", (e) => {
      this.sortType = (e.target as HTMLSelectElement).value as GallerySortType;
      this.onSortChange?.(this.sortType);
    });

    // Import/Export dropdown menu
    const importExportBtn = sortContainer.querySelector(
      "#wps-gallery-import-export-btn",
    ) as HTMLButtonElement;
    importExportBtn.addEventListener("click", () => {
      this.showImportExportMenu(importExportBtn);
    });
    showFeatureHint("gallery-import-export-btn", importExportBtn);

    // Grid container
    const gridContainer = document.createElement("div");
    this.container.appendChild(gridContainer);

    if (this.imageGrid) this.imageGrid.destroy();

    this.imageGrid = new ImageGridComponent(gridContainer, {
      items,
      isSelectionMode: false,
      onImageClick: (item) => this.onImageClick?.(item),
      onDrawToggle: (key) => this.handleDrawToggle(key),
      onImageDelete: (key) => this.onDelete?.(key),
      onGotoPosition: (item) => this.handleGotoPosition(item),
      onAddClick: () => this.onAddClick?.(),
      showDeleteButton: true,
      showAddButton: true,
    });

    this.imageGrid.render();
  }

  private showImportExportMenu(anchor: HTMLElement): void {
    // 既存メニューがあれば閉じる
    const existing = document.getElementById("wps-gallery-io-menu");
    if (existing) {
      existing.remove();
      return;
    }

    const menu = document.createElement("div");
    menu.id = "wps-gallery-io-menu";
    menu.className = "menu bg-base-200 rounded-box shadow-lg p-2";
    menu.style.cssText = "position:absolute;z-index:20;min-width:10rem;";
    menu.innerHTML = `
      <li><button id="wps-gallery-export-action" class="btn btn-ghost btn-sm justify-start w-full">📤 ${t`${"export_gallery"}`}</button></li>
      <li><button id="wps-gallery-import-action" class="btn btn-ghost btn-sm justify-start w-full">📥 ${t`${"import_gallery"}`}</button></li>
    `;

    // anchorの下に配置
    anchor.style.position = "relative";
    anchor.parentElement!.style.position = "relative";
    const rect = anchor.getBoundingClientRect();
    const parentRect = anchor.parentElement!.getBoundingClientRect();
    menu.style.top = `${rect.bottom - parentRect.top}px`;
    menu.style.right = "0";

    anchor.parentElement!.appendChild(menu);

    // Export
    menu
      .querySelector("#wps-gallery-export-action")!
      .addEventListener("click", () => {
        menu.remove();
        this.handleExport();
      });

    // Import
    menu
      .querySelector("#wps-gallery-import-action")!
      .addEventListener("click", () => {
        menu.remove();
        this.handleImport();
      });

    // 外部クリックで閉じる
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    requestAnimationFrame(() => document.addEventListener("click", closeMenu));
  }

  private async handleExport(): Promise<void> {
    const btn = document.getElementById(
      "wps-gallery-import-export-btn",
    ) as HTMLButtonElement | null;
    if (!btn || btn.disabled) return;

    const format = await showDownloadFormatDialog(true);
    if (!format) return;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    const setLabel = (text: string) => {
      btn.textContent = text;
    };
    setLabel(t`${"exporting"}`);

    try {
      const workerUrl = runtime.getURL(
        "dist/inject/workers/gallery-export.worker.js",
      );
      const result = await exportGallery(workerUrl, format, (progress) => {
        if (progress.phase === "read") {
          setLabel(`${progress.current}/${progress.total}`);
        } else {
          setLabel(`${Math.round(progress.percent)}%`);
        }
      });

      if (result.status === "empty") {
        Toast.error(t`${"no_images_to_export"}`);
        return;
      }
      Toast.success(t`${"download_success"}`);
    } catch (error) {
      console.error("🧑‍🎨 : Gallery export failed", error);
      Toast.error(t`${"export_failed"}`);
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }

  private handleImport(): void {
    // Import後のレスポンスを待ってリフレッシュ
    this.cleanupImportListener();
    this.importListener = (e: MessageEvent) => {
      if (e.data?.source !== "mr-wplace-gallery-import-response") return;
      this.cleanupImportListener();

      if (e.data.result?.success > 0) {
        // inject側のオーバーレイも更新
        import("@/content").then(({ sendGalleryImagesToInject }) =>
          sendGalleryImagesToInject(),
        );
        this.onRefresh?.();
      }
    };
    window.addEventListener("message", this.importListener);

    window.postMessage(
      { source: "mr-wplace-gallery-import", requestId: Date.now().toString() },
      "*",
    );
  }

  private cleanupImportListener(): void {
    if (this.importListener) {
      window.removeEventListener("message", this.importListener);
      this.importListener = null;
    }
  }

  private async handleDrawToggle(key: string): Promise<void> {
    const newDrawEnabled = await toggleDrawState(key);
    console.log(`🧑‍🎨 : Draw toggle: ${key} -> ${newDrawEnabled}`);

    // 統計データ込みで再描画 (onRefreshがあればそれを使用)
    this.onRefresh?.();
  }

  private async handleGotoPosition(item: GalleryItem): Promise<void> {
    await gotoMapPosition(item);
    this.onCloseModal?.();
  }

  destroy(): void {
    this.cleanupImportListener();
    if (this.imageGrid) {
      this.imageGrid.destroy();
      this.imageGrid = null;
    }
  }
}
