import { t } from "../../../../i18n/manager";
import { ImageDropzone } from "../../../../components/image-dropzone";
import { QuantizationMethod } from "./canvas-processor";

export interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onReplaceImage: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onSharpnessToggle: (enabled: boolean) => void;
  onSharpnessChange: (value: number) => void;
  onDitheringChange: (enabled: boolean) => void;
  onDitheringThresholdChange: (threshold: number) => void;
  onQuantizationMethodChange: (method: QuantizationMethod) => void;
  onGpuToggle: (enabled: boolean) => void;
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
    this.setupImageReplacement();
    this.setupScaleControl();
    this.setupResponsive();
  }

  private createUI(): void {
    if (!this.container) return;

    this.container.innerHTML = t`
      <!-- Dropzone -->
      <div id="wps-dropzone-container" style="border: 2px dashed #d1d5db; border-radius: 0.5rem; height: 20rem;"></div>
      
      <!-- Image Display Area -->
      <div id="wps-image-display" style="display: none;">
        
        <!-- 4 Area Grid -->
        <div id="wps-main-grid" style="display: grid; grid-template-columns: 1fr; grid-template-rows: 3fr 4fr; gap: 0.1rem; height: calc(100vh - 8rem);">
          <!-- Original Image Area -->
          <div id="wps-original-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
            <div id="wps-image-replace-zone" style="position: relative; cursor: pointer; display: flex; justify-content: center;">
              <img id="wps-original-image" style="border: 1px solid #e5e7eb; border-radius: 0.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 100%; height: auto; object-fit: contain; image-rendering: pixelated; image-rendering: crisp-edges;" alt="Original">
              <div id="wps-replace-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); border-radius: 0.25rem; display: none; align-items: center; justify-content: center; color: white; font-size: 0.875rem; text-align: center; padding: 1rem;">
                📁 ${"click_or_drop_to_change"}
              </div>
              <input type="file" id="wps-replace-file-input" accept="image/*,.json" style="display: none;">
              <h4 style="position: absolute; top:0; left:0; font-size: 0.875rem; font-weight: 500; display: flex; justify-content: space-between; align-items: center;">
                ${"original_image"}
              </h4>
            </div>
          </div>
          
          <!-- Current Image Area -->
          <div id="wps-current-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
            <div class="flex" style="justify-content: center; position: relative; width: 100%; height: calc(100% - 2.5rem);">
              <!-- Desktop: Canvas with ImageInspector -->
              <div id="wps-canvas-container" style="min-width: 100%; min-height: 300px; max-width: 100%; max-height: 100%; overflow: hidden; position: relative; display: block;">
                <canvas id="wps-scaled-canvas" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></canvas>
              </div>
              <!-- Mobile: Simple image -->
              <div id="wps-image-container" style="display: none; width: 100%; max-width: 100%;">
                <img id="wps-scaled-image" style="width: 100%; height: auto; image-rendering: pixelated; image-rendering: crisp-edges;" alt="Current">
              </div>
              <label style="position: absolute; bottom: 0.25rem; right: 0.25rem; display: flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; cursor: pointer; background: var(--color-base-300); padding: 0.2rem 0.4rem; border-radius: 0.25rem; opacity: 0.6; transition: opacity 0.2s;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.6'">
                <input type="checkbox" id="wps-gpu-toggle" class="checkbox checkbox-xs" checked>
                <span>⚡GPU</span>
              </label>
              <h4 style="position: absolute; top:0; left:0; font-size: 0.875rem; font-weight: 500; display: flex; justify-content: space-between; align-items: center;">
                ${"current_image"}
              </h4>
            </div>
          </div>
          
          <!-- Color Palette Area -->
          <div id="wps-palette-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
            <!-- Mobile: Accordion -->
            <details id="wps-palette-accordion" style="display: none;">
              <summary style="font-size: 0.875rem; font-weight: 500; cursor: pointer; list-style: none; margin: 0.5rem;">
                Color Palette
                <span style="float: right;">▼</span>
              </summary>
              <div id="wps-color-palette-container-mobile"></div>
            </details>
            <!-- Desktop: Always visible -->
            <div id="wps-palette-desktop" style="display: block;">
              <div id="wps-color-palette-container"></div>
            </div>
          </div>
          
          <!-- Controls Area -->
          <div id="wps-controls-area" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.5rem; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
            <div id="wps-controls-container" style="display: flex; flex-direction: column; gap: 1rem;">
              <div>
                <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.75rem; color: #9ca3af;">0.1x</span>
                  <span>${"size_reduction"}</span>
                  <span style="font-size: 0.75rem; color: #9ca3af;">1.0x</span>
                </label>
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <input type="range" id="wps-scale-slider" min="0.1" max="1" step="0.01" value="1" class="range" style="flex: 1;">
                  <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <input type="number" id="wps-width-input" min="1" step="1" style="width: 60px; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center;">
                    <span style="font-size: 0.75rem; color: #9ca3af;">×</span>
                    <input type="number" id="wps-height-input" min="1" step="1" style="width: 60px; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center;">
                  </div>
                </div>
              </div>
              
              <div id="wps-contrast-quantization-container" style="display: flex; gap: 0.75rem;">
                <div style="flex: 1;">
                  <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500;">
                    <span style="font-size: 0.75rem; color: #9ca3af;">-100</span>
                    <span>${"contrast"}: <span id="wps-contrast-value">0</span></span>
                    <span style="font-size: 0.75rem; color: #9ca3af;">100</span>
                  </label>
                  <input type="range" id="wps-contrast-slider" min="-100" max="100" step="1" value="0" class="range" style="width: 100%;">
                </div>

                <div style="flex: 1;">
                  <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; text-align: center;">${"quantization_method"}</label>
                  <select id="wps-quantization-method" class="select select-sm w-full" style="font-size: 0.75rem;">
                    <option value="rgb-euclidean">${"quantization_rgb_euclidean"}</option>
                    <option value="weighted-rgb">${"quantization_weighted_rgb"}</option>
                    <option value="lab">${"quantization_lab"}</option>
                  </select>
                </div>
              </div>
              
              <div id="wps-brightness-saturation-container" style="display: flex; gap: 0.75rem;">
                <div style="flex: 1;">
                  <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500;">
                    <span style="font-size: 0.75rem; color: #9ca3af;">-100</span>
                    <span>${"brightness"}: <span id="wps-brightness-value">0</span></span>
                    <span style="font-size: 0.75rem; color: #9ca3af;">100</span>
                  </label>
                  <input type="range" id="wps-brightness-slider" min="-100" max="100" step="1" value="0" class="range" style="width: 100%;">
                </div>

                <div style="flex: 1;">
                  <label style="display: flex; justify-content: space-between; align-items: center; font-size: 0.875rem; font-weight: 500;">
                    <span style="font-size: 0.75rem; color: #9ca3af;">-100</span>
                    <span>${"saturation"}: <span id="wps-saturation-value">0</span></span>
                    <span style="font-size: 0.75rem; color: #9ca3af;">100</span>
                  </label>
                  <input type="range" id="wps-saturation-slider" min="-100" max="100" step="1" value="0" class="range" style="width: 100%;">
                </div>
              </div>

              <div id="wps-dithering-sharpness-container" style="display: flex; gap: 0.75rem;">
                <div style="flex: 1;">
                  <label style="display: flex; justify-content: center; align-items: center; font-size: 0.875rem; font-weight: 500; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="wps-dithering-checkbox" class="checkbox checkbox-sm">
                    <span>${"dithering"}</span>
                    <span>: <span id="wps-dithering-threshold-value">500</span></span>
                  </label>
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.65rem; color: #9ca3af;">0</span>
                    <input type="range" id="wps-dithering-threshold-slider" min="0" max="1500" step="50" value="500" class="range" style="flex: 1;" disabled>
                    <span style="font-size: 0.65rem; color: #9ca3af;">1500</span>
                  </div>
                </div>

                <div style="flex: 1;">
                  <label style="display: flex; justify-content: center; align-items: center; font-size: 0.875rem; font-weight: 500; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="wps-sharpness-checkbox" class="checkbox checkbox-sm">
                    <span>${"sharpness"}</span>
                    <span>: <span id="wps-sharpness-value">0</span></span>
                  </label>
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <span style="font-size: 0.65rem; color: #9ca3af;">0</span>
                    <input type="range" id="wps-sharpness-slider" min="0" max="100" step="1" value="0" class="range" style="flex: 1;" disabled>
                    <span style="font-size: 0.65rem; color: #9ca3af;">100</span>
                  </div>
                </div>
              </div>

              <div>
                <label style="display: block; font-size: 0.75rem; font-weight: 500; margin-bottom: 0.25rem;">${"coordinate_input_optional"}</label>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem;">
                  <input type="number" id="wps-coord-tlx" placeholder="TLX" min="0" step="1" style="width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center;">
                  <input type="number" id="wps-coord-tly" placeholder="TLY" min="0" step="1" style="width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center;">
                  <input type="number" id="wps-coord-pxx" placeholder="PxX" min="0" max="999" step="1" style="width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center;">
                  <input type="number" id="wps-coord-pxy" placeholder="PxY" min="0" max="999" step="1" style="width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center;">
                </div>
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
      "#wps-dropzone-container",
    ) as HTMLElement;
    if (!dropzoneContainer) return;

    this.imageDropzone = new ImageDropzone(dropzoneContainer, {
      onFileSelected: (file: File) => this.callbacks?.onFileHandle(file),
      acceptedTypes: "image/*,.json",
      autoHide: true,
    });
  }

  private setupScaleControl(): void {
    if (!this.container || !this.callbacks) return;

    const slider = this.container.querySelector(
      "#wps-scale-slider",
    ) as HTMLInputElement;
    const widthInput = this.container.querySelector(
      "#wps-width-input",
    ) as HTMLInputElement;
    const heightInput = this.container.querySelector(
      "#wps-height-input",
    ) as HTMLInputElement;
    const brightnessSlider = this.container.querySelector(
      "#wps-brightness-slider",
    ) as HTMLInputElement;
    const brightnessValue = this.container.querySelector(
      "#wps-brightness-value",
    );
    const contrastSlider = this.container.querySelector(
      "#wps-contrast-slider",
    ) as HTMLInputElement;
    const contrastValue = this.container.querySelector("#wps-contrast-value");
    const saturationSlider = this.container.querySelector(
      "#wps-saturation-slider",
    ) as HTMLInputElement;
    const saturationValue = this.container.querySelector(
      "#wps-saturation-value",
    );
    const sharpnessCheckbox = this.container.querySelector(
      "#wps-sharpness-checkbox",
    ) as HTMLInputElement;
    const sharpnessSlider = this.container.querySelector(
      "#wps-sharpness-slider",
    ) as HTMLInputElement;
    const sharpnessValue = this.container.querySelector("#wps-sharpness-value");
    const ditheringCheckbox = this.container.querySelector(
      "#wps-dithering-checkbox",
    ) as HTMLInputElement;
    const ditheringThresholdSlider = this.container.querySelector(
      "#wps-dithering-threshold-slider",
    ) as HTMLInputElement;
    const ditheringThresholdValue = this.container.querySelector(
      "#wps-dithering-threshold-value",
    );
    const quantizationMethodSelect = this.container.querySelector(
      "#wps-quantization-method",
    ) as HTMLSelectElement;
    const gpuToggle = this.container.querySelector(
      "#wps-gpu-toggle",
    ) as HTMLInputElement;
    const addToGalleryBtn = this.container.querySelector("#wps-add-to-gallery");
    const downloadBtn = this.container.querySelector("#wps-download");

    // スライダー変更時
    slider?.addEventListener("input", (e) => {
      const scale = parseFloat((e.target as HTMLInputElement).value);
      const originalWidth = parseInt(widthInput?.dataset.originalWidth || "1");
      const originalHeight = parseInt(
        heightInput?.dataset.originalHeight || "1",
      );

      if (widthInput && heightInput) {
        widthInput.value = Math.round(originalWidth * scale).toString();
        heightInput.value = Math.round(originalHeight * scale).toString();
      }
    });

    slider?.addEventListener("change", (e) => {
      const scale = parseFloat((e.target as HTMLInputElement).value);
      this.callbacks?.onScaleChange(scale);
    });

    // 横幅入力変更時
    widthInput?.addEventListener("input", (e) => {
      const width = parseInt((e.target as HTMLInputElement).value) || 1;
      const originalWidth = parseInt(widthInput.dataset.originalWidth || "1");
      const originalHeight = parseInt(
        heightInput?.dataset.originalHeight || "1",
      );

      // アスペクト比維持（常に固定）
      if (heightInput) {
        const aspectRatio = originalHeight / originalWidth;
        const newHeight = Math.round(width * aspectRatio);
        heightInput.value = newHeight.toString();
      }

      // スライダー更新
      if (slider) {
        const scale = width / originalWidth;
        slider.value = Math.max(0.1, Math.min(1, scale)).toString();
      }
    });

    widthInput?.addEventListener("change", (e) => {
      const width = parseInt((e.target as HTMLInputElement).value) || 1;
      const originalWidth = parseInt(widthInput.dataset.originalWidth || "1");
      const scale = width / originalWidth;
      this.callbacks?.onScaleChange(Math.max(0.01, Math.min(1, scale)));
    });

    // 縦幅入力変更時
    heightInput?.addEventListener("input", (e) => {
      const height = parseInt((e.target as HTMLInputElement).value) || 1;
      const originalWidth = parseInt(widthInput?.dataset.originalWidth || "1");
      const originalHeight = parseInt(
        heightInput.dataset.originalHeight || "1",
      );

      // アスペクト比維持（常に固定）
      if (widthInput) {
        const aspectRatio = originalWidth / originalHeight;
        const newWidth = Math.round(height * aspectRatio);
        widthInput.value = newWidth.toString();
      }

      // スライダー更新
      if (slider) {
        const scale = height / originalHeight;
        slider.value = Math.max(0.1, Math.min(1, scale)).toString();
      }
    });

    heightInput?.addEventListener("change", (e) => {
      const height = parseInt((e.target as HTMLInputElement).value) || 1;
      const originalHeight = parseInt(
        heightInput.dataset.originalHeight || "1",
      );
      const scale = height / originalHeight;
      this.callbacks?.onScaleChange(Math.max(0.01, Math.min(1, scale)));
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

    // シャープネス
    sharpnessCheckbox?.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (sharpnessSlider) {
        sharpnessSlider.disabled = !checked;
      }
      this.callbacks?.onSharpnessToggle(checked);
    });

    // シャープネススライダー
    sharpnessSlider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (sharpnessValue) {
        sharpnessValue.textContent = value;
      }
    });

    sharpnessSlider?.addEventListener("change", (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.callbacks?.onSharpnessChange(value);
    });

    // ディザリング
    ditheringCheckbox?.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      if (ditheringThresholdSlider) {
        ditheringThresholdSlider.disabled = !checked;
      }
      this.callbacks?.onDitheringChange(checked);
    });

    // ディザリング閾値スライダー
    ditheringThresholdSlider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (ditheringThresholdValue) {
        ditheringThresholdValue.textContent = value;
      }
    });

    ditheringThresholdSlider?.addEventListener("change", (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.callbacks?.onDitheringThresholdChange(value);
    });

    // 量子化方法
    quantizationMethodSelect?.addEventListener("change", (e) => {
      const method = (e.target as HTMLSelectElement)
        .value as QuantizationMethod;
      this.callbacks?.onQuantizationMethodChange(method);
    });

    // GPUトグル
    gpuToggle?.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      this.callbacks?.onGpuToggle(checked);
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

  private setupImageReplacement(): void {
    if (!this.container || !this.callbacks) return;

    const replaceZone = this.container.querySelector(
      "#wps-image-replace-zone",
    ) as HTMLElement;
    const overlay = this.container.querySelector(
      "#wps-replace-overlay",
    ) as HTMLElement;
    const fileInput = this.container.querySelector(
      "#wps-replace-file-input",
    ) as HTMLInputElement;

    if (!replaceZone || !overlay || !fileInput) return;

    // ホバーでオーバーレイ表示
    replaceZone.addEventListener("mouseenter", () => {
      overlay.style.display = "flex";
    });

    replaceZone.addEventListener("mouseleave", () => {
      overlay.style.display = "none";
    });

    // クリックでファイル選択
    replaceZone.addEventListener("click", () => {
      fileInput.click();
    });

    // ファイル選択時
    fileInput.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.callbacks?.onReplaceImage(file);
        fileInput.value = ""; // リセット
      }
    });

    // ドラッグ&ドロップ
    replaceZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.style.display = "flex";
      overlay.style.background = "rgba(59, 130, 246, 0.8)"; // 青色にハイライト
    });

    replaceZone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.style.background = "rgba(0,0,0,0.7)";
      overlay.style.display = "none";
    });

    replaceZone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      overlay.style.display = "none";
      overlay.style.background = "rgba(0,0,0,0.7)";

      const file = e.dataTransfer?.files?.[0];
      if (
        file &&
        (file.type.startsWith("image/") || file.name.endsWith(".json"))
      ) {
        this.callbacks?.onReplaceImage(file);
      }
    });
  }

  private setupResponsive(): void {
    const updateLayout = () => {
      const isDesktop = window.innerWidth >= 1024;

      const mainGrid = this.container?.querySelector(
        "#wps-main-grid",
      ) as HTMLElement;
      const accordion = this.container?.querySelector(
        "#wps-palette-accordion",
      ) as HTMLElement;
      const desktopPalette = this.container?.querySelector(
        "#wps-palette-desktop",
      ) as HTMLElement;
      const originalArea = this.container?.querySelector(
        "#wps-original-area",
      ) as HTMLElement;
      const currentArea = this.container?.querySelector(
        "#wps-current-area",
      ) as HTMLElement;
      const controlsArea = this.container?.querySelector(
        "#wps-controls-area",
      ) as HTMLElement;
      const canvasContainer = this.container?.querySelector(
        "#wps-canvas-container",
      ) as HTMLElement;
      const imageContainer = this.container?.querySelector(
        "#wps-image-container",
      ) as HTMLElement;
      const contrastQuantizationContainer = this.container?.querySelector(
        "#wps-contrast-quantization-container",
      ) as HTMLElement;
      const brightnessSaturationContainer = this.container?.querySelector(
        "#wps-brightness-saturation-container",
      ) as HTMLElement;
      const ditheringSharpnessContainer = this.container?.querySelector(
        "#wps-dithering-sharpness-container",
      ) as HTMLElement;

      if (mainGrid) {
        if (isDesktop) {
          mainGrid.style.display = "grid";
          mainGrid.style.gridTemplateColumns = "3fr 4fr";
          mainGrid.style.height = "80vh";
          mainGrid.style.overflow = "hidden";
        } else {
          mainGrid.style.display = "flex";
          mainGrid.style.flexDirection = "column";
          mainGrid.style.height = "auto";
          mainGrid.style.overflow = "visible";
        }
      }

      if (accordion) {
        accordion.style.display = isDesktop ? "none" : "block";
      }

      if (desktopPalette) {
        desktopPalette.style.display = isDesktop ? "block" : "none";
      }

      // モバイル端末では画像エリアとコントロールエリアのスクロールを無効化してスワイプ操作を可能に
      if (originalArea) {
        originalArea.style.overflowY = isDesktop ? "auto" : "visible";
      }

      if (currentArea) {
        currentArea.style.overflowY = isDesktop ? "auto" : "visible";
      }

      if (controlsArea) {
        controlsArea.style.overflowY = isDesktop ? "auto" : "visible";
      }

      // モバイル環境ではcanvasの代わりに通常の画像を表示
      if (canvasContainer) {
        canvasContainer.style.display = isDesktop ? "block" : "none";
      }

      if (imageContainer) {
        imageContainer.style.display = isDesktop ? "none" : "block";
      }

      // モバイル環境ではコントラスト/量子化方法、明るさ/彩度、ディザリング/シャープネスを縦並びに
      if (contrastQuantizationContainer) {
        contrastQuantizationContainer.style.flexDirection = isDesktop
          ? "row"
          : "column";
      }

      if (brightnessSaturationContainer) {
        brightnessSaturationContainer.style.flexDirection = isDesktop
          ? "row"
          : "column";
      }

      if (ditheringSharpnessContainer) {
        ditheringSharpnessContainer.style.flexDirection = isDesktop
          ? "row"
          : "column";
      }

      if (this.controller) {
        this.controller.updateColorPaletteContainer(!isDesktop);
        this.controller.updateImageDisplayMode(isDesktop);
      }
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
  }
}
