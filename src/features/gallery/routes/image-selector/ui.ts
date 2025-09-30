import { ImageSelector } from "../../components/ImageSelector";
import { ImageItem } from "../list/components";
import { GalleryStorage } from "../../storage";

export class GalleryImageSelectorUI {
  private imageSelector: ImageSelector | null = null;

  /**
   * 画像選択UIをレンダリング
   */
  async render(
    container: HTMLElement,
    onSelect: (item: ImageItem) => void,
    onAddClick?: () => void
  ): Promise<void> {
    // ギャラリーから画像データを取得
    const galleryStorage = new GalleryStorage();
    const galleryItems = await galleryStorage.getAll();

    // GalleryItemをImageItemに変換
    const items = this.convertGalleryItemsToImageItems(galleryItems);

    // 既存のImageSelectorがあれば破棄
    this.imageSelector?.destroy();

    // 新しいImageSelectorを作成
    this.imageSelector = new ImageSelector({
      items,
      onSelect,
      onAddClick,
    });

    this.imageSelector.render(container);
  }

  /**
   * GalleryItemをImageItemに変換
   */
  private convertGalleryItemsToImageItems(galleryItems: any[]): ImageItem[] {
    return galleryItems.map((item) => ({
      key: item.key,
      dataUrl: item.dataUrl,
      // タイトルや日付は表示しない
      title: undefined,
      createdAt: new Date(item.timestamp).toISOString(),
      drawEnabled: item.drawEnabled,
      hasDrawPosition: !!item.drawPosition,
    }));
  }

  /**
   * コンポーネントをクリーンアップ
   */
  destroy(): void {
    this.imageSelector?.destroy();
    this.imageSelector = null;
  }
}
