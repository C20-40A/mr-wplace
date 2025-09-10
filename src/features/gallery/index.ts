import { GalleryItem } from "./storage";
import { GalleryRouter } from "./router";
import { GalleryUI } from "./ui";
import { GalleryList } from "./routes/list";
import { GalleryImageEditor } from "./routes/image-editor";
import { GalleryImageDetail } from "./routes/image-detail";
import { FavoriteUI } from "../favorite/ui";

export class Gallery {
  private button: HTMLButtonElement | null = null;
  private router: GalleryRouter;
  private ui: GalleryUI;
  private listRoute: GalleryList;
  private imageEditorRoute: GalleryImageEditor;
  private imageDetailRoute: GalleryImageDetail;

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
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setupRouting());
    } else {
      this.setupRouting();
    }
  }

  private setupRouting(): void {
    // ルーティング設定（UIとコンテンツ両方を更新）
    this.router.setOnRouteChange((route) => {
      this.ui.updateHeader(route); // ヘッダー更新
      this.renderCurrentRoute(route); // コンテンツ更新
    });
  }

  // ボタンを作成するメソッド（外部から呼び出される）
  createButton(toggleButton: Element): HTMLButtonElement {
    this.button = FavoriteUI.createGalleryButton(toggleButton);
    this.button.addEventListener('click', () => this.show());
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
          (item) => this.showImageDetail(item)
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
            this.currentDetailItem
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

    this.router.navigate("list");
    this.ui.showModal();
  }

  showSelectionMode(onSelect: (item: GalleryItem) => void): void {
    this.show(true, onSelect);
  }
}
