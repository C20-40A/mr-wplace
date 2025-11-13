import { GalleryItem, GalleryStorage } from "../../storage";
import { GalleryRouter } from "../../router";
import { GalleryListUI, GallerySortType } from "./ui";
import { getStatsPerImage } from "@/utils/inject-bridge";
import { storage as browserStorage } from "@/utils/browser-api";
import { getCurrentPosition } from "@/utils/position";
import { llzToTilePixel } from "@/utils/coordinate";

const SORT_KEY = "wplace-studio-gallery-sort";

export class GalleryList {
  private storage: GalleryStorage;
  private ui: GalleryListUI;
  private onDrawToggleCallback?: (key: string) => Promise<boolean>;

  constructor() {
    this.storage = new GalleryStorage();
    this.ui = new GalleryListUI();
  }

  private sortItems(items: GalleryItem[], sortType: GallerySortType): GalleryItem[] {
    const sorted = [...items];

    switch (sortType) {
      case "layer": {
        // レイヤー順（layerOrderが高い順 = 前面に表示されるものが上）
        return sorted.sort((a, b) => {
          const aHasDrawPos = !!a.drawPosition;
          const bHasDrawPos = !!b.drawPosition;

          // 描画位置がない画像は後ろに
          if (!aHasDrawPos && !bHasDrawPos) return 0;
          if (!aHasDrawPos) return 1;
          if (!bHasDrawPos) return -1;

          // 両方に描画位置がある場合、layerOrderで降順ソート
          return (b.layerOrder || 0) - (a.layerOrder || 0);
        });
      }

      case "distance": {
        // 距離が近い順
        const currentPos = getCurrentPosition();
        if (!currentPos) return sorted;

        // 現在位置をタイル座標に変換
        const { TLX: currentTileX, TLY: currentTileY } = llzToTilePixel(
          currentPos.lat,
          currentPos.lng
        );

        return sorted.sort((a, b) => {
          const aPosExists = !!a.drawPosition;
          const bPosExists = !!b.drawPosition;

          // 描画位置がない画像は後ろに
          if (!aPosExists && !bPosExists) return 0;
          if (!aPosExists) return 1;
          if (!bPosExists) return -1;

          // 距離を計算（タイル座標で計算）
          const aDistance = Math.sqrt(
            Math.pow(a.drawPosition!.TLX - currentTileX, 2) +
              Math.pow(a.drawPosition!.TLY - currentTileY, 2)
          );
          const bDistance = Math.sqrt(
            Math.pow(b.drawPosition!.TLX - currentTileX, 2) +
              Math.pow(b.drawPosition!.TLY - currentTileY, 2)
          );

          return aDistance - bDistance;
        });
      }

      case "created":
        // 追加順（新しい順）
        return sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      default:
        return sorted;
    }
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

    // ソート設定を取得
    const result = await browserStorage.get([SORT_KEY]);
    const sortType: GallerySortType = result[SORT_KEY] || "layer";

    // アイテムをソート
    const sortedItems = this.sortItems(items, sortType);

    // 描画位置がある画像の統計を取得
    const itemsWithDrawPosition = sortedItems.filter((item) => item.drawPosition);
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
      sortedItems,
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
      onCloseModal,
      sortType,
      async (newSortType: GallerySortType) => {
        // ソート設定を保存
        await browserStorage.set({ [SORT_KEY]: newSortType });
        // 再描画
        this.render(container, router, onImageClick, onDrawToggle, onCloseModal);
      }
    );
  }

  destroy(): void {
    this.ui.destroy();
  }
}
