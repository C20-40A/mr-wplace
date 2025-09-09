import { GalleryItem } from "../../storage";
import { GalleryRouter } from "../../router";

export class GalleryImageDetail {
  private currentItem: GalleryItem | null = null;

  render(container: HTMLElement, router: GalleryRouter, item: GalleryItem): void {
    this.currentItem = item;
    
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full">
        <div class="flex items-center justify-center" style="max-height: 70vh; max-width: 90vw;">
          <img src="${item.dataUrl}" alt="Expanded gallery item" class="" style="image-rendering: pixelated; min-width: 50vw; max-width: 90vw; max-height: 70vh; object-fit: contain; aspect-ratio: auto;">
        </div>
      </div>
    `;
  }
}
