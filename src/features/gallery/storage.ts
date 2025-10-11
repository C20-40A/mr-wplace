import { ImageStorage, BaseImageItem } from "../../utils/image-storage";

export interface DrawPosition {
  TLX: number;
  TLY: number;
  PxX: number;
  PxY: number;
}

export interface GalleryItem extends BaseImageItem {
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  currentColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
}

export class GalleryStorage {
  private imageStorage = new ImageStorage<GalleryItem>("gallery");

  async getAll(): Promise<GalleryItem[]> {
    const items = await this.imageStorage.getAll();

    // hasDrawPositionを計算して追加
    return items.map((item) => ({
      ...item,
      hasDrawPosition: !!item.drawPosition,
    }));
  }

  async save(item: GalleryItem): Promise<void> {
    return this.imageStorage.save(item);
  }

  async delete(key: string): Promise<void> {
    return this.imageStorage.delete(key);
  }
}
