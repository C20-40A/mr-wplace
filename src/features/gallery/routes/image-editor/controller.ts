import { t } from "../../../../i18n/manager";
import { colorpalette } from "../../../../constants/colors";
import { ImageInspector } from "../../../../components/image-inspector";
import { ColorPalette } from "../../../../components/color-palette";
import { DrawPosition, GalleryItem } from "../../../../states/galleryStorage";
import {
  readFileAsDataUrl,
  showImageSizeDialog,
  createBlobFromCanvas,
  blobToDataUrl,
  downloadBlob,
  parseDrawPositionFromFileName,
} from "./file-handler";
import {
  createProcessedCanvas,
  ImageAdjustments,
  QuantizationMethod,
} from "./canvas-processor";

/**
 * 画像エディタController
 * 状態管理・DOM参照・統合処理
 */
export class EditorController {
  private container: HTMLElement;
  private originalImage: HTMLImageElement | null = null;
  private scaledCanvas: HTMLCanvasElement | null = null;
  private imageScale = 1.0;
  private selectedColorIds: number[] = [];
  private brightness = 0;
  private contrast = 0;
  private saturation = 0;
  private sharpnessEnabled = false;
  private sharpness = 0;
  private ditheringEnabled = false;
  private ditheringThreshold = 500;
  private quantizationMethod: QuantizationMethod = "rgb-euclidean";
  private useGpu = true;
  private imageInspector: ImageInspector | null = null;
  private colorPalette: ColorPalette | null = null;
  private onSaveSuccess?: () => void;
  private currentFileName: string | null = null;
  private drawPosition: DrawPosition | null = null;
  private isEditMode = false;
  private editingItemKey: string | null = null;
  private isDesktopMode = true;
  private cachedResizedBitmap: ImageBitmap | null = null;
  private cachedScale = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setOnSaveSuccess(callback?: () => void): void {
    this.onSaveSuccess = callback;
  }

  async loadExistingImage(item: GalleryItem): Promise<void> {
    this.isEditMode = true;
    this.editingItemKey = item.key;
    this.drawPosition = item.drawPosition ?? null;
    this.currentFileName = `edit_${item.key}`;

    console.log("🧑‍🎨 : Loading existing image for edit:", item.key);

    const { getFullImageDataUrl } = await import("@/utils/indexed-db-bridge");
    const dataUrl = await getFullImageDataUrl(item, {
      logContext: "image editor",
    });

    if (!dataUrl) return;

    this.displayImage(dataUrl);
    this.updateSaveButtonLabel();
  }

  private updateSaveButtonLabel(): void {
    const saveBtn = this.container.querySelector(
      "#wps-save-btn"
    ) as HTMLButtonElement;
    if (!saveBtn) return;

    saveBtn.textContent = this.isEditMode
      ? `💾 ${t`${"update"}`}`
      : `💾 ${t`${"save_to_gallery"}"`}`;

    // タイトルも更新
    this.updateTitle();
  }

  updateTitle(): void {
    const titleElement = document.querySelector(
      "#wplace-studio-gallery-modal-title"
    ) as HTMLElement;
    if (!titleElement) return;

    titleElement.textContent = this.isEditMode
      ? t`${"edit_image_mode"}`
      : t`${"add_image"}`;
  }

  async handleFile(file: File): Promise<void> {
    // JSON形式チェック
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      console.log("🧑‍🎨 : Detected Bluemarble JSON file");
      const { readFileAsText, parseBluemarbleJson } = await import(
        "./file-handler"
      );

      const jsonText = await readFileAsText(file);
      const { dataUrl, drawPosition } = await parseBluemarbleJson(jsonText);

      this.currentFileName = file.name;
      this.drawPosition = drawPosition;

      this.displayImage(dataUrl);
      return;
    }

    if (!file.type.startsWith("image/")) return;

    this.currentFileName = file.name;
    this.drawPosition = parseDrawPositionFromFileName(file.name);

    const dataUrl = await readFileAsDataUrl(file);
    const { action, dataUrl: processedDataUrl } = await showImageSizeDialog(
      dataUrl,
      this.container
    );

    if (action === "addToGallery") {
      await this.saveDirectlyToGallery(processedDataUrl);
      return;
    }

    this.displayImage(processedDataUrl);
  }

  async replaceImage(file: File): Promise<void> {
    console.log("🧑‍🎨 : Replacing image with:", file.name);

    // JSON形式チェック
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      console.log("🧑‍🎨 : Detected Bluemarble JSON file");
      const { readFileAsText, parseBluemarbleJson } = await import(
        "./file-handler"
      );

      const jsonText = await readFileAsText(file);
      const { dataUrl, drawPosition } = await parseBluemarbleJson(jsonText);

      this.currentFileName = file.name;
      this.drawPosition = drawPosition;

      this.replaceImageDisplay(dataUrl);
      return;
    }

    if (!file.type.startsWith("image/")) return;

    this.currentFileName = file.name;
    this.drawPosition = parseDrawPositionFromFileName(file.name);

    const dataUrl = await readFileAsDataUrl(file);
    const { action, dataUrl: processedDataUrl } = await showImageSizeDialog(
      dataUrl,
      this.container
    );

    if (action === "addToGallery") {
      await this.saveDirectlyToGallery(processedDataUrl);
      return;
    }

    this.replaceImageDisplay(processedDataUrl);
  }

  onScaleChange(scale: number): void {
    this.imageScale = scale;
    // スケール変更時はキャッシュをクリア
    if (this.cachedResizedBitmap) {
      this.cachedResizedBitmap.close();
      this.cachedResizedBitmap = null;
    }
    this.updateScaledImage();
  }

  onBrightnessChange(value: number): void {
    this.brightness = value;
    this.updateScaledImage();
  }

  onContrastChange(value: number): void {
    this.contrast = value;
    this.updateScaledImage();
  }

  onSaturationChange(value: number): void {
    this.saturation = value;
    this.updateScaledImage();
  }

  onSharpnessToggle(enabled: boolean): void {
    console.log("🧑‍🎨 : Sharpness toggled:", enabled);
    this.sharpnessEnabled = enabled;
    this.updateScaledImage();
  }

  onSharpnessChange(value: number): void {
    this.sharpness = value;
    this.updateScaledImage();
  }

  onDitheringChange(enabled: boolean): void {
    console.log("🧑‍🎨 : Dithering changed:", enabled);
    this.ditheringEnabled = enabled;
    this.updateScaledImage();
  }

  onDitheringThresholdChange(threshold: number): void {
    this.ditheringThreshold = threshold;
    this.updateScaledImage();
  }

  onGpuToggle(enabled: boolean): void {
    console.log("🧑‍🎨 : GPU toggle changed:", enabled);
    this.useGpu = enabled;
    this.updateScaledImage();
  }

  onQuantizationMethodChange(method: QuantizationMethod): void {
    console.log("🧑‍🎨 : Quantization method changed:", method);
    this.quantizationMethod = method;
    this.updateScaledImage();
  }

  onColorSelectionChange(colorIds: number[]): void {
    this.selectedColorIds = colorIds;
    // パレット変更時は再描画
    setTimeout(() => {
      this.updateScaledImage();
    }, 50);
  }

  initColorPalette(container: HTMLElement): void {
    this.selectedColorIds = colorpalette.map((c) => c.id);
    this.colorPalette = new ColorPalette(container, {
      selectedColorIds: this.selectedColorIds,
      onChange: (colorIds) => this.onColorSelectionChange(colorIds),
      hasExtraColorsBitmap: true,
    });
  }

  updateColorPaletteContainer(isMobile: boolean): void {
    if (!this.originalImage) return;

    const containerSelector = isMobile
      ? "#wps-color-palette-container-mobile"
      : "#wps-color-palette-container";
    const newContainer = this.container.querySelector(
      containerSelector
    ) as HTMLElement;

    if (!newContainer) return;

    if (this.colorPalette) {
      this.colorPalette.destroy();
    }

    this.colorPalette = new ColorPalette(newContainer, {
      selectedColorIds: this.selectedColorIds,
      onChange: (colorIds) => this.onColorSelectionChange(colorIds),
      hasExtraColorsBitmap: true,
    });
  }

  clearImage(): void {
    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }

    if (this.cachedResizedBitmap) {
      this.cachedResizedBitmap.close();
      this.cachedResizedBitmap = null;
    }

    this.originalImage = null;
    this.scaledCanvas = null;
    this.imageScale = 1.0;
    this.cachedScale = 1.0;
    this.brightness = 0;
    this.contrast = 0;
    this.saturation = 0;
    this.sharpnessEnabled = false;
    this.sharpness = 0;
    this.ditheringEnabled = false;
    this.ditheringThreshold = 500;
    this.quantizationMethod = "rgb-euclidean";
    this.useGpu = true;
    this.currentFileName = null;
    this.drawPosition = null;
    this.isEditMode = false;
    this.editingItemKey = null;

    const dropzone = this.container.querySelector(
      "#wps-dropzone-container"
    ) as HTMLElement;
    const imageDisplay = this.container.querySelector(
      "#wps-image-display"
    ) as HTMLElement;
    const slider = this.container.querySelector(
      "#wps-scale-slider"
    ) as HTMLInputElement;
    const widthInput = this.container.querySelector(
      "#wps-width-input"
    ) as HTMLInputElement;
    const heightInput = this.container.querySelector(
      "#wps-height-input"
    ) as HTMLInputElement;
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
    const sharpnessCheckbox = this.container.querySelector(
      "#wps-sharpness-checkbox"
    ) as HTMLInputElement;
    const sharpnessSlider = this.container.querySelector(
      "#wps-sharpness-slider"
    ) as HTMLInputElement;
    const sharpnessValue = this.container.querySelector("#wps-sharpness-value");
    const ditheringCheckbox = this.container.querySelector(
      "#wps-dithering-checkbox"
    ) as HTMLInputElement;
    const gpuToggle = this.container.querySelector(
      "#wps-gpu-toggle"
    ) as HTMLInputElement;
    const tlxInput = this.container.querySelector(
      "#wps-coord-tlx"
    ) as HTMLInputElement;
    const tlyInput = this.container.querySelector(
      "#wps-coord-tly"
    ) as HTMLInputElement;
    const pxxInput = this.container.querySelector(
      "#wps-coord-pxx"
    ) as HTMLInputElement;
    const pxyInput = this.container.querySelector(
      "#wps-coord-pxy"
    ) as HTMLInputElement;

    if (slider) slider.value = "1";
    if (widthInput) {
      widthInput.value = "";
      widthInput.dataset.originalWidth = "";
    }
    if (heightInput) {
      heightInput.value = "";
      heightInput.dataset.originalHeight = "";
    }
    if (brightnessSlider) brightnessSlider.value = "0";
    if (brightnessValue) brightnessValue.textContent = "0";
    if (contrastSlider) contrastSlider.value = "0";
    if (contrastValue) contrastValue.textContent = "0";
    if (saturationSlider) saturationSlider.value = "0";
    if (saturationValue) saturationValue.textContent = "0";
    if (sharpnessCheckbox) sharpnessCheckbox.checked = false;
    if (sharpnessSlider) {
      sharpnessSlider.value = "0";
      sharpnessSlider.disabled = true;
    }
    if (sharpnessValue) sharpnessValue.textContent = "0";
    if (ditheringCheckbox) ditheringCheckbox.checked = false;
    if (gpuToggle) gpuToggle.checked = true;
    if (tlxInput) tlxInput.value = "";
    if (tlyInput) tlyInput.value = "";
    if (pxxInput) pxxInput.value = "";
    if (pxyInput) pxyInput.value = "";

    if (dropzone) dropzone.style.display = "block";
    if (imageDisplay) imageDisplay.style.display = "none";

    this.updateSaveButtonLabel();
  }

  async saveToGallery(): Promise<void> {
    if (!this.scaledCanvas) return;

    // UIから座標取得
    const coordPosition = this.getCoordinatesFromUI();
    if (coordPosition) {
      this.drawPosition = coordPosition;
      console.log("🧑‍🎨 : Coordinates from UI:", this.drawPosition);
    }

    const blob = await createBlobFromCanvas(this.scaledCanvas);
    await this.saveCanvasToGallery(blob);
  }

  private getCoordinatesFromUI(): DrawPosition | null {
    const inputs = {
      tlx: this.container.querySelector("#wps-coord-tlx") as HTMLInputElement,
      tly: this.container.querySelector("#wps-coord-tly") as HTMLInputElement,
      pxx: this.container.querySelector("#wps-coord-pxx") as HTMLInputElement,
      pxy: this.container.querySelector("#wps-coord-pxy") as HTMLInputElement,
    };

    if (!Object.values(inputs).every((input) => input)) return null;

    const values = {
      tlx: inputs.tlx.value.trim(),
      tly: inputs.tly.value.trim(),
      pxx: inputs.pxx.value.trim(),
      pxy: inputs.pxy.value.trim(),
    };

    if (Object.values(values).every((v) => !v)) return null;

    return {
      TLX: parseInt(values.tlx || "0"),
      TLY: parseInt(values.tly || "0"),
      PxX: parseInt(values.pxx || "0"),
      PxY: parseInt(values.pxy || "0"),
    };
  }

  async downloadImage(): Promise<void> {
    if (!this.scaledCanvas) return;

    const blob = await createBlobFromCanvas(this.scaledCanvas);
    downloadBlob(blob, `wplace-image-${Date.now()}.png`);
  }

  private async saveToStorage(
    blob: Blob,
    key?: string,
    isEditMode = false
  ): Promise<void> {
    const { GalleryStorage } = await import(
      "../../../../states/galleryStorage"
    );
    const galleryStorage = new GalleryStorage();

    const { generateThumbnail } = await import("@/utils/thumbnail");
    const thumbnail = await generateThumbnail(blob, 128);

    const galleryItem: GalleryItem = {
      key: key || `gallery_${Date.now()}`,
      timestamp: Date.now(),
      thumbnail,
    };

    if (this.drawPosition) {
      galleryItem.drawPosition = this.drawPosition;
      galleryItem.drawEnabled = true;
      console.log("🧑‍🎨 : Saving with position:", this.drawPosition);
    }

    await galleryStorage.save(galleryItem);
    console.log(
      "🧑‍🎨 : ",
      isEditMode ? t`${"updated"}` : t`${"saved_to_gallery"}`
    );

    if (this.drawPosition) {
      await this.saveToIndexedDB(galleryItem.key, blob);
    }

    this.onSaveSuccess?.();
  }

  private async saveToIndexedDB(key: string, blob: Blob): Promise<void> {
    if (!this.drawPosition) return;

    try {
      const { saveImageToIndexedDB } = await import(
        "@/utils/indexed-db-bridge"
      );
      const success = await saveImageToIndexedDB(
        key,
        blob,
        this.drawPosition
      );

      if (success) {
        console.log("🧑‍🎨 : Saved to IndexedDB:", key);
      } else {
        console.warn("🧑‍🎨 : IndexedDB save failed:", key);
      }
    } catch (error) {
      console.error("🧑‍🎨 : Failed to save to IndexedDB:", error);
    }
  }

  private async saveCanvasToGallery(blob: Blob): Promise<void> {
    const coordPosition = this.getCoordinatesFromUI();
    if (coordPosition) this.drawPosition = coordPosition;

    const key =
      this.isEditMode && this.editingItemKey ? this.editingItemKey : undefined;
    await this.saveToStorage(blob, key, this.isEditMode);
  }

  private async saveDirectlyToGallery(dataUrl: string): Promise<void> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await this.saveToStorage(blob);
  }

  private displayImage(imageSrc: string): void {
    const dropzone = this.container.querySelector(
      "#wps-dropzone-container"
    ) as HTMLElement;
    const imageDisplay = this.container.querySelector(
      "#wps-image-display"
    ) as HTMLElement;
    const originalImage = this.container.querySelector(
      "#wps-original-image"
    ) as HTMLImageElement;

    // 新しい画像を表示する際はキャッシュをクリア
    if (this.cachedResizedBitmap) {
      this.cachedResizedBitmap.close();
      this.cachedResizedBitmap = null;
    }

    if (originalImage) {
      originalImage.src = imageSrc;
      this.originalImage = originalImage;

      originalImage.onload = () => {
        this.updateOriginalImageDisplay();

        // 画像サイズ入力の初期化
        const widthInput = this.container.querySelector(
          "#wps-width-input"
        ) as HTMLInputElement;
        const heightInput = this.container.querySelector(
          "#wps-height-input"
        ) as HTMLInputElement;

        if (widthInput && heightInput && this.originalImage) {
          const originalWidth = this.originalImage.naturalWidth;
          const originalHeight = this.originalImage.naturalHeight;

          widthInput.value = originalWidth.toString();
          heightInput.value = originalHeight.toString();
          widthInput.dataset.originalWidth = originalWidth.toString();
          heightInput.dataset.originalHeight = originalHeight.toString();
          widthInput.max = originalWidth.toString();
          heightInput.max = originalHeight.toString();

          console.log(
            "🧑‍🎨 : Initialized size inputs:",
            originalWidth,
            "x",
            originalHeight
          );
        }

        const canvas = this.container.querySelector(
          "#wps-scaled-canvas"
        ) as HTMLCanvasElement;
        // デスクトップ環境のみImageInspector初期化
        if (canvas && this.isDesktopMode) {
          this.imageInspector = new ImageInspector(canvas);
        }

        const isMobile = window.innerWidth < 1024;
        const colorPaletteContainer = isMobile
          ? (this.container.querySelector(
              "#wps-color-palette-container-mobile"
            ) as HTMLElement)
          : (this.container.querySelector(
              "#wps-color-palette-container"
            ) as HTMLElement);

        if (colorPaletteContainer) {
          this.initColorPalette(colorPaletteContainer);
        }

        // 座標UIに自動入力
        this.updateCoordinateInputs();

        // 保存ボタンラベル更新
        this.updateSaveButtonLabel();

        // 初期表示: リサイズ→調整→パレット変換
        setTimeout(() => {
          this.updateScaledImage();
        }, 50);
      };
    }

    if (dropzone) dropzone.style.display = "none";
    if (imageDisplay) imageDisplay.style.display = "block";
  }

  private replaceImageDisplay(imageSrc: string): void {
    console.log("🧑‍🎨 : Replacing image, keeping current adjustments");

    // 画像を置き換える際はキャッシュをクリア
    if (this.cachedResizedBitmap) {
      this.cachedResizedBitmap.close();
      this.cachedResizedBitmap = null;
    }

    const originalImage = this.container.querySelector(
      "#wps-original-image"
    ) as HTMLImageElement;

    if (originalImage) {
      originalImage.src = imageSrc;
      this.originalImage = originalImage;

      originalImage.onload = () => {
        this.updateOriginalImageDisplay();

        // 画像サイズ入力の更新（元画像サイズ基準）
        const widthInput = this.container.querySelector(
          "#wps-width-input"
        ) as HTMLInputElement;
        const heightInput = this.container.querySelector(
          "#wps-height-input"
        ) as HTMLInputElement;
        const slider = this.container.querySelector(
          "#wps-scale-slider"
        ) as HTMLInputElement;

        if (widthInput && heightInput && this.originalImage) {
          const originalWidth = this.originalImage.naturalWidth;
          const originalHeight = this.originalImage.naturalHeight;

          // 現在のscaleを維持してサイズを更新
          widthInput.value = Math.round(
            originalWidth * this.imageScale
          ).toString();
          heightInput.value = Math.round(
            originalHeight * this.imageScale
          ).toString();
          widthInput.dataset.originalWidth = originalWidth.toString();
          widthInput.dataset.originalHeight = originalHeight.toString();
          widthInput.max = originalWidth.toString();
          heightInput.max = originalHeight.toString();

          if (slider) {
            slider.value = this.imageScale.toString();
          }

          console.log(
            "🧑‍🎨 : Updated size inputs with scale",
            this.imageScale,
            ":",
            originalWidth,
            "x",
            originalHeight
          );
        }

        // 座標UIに自動入力
        this.updateCoordinateInputs();

        // 調整パラメータを保持したまま再描画
        setTimeout(() => {
          this.updateScaledImage();
        }, 50);
      };
    }
  }

  private updateCoordinateInputs(): void {
    if (!this.drawPosition) return;

    const tlxInput = this.container.querySelector(
      "#wps-coord-tlx"
    ) as HTMLInputElement;
    const tlyInput = this.container.querySelector(
      "#wps-coord-tly"
    ) as HTMLInputElement;
    const pxxInput = this.container.querySelector(
      "#wps-coord-pxx"
    ) as HTMLInputElement;
    const pxyInput = this.container.querySelector(
      "#wps-coord-pxy"
    ) as HTMLInputElement;

    if (tlxInput) tlxInput.value = this.drawPosition.TLX.toString();
    if (tlyInput) tlyInput.value = this.drawPosition.TLY.toString();
    if (pxxInput) pxxInput.value = this.drawPosition.PxX.toString();
    if (pxyInput) pxyInput.value = this.drawPosition.PxY.toString();

    console.log("🧑‍🎨 : Auto-filled coordinates:", this.drawPosition);
  }

  private updateOriginalImageDisplay(): void {
    const originalImage = this.container.querySelector(
      "#wps-original-image"
    ) as HTMLImageElement;
    if (!originalImage || !this.originalImage) return;

    const width = this.originalImage.naturalWidth;
    const height = this.originalImage.naturalHeight;
    const maxDisplaySize = 300;

    if (width <= maxDisplaySize && height <= maxDisplaySize) {
      const scale = Math.min(maxDisplaySize / width, maxDisplaySize / height);
      originalImage.style.width = `${width * scale}px`;
      originalImage.style.height = `${height * scale}px`;
    } else {
      originalImage.style.width = "auto";
      originalImage.style.height = "auto";
    }
  }

  updateImageDisplayMode(isDesktop: boolean): void {
    this.isDesktopMode = isDesktop;

    // モード切り替え時にImageInspectorの初期化/破棄
    const canvas = this.container.querySelector(
      "#wps-scaled-canvas"
    ) as HTMLCanvasElement;

    if (isDesktop && canvas && !this.imageInspector) {
      this.imageInspector = new ImageInspector(canvas);
    } else if (!isDesktop && this.imageInspector) {
      // モバイルモードではImageInspectorを破棄
      this.imageInspector = null;
    }

    // 画像を再描画
    this.updateScaledImage();
  }

  private async updateScaledImage(): Promise<void> {
    if (!this.originalImage) return;

    const canvas = this.container.querySelector(
      "#wps-scaled-canvas"
    ) as HTMLCanvasElement;
    const image = this.container.querySelector(
      "#wps-scaled-image"
    ) as HTMLImageElement;
    const originalSizeDisplay =
      this.container.querySelector("#wps-original-size");
    const currentSizeDisplay =
      this.container.querySelector("#wps-current-size");

    const adjustments: ImageAdjustments = {
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
      sharpness: this.sharpnessEnabled ? this.sharpness : 0,
    };

    let processedCanvas: HTMLCanvasElement;

    // スケール変更時のみリサイズを実行、それ以外はキャッシュを利用
    if (!this.cachedResizedBitmap || this.cachedScale !== this.imageScale) {
      console.log("🧑‍🎨 : Scale changed, creating new resized bitmap");

      // リサイズ実行
      const { createResizedImageBitmap } = await import("@/utils/image-bitmap-compat");
      const originalWidth = this.originalImage.naturalWidth;
      const originalHeight = this.originalImage.naturalHeight;
      const newWidth = Math.floor(originalWidth * this.imageScale);
      const newHeight = Math.floor(originalHeight * this.imageScale);

      // 古いキャッシュをクリア
      if (this.cachedResizedBitmap) {
        this.cachedResizedBitmap.close();
      }

      this.cachedResizedBitmap = await createResizedImageBitmap(this.originalImage, {
        width: newWidth,
        height: newHeight,
        quality: "pixelated"
      });
      this.cachedScale = this.imageScale;

      // リサイズ後の処理
      const { createProcessedCanvasFromBitmap } = await import("./canvas-processor");
      processedCanvas = await createProcessedCanvasFromBitmap(
        this.cachedResizedBitmap,
        adjustments,
        this.selectedColorIds,
        this.ditheringEnabled,
        this.ditheringThreshold,
        this.useGpu,
        this.quantizationMethod
      );
    } else {
      console.log("🧑‍🎨 : Using cached bitmap for processing");

      // キャッシュされたリサイズ済みBitmapを使用
      const { createProcessedCanvasFromBitmap } = await import("./canvas-processor");
      processedCanvas = await createProcessedCanvasFromBitmap(
        this.cachedResizedBitmap,
        adjustments,
        this.selectedColorIds,
        this.ditheringEnabled,
        this.ditheringThreshold,
        this.useGpu,
        this.quantizationMethod
      );
    }

    // デスクトップモード: canvas更新
    if (canvas && this.isDesktopMode) {
      canvas.width = processedCanvas.width;
      canvas.height = processedCanvas.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(processedCanvas, 0, 0);
      }
      this.scaledCanvas = canvas;

      if (this.imageInspector) {
        this.imageInspector.resetViewport();
      }
    }

    // モバイルモード: img更新
    if (image && !this.isDesktopMode) {
      image.src = processedCanvas.toDataURL();
      this.scaledCanvas = processedCanvas;
    }

    if (originalSizeDisplay) {
      originalSizeDisplay.textContent = `${this.originalImage.naturalWidth} x ${this.originalImage.naturalHeight}`;
    }
    if (currentSizeDisplay) {
      currentSizeDisplay.textContent = `${processedCanvas.width} x ${processedCanvas.height}`;
    }
  }
}
