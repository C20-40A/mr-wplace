import { GalleryRouter, GalleryRoute } from "./router";
import { t } from "../../i18n";

export class GalleryUI {
  private modal: HTMLDialogElement | null = null;
  private container: HTMLElement | null = null;
  private headerTitle: HTMLElement | null = null;
  private backButton: HTMLElement | null = null;
  private router: GalleryRouter;

  constructor(router: GalleryRouter) {
    this.router = router;
    this.createModal();
  }

  showModal(): void {
    this.modal?.showModal();
  }

  closeModal(): void {
    this.modal?.close();
  }

  getContainer(): HTMLElement | null {
    return this.container;
  }

  updateHeader(route: GalleryRoute): void {
    console.log("updateHeader called with route:", route);
    if (this.headerTitle) {
      const titles = {
        list: t`${'gallery'}`,
        "image-editor": t`${'image_editor'}`,
        "image-detail": t`${'image_detail'}`,
      };
      this.headerTitle.textContent = titles[route];
      console.log("Header title updated to:", titles[route]);
    }

    if (this.backButton) {
      const shouldShow = this.router.canNavigateBack();
      this.backButton.style.display = shouldShow ? "flex" : "none";
      console.log("Back button display:", shouldShow ? "visible" : "hidden");
    }
  }

  private createModal(): void {
    this.modal = document.createElement("dialog");
    this.modal.className = "modal";
    this.modal.innerHTML = t`
      <div class="modal-box max-w-6xl relative">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <div class="flex items-center gap-2 mb-4">
          <button id="wps-gallery-back-btn" class="btn btn-sm btn-ghost" style="display: none;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z" clip-rule="evenodd"/>
            </svg>
            ${'back'}
          </button>
          <h3 id="wps-gallery-title" class="text-lg font-bold">${'gallery'}</h3>
        </div>
        
        <div id="wps-gallery-container" style="min-height: 400px;">
          <!-- ルーティングされたコンテンツがここに表示されます -->
        </div>
      </div>
      
      <form method="dialog" class="modal-backdrop">
        <button>${'close'}</button>
      </form>
    `;

    document.body.appendChild(this.modal);
    this.container = document.getElementById("wps-gallery-container");
    this.headerTitle = document.getElementById("wps-gallery-title");
    this.backButton = document.getElementById("wps-gallery-back-btn");

    // 戻るボタンのイベントリスナー
    this.backButton?.addEventListener("click", () => {
      this.router.navigateBack();
    });
  }
}
