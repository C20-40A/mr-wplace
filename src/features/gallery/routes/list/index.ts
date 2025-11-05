import { GalleryItem, GalleryStorage } from "../../storage";
import { GalleryRouter } from "../../router";
import { GalleryListUI } from "./ui";
import { getStatsPerImage } from "@/features/tile-draw-stubs";

export class GalleryList {
  private storage: GalleryStorage;
  private ui: GalleryListUI;
  private onDrawToggleCallback?: (key: string) => Promise<boolean>;

  constructor() {
    this.storage = new GalleryStorage();
    this.ui = new GalleryListUI();
  }

  async render(
    container: HTMLElement,
    router: GalleryRouter,
    onImageClick?: (item: GalleryItem) => void,
    onDrawToggle?: (key: string) => Promise<boolean>,
    onCloseModal?: () => void
  ): Promise<void> {
    this.onDrawToggleCallback = onDrawToggle;
    const items = await this.storage.getAll();

    // 描画位置がある画像の統計を取得
    const itemsWithDrawPosition = items.filter((item) => item.drawPosition);
    if (itemsWithDrawPosition.length > 0) {
      const imageKeys = itemsWithDrawPosition.map((item) => item.key);
      const statsPerImage = await getStatsPerImage(imageKeys);

      console.log("🧑‍🎨 : Fetched stats for gallery images:", statsPerImage);

      // 統計データを各アイテムに設定
      for (const item of itemsWithDrawPosition) {
        const stats = statsPerImage[item.key];
        if (stats) {
          item.matchedColorStats = stats.matched;
          item.totalColorStats = stats.total;
        }
      }
    }

    this.ui.render(
      items,
      async (key: string) => {
        await this.storage.delete(key);

        // Notify inject side to update overlay layers
        const { sendGalleryImagesToInject } = await import("@/content");
        await sendGalleryImagesToInject();

        // 再描画
        this.render(container, router, onImageClick, onDrawToggle, onCloseModal);
      },
      container,
      () => router.navigate("image-editor"),
      onImageClick,
      onCloseModal
    );
  }

  destroy(): void {
    this.ui.destroy();
  }
}
