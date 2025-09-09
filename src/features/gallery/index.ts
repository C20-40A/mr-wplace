import { Toolbar } from "../../components/toolbar";
import { GalleryItem } from "./storage";
import { GalleryRouter } from "./router";
import { GalleryUI } from "./ui";
import { GalleryList } from "./routes/list";
import { GalleryImageEditor } from "./routes/image-editor";
import { GalleryImageDetail } from "./routes/image-detail";

export class Gallery {
  private button: HTMLButtonElement | null = null;
  private toolbar: Toolbar;
  private router: GalleryRouter;
  private ui: GalleryUI;
  private listRoute: GalleryList;
  private imageEditorRoute: GalleryImageEditor;
  private imageDetailRoute: GalleryImageDetail;

  // 選択モード用の状態
  private isSelectionMode: boolean = false;
  private onSelectCallback?: (item: GalleryItem) => void;
  private currentDetailItem?: GalleryItem;

  constructor(toolbar: Toolbar) {
    this.toolbar = toolbar;
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
    // ツールバーボタン作成
    this.createButton();

    // ルーティング設定（UIとコンテンツ両方を更新）
    this.router.setOnRouteChange((route) => {
      this.ui.updateHeader(route); // ヘッダー更新
      this.renderCurrentRoute(route); // コンテンツ更新
    });
  }

  private createButton(): void {
    this.button = this.toolbar.addButton({
      icon: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd"/>
        </svg>
      `,
      title: "ギャラリー",
      onClick: () => this.show(),
    });
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
