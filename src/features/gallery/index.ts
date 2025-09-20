import { GalleryItem } from "./storage";
import { GalleryRouter } from "./router";
import { createGalleryButton, GalleryUI } from "./ui";
import { GalleryList } from "./routes/list";
import { GalleryImageEditor } from "./routes/image-editor";
import { GalleryImageDetail } from "./routes/image-detail";
import { setupElementObserver } from "../../components/element-observer";
import { SELECTORS } from "../../constants/selectors";

export class Gallery {
  private button: HTMLButtonElement | null = null;
  private router: GalleryRouter;
  private ui: GalleryUI;
  private listRoute: GalleryList;
  private imageEditorRoute: GalleryImageEditor;
  private imageDetailRoute: GalleryImageDetail;
  private onDrawToggleCallback?: (key: string) => Promise<boolean>;

  // 選択モード用の状態
  private isSelectionMode: boolean = false;
  private onSelectCallback?: (item: GalleryItem) => void;
  private currentDetailItem?: GalleryItem;

  constructor() {
    this.router = new GalleryRouter();
    this.ui = new GalleryUI(this.router);
    this.listRoute = new GalleryList();
    this.imageEditorRoute = new GalleryImageEditor();
    this.imageDetailRoute = new GalleryImageDetail();
    this.init();
  }

  private init(): void {
    this.router.setOnRouteChange((route) => {
      this.renderCurrentRoute(route); // コンテンツ更新
    });

    setupElementObserver([
      {
        id: "gallery-btn",
        selector: SELECTORS.galleryButton,
        containerSelector: SELECTORS.toggleOpacityButton,
        create: this.createGalleryFAB.bind(this),
      },
    ]);
  }

  // ボタンを作成するメソッド（外部から呼び出される）
  createGalleryFAB(toggleButton: Element): HTMLButtonElement {
    this.button = createGalleryButton(toggleButton);
    this.button.addEventListener("click", () => this.show());
    return this.button;
  }

  private renderCurrentRoute(route: string): void {
    const container = this.ui.getContainer();
    if (!container) return;

    switch (route) {
      case "list":
        this.listRoute.render(
          container,
          this.router,
          this.isSelectionMode,
          this.onSelectCallback,
          (item) => this.showImageDetail(item),
          this.onDrawToggleCallback
        );
        break;
      case "image-editor":
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
    }
  }

  private showImageDetail(item: GalleryItem): void {
    this.currentDetailItem = item;
    this.router.navigate("image-detail");
  }

  // 外部インターフェース（互換性維持）
  async show(
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void
  ): Promise<void> {
    this.isSelectionMode = isSelectionMode;
    this.onSelectCallback = onSelect;

    this.router.initialize("list");
    this.ui.showModal();
  }

  showSelectionMode(onSelect: (item: GalleryItem) => void): void {
    this.show(true, onSelect);
  }

  /**
   * 描画切り替えコールバックを設定
   */
  setDrawToggleCallback(callback: (key: string) => Promise<boolean>): void {
    this.onDrawToggleCallback = callback;
  }
}
