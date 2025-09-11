import { ImageStorage, BaseImageItem } from '../../utils/image-storage';

export interface GalleryItem extends BaseImageItem {
  lat?: number;
  lng?: number;
}

export class GalleryStorage {
  private imageStorage = new ImageStorage<GalleryItem>('gallery');

  async getAll(): Promise<GalleryItem[]> {
    return this.imageStorage.getAll();
  }

  async save(item: GalleryItem): Promise<void> {
    return this.imageStorage.save(item);
  }

  async delete(key: string): Promise<void> {
    return this.imageStorage.delete(key);
  }
}
