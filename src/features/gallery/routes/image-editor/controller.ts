import { t } from "../../../../i18n/manager";
import { colorpalette } from "../../../../constants/colors";
import { ImageInspector } from "../../../../components/image-inspector";
import { ColorPalette } from "../../../../components/color-palette";
import { DrawPosition, GalleryItem } from "../../storage";
import {
  readFileAsDataUrl,
  showImageSizeDialog,
  createBlobFromCanvas,
  blobToDataUrl,
  downloadBlob,
  parseDrawPositionFromFileName,
} from "./file-handler";
import { createProcessedCanvas, ImageAdjustments } from "./canvas-processor";

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
  private ditheringEnabled = false;
  private ditheringThreshold = 500;
  private useGpu = true;
  private imageInspector: ImageInspector | null = null;
  private colorPalette: ColorPalette | null = null;
  private onSaveSuccess?: () => void;
  private currentFileName: string | null = null;
  private drawPosition: DrawPosition | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setOnSaveSuccess(callback?: () => void): void {
    this.onSaveSuccess = callback;
  }

  async handleFile(file: File): Promise<void> {
    // JSON形式チェック
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      console.log("🧑‍🎨 : Detected Bluemarble JSON file");
      const { readFileAsText, parseBluemarbleJson } = await import("./file-handler");
      
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

  onScaleChange(scale: number): void {
    this.imageScale = scale;
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

    this.originalImage = null;
    this.scaledCanvas = null;
    this.imageScale = 1.0;
    this.brightness = 0;
    this.contrast = 0;
    this.saturation = 0;
    this.ditheringEnabled = false;
    this.ditheringThreshold = 500;
    this.useGpu = true;
    this.currentFileName = null;
    this.drawPosition = null;

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
    if (ditheringCheckbox) ditheringCheckbox.checked = false;
    if (gpuToggle) gpuToggle.checked = true;
    if (tlxInput) tlxInput.value = "";
    if (tlyInput) tlyInput.value = "";
    if (pxxInput) pxxInput.value = "";
    if (pxyInput) pxyInput.value = "";

    if (dropzone) dropzone.style.display = "block";
    if (imageDisplay) imageDisplay.style.display = "none";
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

    if (!tlxInput || !tlyInput || !pxxInput || !pxyInput) return null;

    const tlx = tlxInput.value.trim();
    const tly = tlyInput.value.trim();
    const pxx = pxxInput.value.trim();
    const pxy = pxyInput.value.trim();

    // 全て空欄の場合はnull
    if (!tlx && !tly && !pxx && !pxy) return null;

    // 一部のみ入力されている場合、空欄を0として扱う
    return {
      TLX: parseInt(tlx || "0"),
      TLY: parseInt(tly || "0"),
      PxX: parseInt(pxx || "0"),
      PxY: parseInt(pxy || "0"),
    };
  }

  async downloadImage(): Promise<void> {
    if (!this.scaledCanvas) return;

    const blob = await createBlobFromCanvas(this.scaledCanvas);
    downloadBlob(blob, `wplace-image-${Date.now()}.png`);
  }

  private async saveCanvasToGallery(blob: Blob): Promise<void> {
    const base64 = await blobToDataUrl(blob);
    const key = `gallery_${Date.now()}`;

    const { GalleryStorage } = await import("../../storage");
    const galleryStorage = new GalleryStorage();

    const galleryItem: GalleryItem = {
      key: key,
      timestamp: Date.now(),
      dataUrl: base64,
    };

    // 座標情報があれば追加（デフォルト表示ON）
    if (this.drawPosition) {
      galleryItem.drawPosition = this.drawPosition;
      galleryItem.drawEnabled = true;
      console.log("🧑‍🎨 : Saving with position:", this.drawPosition);
    }

    await galleryStorage.save(galleryItem);
    console.log("🧑‍🎨 : ", t`${"saved_to_gallery"}`);

    this.onSaveSuccess?.();
  }

  private async saveDirectlyToGallery(dataUrl: string): Promise<void> {
    const key = `gallery_${Date.now()}`;

    const { GalleryStorage } = await import("../../storage");
    const galleryStorage = new GalleryStorage();

    const galleryItem: GalleryItem = {
      key: key,
      timestamp: Date.now(),
      dataUrl: dataUrl,
    };

    // 座標情報があれば追加（デフォルト表示ON）
    if (this.drawPosition) {
      galleryItem.drawPosition = this.drawPosition;
      galleryItem.drawEnabled = true;
      console.log("🧑‍🎨 : Saving directly with position:", this.drawPosition);
    }

    await galleryStorage.save(galleryItem);
    console.log("🧑‍🎨 : ", t`${"saved_to_gallery"}`);

    this.onSaveSuccess?.();
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
          
          console.log("🧑‍🎨 : Initialized size inputs:", originalWidth, "x", originalHeight);
        }

        const canvas = this.container.querySelector(
          "#wps-scaled-canvas"
        ) as HTMLCanvasElement;
        if (canvas) {
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

        // 初期表示: リサイズ→調整→パレット変換
        setTimeout(() => {
          this.updateScaledImage();
        }, 50);
      };
    }

    if (dropzone) dropzone.style.display = "none";
    if (imageDisplay) imageDisplay.style.display = "block";
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

  private async updateScaledImage(): Promise<void> {
    if (!this.originalImage) return;

    const canvas = this.container.querySelector(
      "#wps-scaled-canvas"
    ) as HTMLCanvasElement;
    const originalSizeDisplay =
      this.container.querySelector("#wps-original-size");
    const currentSizeDisplay =
      this.container.querySelector("#wps-current-size");

    if (!canvas) return;

    const adjustments: ImageAdjustments = {
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
    };

    // 統合処理: リサイズ→調整→パレット（GPU優先）
    console.log("🧑‍🎨 : Processing with dithering:", this.ditheringEnabled, "useGpu:", this.useGpu);
    const processedCanvas = await createProcessedCanvas(
      this.originalImage,
      this.imageScale,
      adjustments,
      this.selectedColorIds,
      this.ditheringEnabled,
      this.ditheringThreshold,
      this.useGpu
    );

    // 結果をcanvasに転写
    canvas.width = processedCanvas.width;
    canvas.height = processedCanvas.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(processedCanvas, 0, 0);
    }

    if (originalSizeDisplay) {
      originalSizeDisplay.textContent = `${this.originalImage.naturalWidth} x ${this.originalImage.naturalHeight}`;
    }
    if (currentSizeDisplay) {
      currentSizeDisplay.textContent = `${processedCanvas.width} x ${processedCanvas.height}`;
    }

    this.scaledCanvas = canvas;

    if (this.imageInspector) {
      this.imageInspector.resetViewport();
    }
  }
}
