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
    if (!file.type.startsWith("image/")) return;

    // ファイル名から座標情報抽出
    this.currentFileName = file.name;
    this.drawPosition = parseDrawPositionFromFileName(file.name);

    if (this.drawPosition) {
      console.log("🧑‍🎨 : Detected position from filename:", this.drawPosition);
    }

    const dataUrl = await readFileAsDataUrl(file);
    const { action, dataUrl: processedDataUrl } = await showImageSizeDialog(dataUrl, this.container);

    if (action === 'addToGallery') {
      // 直接ギャラリーに追加
      await this.saveDirectlyToGallery(processedDataUrl);
      return;
    }

    // 'resize' または 'edit' の場合は編集画面へ
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

    if (slider) slider.value = "1";
    if (input) input.value = "1";
    if (valueDisplay) valueDisplay.textContent = "1.00";
    if (brightnessSlider) brightnessSlider.value = "0";
    if (brightnessValue) brightnessValue.textContent = "0";
    if (contrastSlider) contrastSlider.value = "0";
    if (contrastValue) contrastValue.textContent = "0";
    if (saturationSlider) saturationSlider.value = "0";
    if (saturationValue) saturationValue.textContent = "0";

    if (dropzone) dropzone.style.display = "block";
    if (imageDisplay) imageDisplay.style.display = "none";
  }

  async saveToGallery(): Promise<void> {
    if (!this.scaledCanvas) return;

    const blob = await createBlobFromCanvas(this.scaledCanvas);
    await this.saveCanvasToGallery(blob);
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

        // 初期表示: リサイズ→調整→パレット変換
        setTimeout(() => {
          this.updateScaledImage();
        }, 50);
      };
    }

    if (dropzone) dropzone.style.display = "none";
    if (imageDisplay) imageDisplay.style.display = "block";
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
    const processedCanvas = await createProcessedCanvas(
      this.originalImage,
      this.imageScale,
      adjustments,
      this.selectedColorIds
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
