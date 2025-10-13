import { t } from "../../../../i18n/manager";
import { ImageDropzone } from "../../../../components/image-dropzone";

export interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onClear: () => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}

export class ImageEditorUI {
  private container: HTMLElement | null = null;
  private callbacks: ImageEditorCallbacks | null = null;
  private imageDropzone: ImageDropzone | null = null;
  private controller: any = null;

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
        
        <!-- 4 Area Grid -->
        <div id="wps-main-grid" style="display: grid; grid-template-columns: 1fr; gap: 0.75rem; height: calc(100vh - 8rem); overflow: hidden;">
          <!-- Original Image Area -->
          <div id="wps-original-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; overflow-y: auto; min-height: 0;">
            <h4 style="font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              ${"original_image"}
              <div style="font-size: 0.75rem; color: #4b5563;">
                <span id="wps-original-size"></span>
              </div>
            </h4>
            <div class="flex" style="justify-content: center;">
              <img id="wps-original-image" style="border: 1px solid #e5e7eb; border-radius: 0.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 100%; height: auto; object-fit: contain; image-rendering: pixelated; image-rendering: crisp-edges;" alt="Original">
            </div>
          </div>
          
          <!-- Current Image Area -->
          <div id="wps-current-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; overflow-y: auto; min-height: 0;">
            <h4 style="font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
              ${"current_image"}
              <div style="display:flex; font-size: 0.75rem; color: #4b5563;">
                <span id="wps-current-size"></span>
              </div>
            </h4>
            <div class="flex" style="justify-content: center; position: relative; width: 100%; height: calc(100% - 2.5rem);">
              <div style="width: 300px; height: 300px; max-width: 100%; max-height: 100%; border: 1px solid #d1d5db; border-radius: 0.375rem; overflow: hidden; position: relative; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <canvas id="wps-scaled-canvas" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></canvas>
              </div>
            </div>
          </div>
          
          <!-- Color Palette Area -->
          <div id="wps-palette-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; overflow-y: auto; min-height: 0;">
            <!-- Mobile: Accordion -->
            <details id="wps-palette-accordion" style="display: none;">
              <summary style="font-size: 0.875rem; font-weight: 500; cursor: pointer; list-style: none; margin-bottom: 0.75rem;">
                Color Palette
                <span style="float: right;">▼</span>
              </summary>
              <div id="wps-color-palette-container-mobile"></div>
            </details>
            <!-- Desktop: Always visible -->
            <div id="wps-palette-desktop" style="display: block;">
              <h4 style="font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem;">Color Palette</h4>
              <div id="wps-color-palette-container"></div>
            </div>
          </div>
          
          <!-- Controls Area -->
          <div id="wps-controls-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; overflow-y: auto; min-height: 0;">
            <h4 style="font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem;">${"adjustments"}</h4>
            <div id="wps-controls-container" style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.75rem; color: #9ca3af;">0.1x</span>
                  <span>${"size_reduction"}: <span id="wps-scale-value">1.0</span>x</span>
                  <span style="font-size: 0.75rem; color: #9ca3af;">1.0x</span>
                </label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <input type="range" id="wps-scale-slider" min="0.1" max="1" step="0.01" value="1" class="range" style="flex: 1;">
                  <input type="number" id="wps-scale-input" min="0.1" max="1" step="0.01" value="1" style="width: 50px; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center;">
                </div>
              </div>
              
              <div>
                <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.75rem; color: #9ca3af;">-100</span>
                  <span>${"brightness"}: <span id="wps-brightness-value">0</span></span>
                  <span style="font-size: 0.75rem; color: #9ca3af;">100</span>
                </label>
                <input type="range" id="wps-brightness-slider" min="-100" max="100" step="1" value="0" class="range" style="width: 100%;">
              </div>
              
              <div>
                <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.75rem; color: #9ca3af;">-100</span>
                  <span>${"contrast"}: <span id="wps-contrast-value">0</span></span>
                  <span style="font-size: 0.75rem; color: #9ca3af;">100</span>
                </label>
                <input type="range" id="wps-contrast-slider" min="-100" max="100" step="1" value="0" class="range" style="width: 100%;">
              </div>
              
              <div>
                <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.75rem; color: #9ca3af;">-100</span>
                  <span>${"saturation"}: <span id="wps-saturation-value">0</span></span>
                  <span style="font-size: 0.75rem; color: #9ca3af;">100</span>
                </label>
                <input type="range" id="wps-saturation-slider" min="-100" max="100" step="1" value="0" class="range" style="width: 100%;">
              </div>
              
              <div class="flex" style="gap: 0.5rem;">
                <button id="wps-add-to-gallery" class="btn btn-primary" style="flex: 1;">${"add_to_gallery"}</button>
                <button id="wps-download" class="btn btn-ghost">${"download"}</button>
              </div>
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
    const input = this.container.querySelector(
      "#wps-scale-input"
    ) as HTMLInputElement;
    const valueDisplay = this.container.querySelector("#wps-scale-value");
    const brightnessSlider = this.container.querySelector(
      "#wps-brightness-slider"
    ) as HTMLInputElement;
    const brightnessValue = this.container.querySelector(
      "#wps-brightness-value"
    );
    const contrastSlider = this.container.querySelector(
      "#wps-contrast-slider"
    ) as HTMLInputElement;
    const contrastValue = this.container.querySelector("#wps-contrast-value");
    const saturationSlider = this.container.querySelector(
      "#wps-saturation-slider"
    ) as HTMLInputElement;
    const saturationValue = this.container.querySelector(
      "#wps-saturation-value"
    );
    const clearBtn = this.container.querySelector("#wps-clear-btn");
    const addToGalleryBtn = this.container.querySelector("#wps-add-to-gallery");
    const downloadBtn = this.container.querySelector("#wps-download");

    // サイズ縮小スライダー
    slider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      const floatValue = parseFloat(value);
      if (valueDisplay) {
        valueDisplay.textContent = floatValue.toFixed(2);
      }
      if (input) {
        input.value = value;
      }
    });

    slider?.addEventListener("change", (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.callbacks?.onScaleChange(value);
    });

    // サイズ縮小数値入力
    input?.addEventListener("input", (e) => {
      let value = parseFloat((e.target as HTMLInputElement).value);
      // 範囲制限
      value = Math.max(0.1, Math.min(1, value));
      if (valueDisplay) {
        valueDisplay.textContent = value.toFixed(2);
      }
      if (slider) {
        slider.value = value.toString();
      }
    });

    input?.addEventListener("change", (e) => {
      let value = parseFloat((e.target as HTMLInputElement).value);
      value = Math.max(0.1, Math.min(1, value));
      this.callbacks?.onScaleChange(value);
    });

    // 明るさスライダー
    brightnessSlider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (brightnessValue) {
        brightnessValue.textContent = value;
      }
    });

    brightnessSlider?.addEventListener("change", (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.callbacks?.onBrightnessChange(value);
    });

    // コントラストスライダー
    contrastSlider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (contrastValue) {
        contrastValue.textContent = value;
      }
    });

    contrastSlider?.addEventListener("change", (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.callbacks?.onContrastChange(value);
    });

    // 彩度スライダー
    saturationSlider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (saturationValue) {
        saturationValue.textContent = value;
      }
    });

    saturationSlider?.addEventListener("change", (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.callbacks?.onSaturationChange(value);
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

  setController(controller: any): void {
    this.controller = controller;
  }

  private setupResponsive(): void {
    const updateLayout = () => {
      const isDesktop = window.innerWidth >= 1024;

      const mainGrid = this.container?.querySelector(
        "#wps-main-grid"
      ) as HTMLElement;
      const accordion = this.container?.querySelector(
        "#wps-palette-accordion"
      ) as HTMLElement;
      const desktopPalette = this.container?.querySelector(
        "#wps-palette-desktop"
      ) as HTMLElement;

      if (mainGrid) {
        mainGrid.style.gridTemplateColumns = isDesktop ? "1fr 1fr" : "1fr";
        mainGrid.style.height = isDesktop ? "calc(100vh - 8rem)" : "auto";
      }

      if (accordion) {
        accordion.style.display = isDesktop ? "none" : "block";
      }

      if (desktopPalette) {
        desktopPalette.style.display = isDesktop ? "block" : "none";
      }

      if (this.controller) {
        this.controller.updateColorPaletteContainer(!isDesktop);
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
  }
}
