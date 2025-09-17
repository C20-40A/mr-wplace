import { t } from "../../../../i18n/manager";

export interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onClear: () => void;
  onPaidToggle: (includePaid: boolean) => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}

export class ImageEditorUI {
  private container: HTMLElement | null = null;
  private callbacks: ImageEditorCallbacks | null = null;

  constructor() {}

  createAndGetContainer(): HTMLElement {
    this.container = document.createElement("div");
    this.container.id = "wps-image-editor-container";
    return this.container;
  }

  getContainer(): HTMLElement | null {
    return this.container;
  }

  setupUI(callbacks: ImageEditorCallbacks): void {
    if (!this.container) return;
    
    this.callbacks = callbacks;
    this.createUI();
    this.setupImageUpload();
    this.setupScaleControl();
  }

  private createUI(): void {
    if (!this.container) return;
    
    this.container.innerHTML = t`
      <div id="wps-image-area" class="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4 min-h-80">
        <div id="wps-dropzone" class="flex items-center justify-center h-full text-center">
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 mx-auto mb-4 text-gray-400">
              <path fill-rule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06L12.75 4.81V15a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25A1.5 1.5 0 005.25 21h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
            </svg>
            <p class="text-gray-600 mb-2">${'drag_drop_or_click'}</p>
            <input type="file" id="wps-file-input" accept="image/*" class="hidden">
          </div>
        </div>
        
        <div id="wps-image-display" class="hidden relative">
          <button id="wps-clear-btn" class="btn btn-xs btn-circle btn-ghost absolute -top-2 -right-2 z-10 opacity-60 hover:opacity-100" title="${'clear_image'}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3">
              <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>
            </svg>
          </button>
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center">
              <h4 class="text-sm font-medium mb-2">${'original_image'}</h4>
              <img id="wps-original-image" class="border rounded shadow" style="max-width: 300px; max-height: 300px; object-fit: contain; image-rendering: pixelated; image-rendering: crisp-edges;" alt="Original">
            </div>
            <div class="text-center relative">
              <h4 class="text-sm font-medium mb-2">${'current_image'}</h4>
              <div class="canvas-container" style="width: 300px; height: 300px; border: 1px solid #d1d5db; border-radius: 0.375rem; overflow: hidden; position: relative; margin: 0 auto; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                <canvas id="wps-scaled-canvas" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></canvas>
              </div>
              <p class="text-xs text-gray-500 mt-2">${'scroll_to_zoom'}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div id="wps-controls" class="hidden space-y-4">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="text-sm">
            <span class="font-medium">${'original_size'}:</span> <span id="wps-original-size">-</span>
          </div>
          <div class="text-sm">
            <span class="font-medium">${'current_size'}:</span> <span id="wps-current-size">-</span>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">${'size_reduction'}: <span id="wps-scale-value">1.0</span>x</label>
          <input type="range" id="wps-scale-slider" min="0.1" max="1" step="0.05" value="1" class="w-full">
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.1x</span>
            <span>1.0x</span>
          </div>
        </div>
        <div>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="wps-paid-toggle" checked class="checkbox checkbox-xs">
            <span class="text-sm">${'include_paid_colors'}</span>
          </label>
        </div>
        
        <div id="wps-action-buttons" class="hidden flex gap-2 mt-4">
          <button id="wps-add-to-gallery" class="btn btn-primary flex-1">${'add_to_gallery'}</button>
          <button id="wps-download" class="btn btn-ghost">${'download'}</button>
        </div>
      </div>
    `;
  }

  private setupImageUpload(): void {
    if (!this.container || !this.callbacks) return;

    const dropzone = this.container.querySelector("#wps-dropzone");
    const fileInput = this.container.querySelector("#wps-file-input") as HTMLInputElement;
    const imageArea = this.container.querySelector("#wps-image-area") as HTMLElement;

    dropzone?.addEventListener("click", () => fileInput?.click());

    dropzone?.addEventListener("dragover", (e) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      if (imageArea) {
        imageArea.style.borderColor = "#3b82f6";
        imageArea.style.backgroundColor = "#eff6ff";
      }
    });

    dropzone?.addEventListener("dragleave", () => {
      if (imageArea) {
        imageArea.style.borderColor = "#d1d5db";
        imageArea.style.backgroundColor = "";
      }
    });

    dropzone?.addEventListener("drop", (e) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      if (imageArea) {
        imageArea.style.borderColor = "#d1d5db";
        imageArea.style.backgroundColor = "";
      }

      const files = dragEvent.dataTransfer?.files;
      if (files && files[0]) {
        this.callbacks?.onFileHandle(files[0]);
      }
    });

    fileInput?.addEventListener("change", (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        this.callbacks?.onFileHandle(files[0]);
      }
    });
  }

  private setupScaleControl(): void {
    if (!this.container || !this.callbacks) return;

    const slider = this.container.querySelector("#wps-scale-slider") as HTMLInputElement;
    const valueDisplay = this.container.querySelector("#wps-scale-value");
    const clearBtn = this.container.querySelector("#wps-clear-btn");
    const paidToggle = this.container.querySelector("#wps-paid-toggle") as HTMLInputElement;
    const addToGalleryBtn = this.container.querySelector("#wps-add-to-gallery");
    const downloadBtn = this.container.querySelector("#wps-download");

    // サイズ縮小スライダー
    slider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (valueDisplay) {
        valueDisplay.textContent = value;
      }
      this.callbacks?.onScaleChange(parseFloat(value));
    });

    // 画像クリアボタン
    clearBtn?.addEventListener("click", () => {
      if (confirm(t`${'clear_image_confirm'}`)) {
        this.callbacks?.onClear();
      }
    });

    // Paid色トグル
    paidToggle?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.callbacks?.onPaidToggle(target.checked);
    });

    // ギャラリーに追加
    addToGalleryBtn?.addEventListener("click", () => {
      this.callbacks?.onSaveToGallery();
    });

    // ダウンロード
    downloadBtn?.addEventListener("click", () => {
      this.callbacks?.onDownload();
    });
  }
}
