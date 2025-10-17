import { GalleryItem } from "./storage";
import { GalleryRouter } from "./router";
import { createGalleryButton, GalleryUI } from "./ui";
import { GalleryList } from "./routes/list";
import { GalleryImageEditor } from "./routes/image-editor";
import { GalleryImageDetail } from "./routes/image-detail";
import { GalleryImageShare } from "./routes/image-share";
import { GalleryImageSelector } from "./routes/image-selector";
import { setupElementObserver } from "../../components/element-observer";
import { findOpacityContainer } from "../../constants/selectors";
import type { GalleryAPI } from "../../core/di";

// ========================================
// 内部実装クラス（外部には公開しない）
// ========================================

class Gallery {
  private router: GalleryRouter;
  private ui: GalleryUI;
  private listRoute: GalleryList;
  private imageEditorRoute: GalleryImageEditor;
  private imageDetailRoute: GalleryImageDetail;
  private imageShareRoute: GalleryImageShare;
  private imageSelectorRoute: GalleryImageSelector;
  private onDrawToggleCallback?: (key: string) => Promise<boolean>;

  // 状態管理
  private currentDetailItem?: GalleryItem;
  private imageSelectorOnSelect?: (item: GalleryItem) => void;

  constructor() {
    this.router = new GalleryRouter();
    this.ui = new GalleryUI(this.router);
    this.listRoute = new GalleryList();
    this.imageEditorRoute = new GalleryImageEditor();
    this.imageDetailRoute = new GalleryImageDetail();
    this.imageShareRoute = new GalleryImageShare();
    this.imageSelectorRoute = new GalleryImageSelector();
    this.init();
  }

  private init(): void {
    this.router.setOnRouteChange((route) => {
      this.renderCurrentRoute(route); // コンテンツ更新
    });

    setupElementObserver([
      {
        id: "gallery-btn",
        getTargetElement: findOpacityContainer,
        createElement: (container) => {
          const button = createGalleryButton();
          button.id = "gallery-btn"; // 重複チェック用ID設定
          button.addEventListener("click", () => this.show());
          container?.appendChild(button);
        },
      },
    ]);
  }

  private renderCurrentRoute(route: string): void {
    const container = this.ui.getContainer();
    if (!container) return;

    switch (route) {
      case "list":
        this.listRoute.render(
          container,
          this.router,
          (item) => this.showImageDetail(item),
          this.onDrawToggleCallback,
          () => this.ui.closeModal()
        );
        break;
      case "image-editor":
        this.imageEditorRoute.setOnSaveSuccess(() =>
          this.router.navigateBack()
        );
        this.imageEditorRoute.render(container);
        break;
      case "image-detail":
        if (this.currentDetailItem) {
          this.imageDetailRoute.render(
            container,
            this.router,
            this.currentDetailItem,
            async (key: string) => {
              // 削除処理
              const { GalleryStorage } = await import("./storage");
              const storage = new GalleryStorage();
              await storage.delete(key);

              // 一覧に戻る
              this.router.navigateBack();
            }
          );
        }
        break;
      case "image-selector":
        this.imageSelectorRoute.render(
          container,
          this.router,
          (item) => {
            // ImageItem → GalleryItem変換してimageSelectorOnSelect実行
            if (this.imageSelectorOnSelect) {
              // ImageItemのkeyでGalleryItemを検索
              this.findGalleryItemByKey(item.key).then((galleryItem) => {
                if (galleryItem) {
                  this.imageSelectorOnSelect!(galleryItem);
                  // 選択後にmodal閉じる
                  this.ui.closeModal();
                }
              });
            }
          },
          () => this.router.navigate("image-editor") // onAddClick
        );
        break;
      case "image-share":
        if (this.currentDetailItem) {
          this.imageShareRoute.render(container, this.currentDetailItem);
        }
        break;
    }
  }

  private showImageDetail(item: GalleryItem): void {
    this.currentDetailItem = item;
    this.router.navigate("image-detail");
  }

  // 外部インターフェース
  show(): void {
    this.router.initialize("list");
    this.ui.showModal();
  }

  showSelectionMode(onSelect: (item: GalleryItem) => void): void {
    this.imageSelectorOnSelect = onSelect;
    this.router.initialize("image-selector");
    this.ui.showModal();
  }

  /**
   * 描画切り替えコールバックを設定
   */
  setDrawToggleCallback(callback: (key: string) => Promise<boolean>): void {
    this.onDrawToggleCallback = callback;
  }

  /**
   * キーでGalleryItemを検索
   */
  private async findGalleryItemByKey(key: string): Promise<GalleryItem | null> {
    const { GalleryStorage } = await import("./storage");
    const storage = new GalleryStorage();
    const items = await storage.getAll();
    return items.find((item) => item.key === key) || null;
  }

  /**
   * Image Editorへ遷移（外部から呼び出し用）
   */
  navigateToImageEditor(): void {
    this.router.navigate("image-editor");
    this.ui.showModal();
  }
}

// ========================================
// DI Container対応 - 関数型API
// ========================================

let galleryInstance: Gallery | null = null;

const initGallery = (): void => {
  console.log("🧑‍🎨 : Initializing Gallery");
  galleryInstance = new Gallery();
};

const showGallery = (): void => {
  if (!galleryInstance) throw new Error("Gallery not initialized");
  galleryInstance.show();
};

const showSelectionMode = (onSelect: (item: GalleryItem) => void): void => {
  if (!galleryInstance) throw new Error("Gallery not initialized");
  galleryInstance.showSelectionMode(onSelect);
};

const setDrawToggleCallback = (
  callback: (key: string) => Promise<boolean>
): void => {
  if (!galleryInstance) throw new Error("Gallery not initialized");
  galleryInstance.setDrawToggleCallback(callback);
};

// ========================================
// DI Container用公開API（これだけがexportされる）
// ========================================

export const galleryAPI: GalleryAPI = {
  initGallery,
  showGallery,
  showSelectionMode,
  setDrawToggleCallback,
};
