import { t } from "../../../../i18n/manager";
import { ImageDropzone } from "../../../../components/image-dropzone";

export interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onClear: () => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}

export class ImageEditorUI {
  private container: HTMLElement | null = null;
  private callbacks: ImageEditorCallbacks | null = null;
  private imageDropzone: ImageDropzone | null = null;
  private imageProcessor: any = null;

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
    this.setupImageDropzone();
    this.setupScaleControl();
    this.setupResponsive();
  }

  private createUI(): void {
    if (!this.container) return;

    this.container.innerHTML = t`
      <a href="https://pepoafonso.github.io/color_converter_wplace/index.html" target="_blank" 
      style="position: absolute; bottom: 0.5rem; right: 0.5rem; z-index: 10; font-size: 1.5rem;"
      title="Wplace Color Converter">🎨</a>
      
      <!-- Dropzone -->
      <div id="wps-dropzone-container" style="border: 2px dashed #d1d5db; border-radius: 0.5rem; height: 20rem;"></div>
      
      <!-- Image Display Area -->
      <div id="wps-image-display" style="display: none;">
        <button id="wps-clear-btn" class="btn btn-xs btn-circle btn-ghost" 
          style="position: absolute; top: 0.5rem; right: 0.5rem; z-index: 10; opacity: 0.6;" 
          title="${"clear_image"}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 0.75rem; height: 0.75rem;">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>
          </svg>
        </button>
        
        <!-- Upper: Images -->
        <div id="wps-images-container" style="display: grid; grid-template-columns: 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <!-- Original Image -->
          <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 3px;">
            <h4 style="font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              ${"original_image"}
              <div style="font-size: 0.75rem; color: #4b5563;">
                <span id="wps-original-size"></span>
              </div>
            </h4>
            <div class="flex" style="justify-content: center; margin-bottom: 0.5rem;">
              <img id="wps-original-image" style="border: 1px solid #e5e7eb; border-radius: 0.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 300px; max-height: 300px; object-fit: contain; image-rendering: pixelated; image-rendering: crisp-edges;" alt="Original">
            </div>
          </div>
          
          <!-- Current Image -->
          <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 3px;">
            <h4 style="font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              ${"current_image"}
              <div style="display:flex; font-size: 0.75rem; color: #4b5563; margin-bottom: 0.25rem;">
                <span id="wps-current-size"></span>
              </div>
            </h4>
            <div class="flex" style="justify-content: center; margin-bottom: 0.5rem;">
              <div style="width: 300px; height: 300px; border: 1px solid #d1d5db; border-radius: 0.375rem; overflow: hidden; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <canvas id="wps-scaled-canvas" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></canvas>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Lower: Settings -->
        <div id="wps-settings-container" style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
          <!-- Left: Color Palette -->
          <div>
            <!-- Mobile: Accordion -->
            <details id="wps-palette-accordion" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; margin-bottom: 1rem;">
              <summary style="padding: 0.75rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; list-style: none;">
                Color Palette
                <span style="float: right;">▼</span>
              </summary>
              <div style="padding: 0 0.75rem 0.75rem 0.75rem;">
                <div id="wps-color-palette-container-mobile"></div>
              </div>
            </details>
            <!-- Desktop: Always visible -->
            <div id="wps-color-palette-container" style="display: none;"></div>
          </div>
          
          <!-- Right: Controls -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
              <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem;">${"size_reduction"}: <span id="wps-scale-value">1.0</span>x</label>
              <input type="range" id="wps-scale-slider" min="0.1" max="1" step="0.05" value="1" class="range" style="width: 100%;">
              <div class="flex" style="justify-content: space-between; font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">
                <span>0.1x</span>
                <span>1.0x</span>
              </div>
            </div>
            
            <div class="flex" style="gap: 0.5rem;">
              <button id="wps-add-to-gallery" class="btn btn-primary" style="flex: 1;">${"add_to_gallery"}</button>
              <button id="wps-download" class="btn btn-ghost">${"download"}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private setupImageDropzone(): void {
    if (!this.container || !this.callbacks) return;

    const dropzoneContainer = this.container.querySelector(
      "#wps-dropzone-container"
    ) as HTMLElement;
    if (!dropzoneContainer) return;

    this.imageDropzone = new ImageDropzone(dropzoneContainer, {
      onFileSelected: (file: File) => this.callbacks?.onFileHandle(file),
      autoHide: true,
    });
  }

  private setupScaleControl(): void {
    if (!this.container || !this.callbacks) return;

    const slider = this.container.querySelector(
      "#wps-scale-slider"
    ) as HTMLInputElement;
    const valueDisplay = this.container.querySelector("#wps-scale-value");
    const clearBtn = this.container.querySelector("#wps-clear-btn");
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
      if (confirm(t`${"clear_image_confirm"}`)) {
        this.callbacks?.onClear();
        this.imageDropzone?.show();
      }
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

  setImageProcessor(processor: any): void {
    this.imageProcessor = processor;
  }

  private setupResponsive(): void {
    const updateLayout = () => {
      const isDesktop = window.innerWidth >= 1024;

      const imagesContainer = this.container?.querySelector(
        "#wps-images-container"
      ) as HTMLElement;
      const settingsContainer = this.container?.querySelector(
        "#wps-settings-container"
      ) as HTMLElement;
      const accordion = this.container?.querySelector(
        "#wps-palette-accordion"
      ) as HTMLElement;
      const desktopPalette = this.container?.querySelector(
        "#wps-color-palette-container"
      ) as HTMLElement;

      if (imagesContainer) {
        imagesContainer.style.gridTemplateColumns = isDesktop
          ? "1fr 1fr"
          : "1fr";
      }

      if (settingsContainer) {
        settingsContainer.style.gridTemplateColumns = isDesktop
          ? "1fr 1fr"
          : "1fr";
      }

      if (accordion) {
        accordion.style.display = isDesktop ? "none" : "block";
      }

      if (desktopPalette) {
        desktopPalette.style.display = isDesktop ? "block" : "none";
      }

      if (this.imageProcessor) {
        this.imageProcessor.updateColorPaletteContainer(!isDesktop);
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
  }
}
