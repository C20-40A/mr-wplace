import { GalleryItem, GalleryStorage } from "../../storage";
import { GalleryRouter } from "../../router";
import { ImageGridComponent, ImageItem } from "./components/ImageGridComponent";

export class GalleryList {
  private storage: GalleryStorage;
  private imageGrid: ImageGridComponent | null = null;

  constructor() {
    this.storage = new GalleryStorage();
  }

  async render(
    container: HTMLElement,
    router: GalleryRouter,
    isSelectionMode: boolean = false,
    onSelect?: (item: GalleryItem) => void,
    onImageClick?: (item: GalleryItem) => void
  ): Promise<void> {
    const items = await this.storage.getAll();
    
    // GalleryItemをImageItemに変換
    const imageItems: ImageItem[] = items.map(item => ({
      key: item.key,
      dataUrl: item.dataUrl,
      createdAt: new Date(item.timestamp).toISOString()
    }));

    // 既存のImageGridComponentがあれば破棄
    if (this.imageGrid) {
      this.imageGrid.destroy();
    }

    // 新しいImageGridComponentを作成
    this.imageGrid = new ImageGridComponent(container, {
      items: imageItems,
      isSelectionMode,
      onImageClick: (item) => {
        const galleryItem = items.find(gItem => gItem.key === item.key);
        if (galleryItem && onImageClick) {
          onImageClick(galleryItem);
        }
      },
      onImageSelect: (item) => {
        const galleryItem = items.find(gItem => gItem.key === item.key);
        if (galleryItem && onSelect) {
          onSelect(galleryItem);
        }
      },
      onImageDelete: async (key) => {
        await this.storage.delete(key);
        // 再描画
        this.render(container, router, isSelectionMode, onSelect, onImageClick);
      },
      onAddClick: () => {
        console.log("Navigate to image editor");
        router.navigate("image-editor");
      },
      showDeleteButton: !isSelectionMode,
      showAddButton: true
    });

    // レンダリング
    this.imageGrid.render();
  }

  destroy(): void {
    if (this.imageGrid) {
      this.imageGrid.destroy();
      this.imageGrid = null;
    }
  }
}
