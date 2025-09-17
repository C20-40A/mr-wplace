import { GalleryItem } from "./storage";
import { gotoPosition } from "../../utils/position";
import { tilePixelToLatLng } from "../../utils/coordinate";

/**
 * ギャラリー画像に対する共通アクション
 */
export class GalleryImageActions {
  /**
   * 描画ON/OFFトグル
   */
  static async toggleDrawState(key: string): Promise<boolean> {
    const tileOverlay = (window as any).wplaceStudio?.tileOverlay;
    if (!tileOverlay) {
      throw new Error("TileOverlay not available");
    }
    return await tileOverlay.toggleImageDrawState(key);
  }

  /**
   * マップへ移動
   */
  static async gotoMapPosition(item: GalleryItem): Promise<void> {
    if (!item.drawPosition) {
      throw new Error("Item has no drawPosition");
    }

    const { lat, lng } = tilePixelToLatLng(
      item.drawPosition.TLX,
      item.drawPosition.TLY,
      item.drawPosition.PxX,
      item.drawPosition.PxY
    );

    gotoPosition({ lat, lng, zoom: 14 });
  }
}
