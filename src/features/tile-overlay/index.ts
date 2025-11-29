import { latLngToTilePixel } from "@/utils/coordinate";
import { GalleryItem, GalleryStorage } from "@/states/galleryStorage";

export class TileOverlay {
  private galleryStorage: GalleryStorage;

  constructor() {
    this.galleryStorage = new GalleryStorage();
  }

  async drawImageAt(
    lat: number,
    lng: number,
    galleryItem: GalleryItem
  ): Promise<void> {
    window.postMessage({ source: "wplace-studio-drawing-start" }, "*");

    const coords = latLngToTilePixel(lat, lng);
    await this.drawImageWithCoords(coords, galleryItem);

    // Don't hide loader here - wait for next tile fetch to complete
  }

  async drawImageWithCoords(
    coords: { TLX: number; TLY: number; PxX: number; PxY: number },
    galleryItem: GalleryItem
  ): Promise<void> {
    await this.saveDrawPosition(galleryItem.key, coords);

    // Update inject side with new gallery images
    // Inject side will handle addImageToOverlayLayers
    const { sendGalleryImagesToInject } = await import("@/content");
    await sendGalleryImagesToInject();
  }

  private async saveDrawPosition(
    imageKey: string,
    coords: { TLX: number; TLY: number; PxX: number; PxY: number }
  ): Promise<void> {
    const images = await this.galleryStorage.getAll();
    const image = images.find((i) => i.key === imageKey);
    if (!image) throw new Error(`Image not found: ${imageKey}`);

    await this.galleryStorage.save({
      ...image,
      drawPosition: coords,
      drawEnabled: true,
    });
  }

  async toggleImageDrawState(imageKey: string): Promise<boolean> {
    const images = await this.galleryStorage.getAll();
    const image = images.find((i) => i.key === imageKey);

    if (!image) {
      console.warn(`🧑‍🎨 : Image not found: ${imageKey}`);
      return false;
    }

    const updatedImage = {
      ...image,
      drawEnabled: !image.drawEnabled,
    };

    await this.galleryStorage.save(updatedImage);

    // Notify inject side to update overlay layers
    const { sendGalleryImagesToInject } = await import("@/content");
    await sendGalleryImagesToInject();

    return updatedImage.drawEnabled;
  }
}
