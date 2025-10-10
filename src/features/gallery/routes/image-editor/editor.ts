import { colorpalette } from "../../../../constants/colors";
import { t } from "../../../../i18n/manager";
import { ImageInspector } from "../../../../components/image-inspector";
import { ColorPalette } from "../../../../components/color-palette";
import { DrawPosition, GalleryItem } from "../../storage";

export class ImageProcessor {
  private container: HTMLElement;
  private originalImage: HTMLImageElement | null = null;
  // private colorConvertedCanvas: HTMLCanvasElement | null = null;
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

  handleFile(file: File): void {
    if (!file.type.startsWith("image/")) return;

    // ファイル名から座標情報抽出
    this.currentFileName = file.name;
    this.drawPosition = this.parseDrawPositionFromFileName(file.name);

    if (this.drawPosition) {
      console.log("🧑‍🎨 : Detected position from filename:", this.drawPosition);
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      if (e.target?.result) {
        const dataUrl = e.target.result as string;
        const processedDataUrl = await this.resizeImageIfNeeded(dataUrl);
        this.displayImage(processedDataUrl);
      }
    };
    reader.readAsDataURL(file);
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
    // this.colorConvertedCanvas = null;
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

    this.scaledCanvas.toBlob(async (blob) => {
      if (!blob) return;
      await this.saveCanvasToGallery(blob);
    }, "image/png");
  }

  downloadImage(): void {
    if (!this.scaledCanvas) return;

    this.scaledCanvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wplace-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  private async saveCanvasToGallery(blob: Blob): Promise<void> {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
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
    };
    reader.readAsDataURL(blob);
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

  private updateScaledImage(): void {
    if (!this.originalImage) return;

    const canvas = this.container.querySelector(
      "#wps-scaled-canvas"
    ) as HTMLCanvasElement;
    const originalSizeDisplay =
      this.container.querySelector("#wps-original-size");
    const currentSizeDisplay =
      this.container.querySelector("#wps-current-size");
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const originalWidth = this.originalImage.naturalWidth;
    const originalHeight = this.originalImage.naturalHeight;
    const newWidth = Math.floor(originalWidth * this.imageScale);
    const newHeight = Math.floor(originalHeight * this.imageScale);

    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.imageSmoothingEnabled = false;

    // 1. 元画像からリサイズ
    ctx.drawImage(this.originalImage, 0, 0, newWidth, newHeight);

    // 2. 調整適用（リサイズ後）
    this.applyAdjustments(ctx, newWidth, newHeight);

    // 3. カラーパレット変換（調整後）
    this.applyPaletteToCanvas(ctx, newWidth, newHeight);

    if (originalSizeDisplay) {
      originalSizeDisplay.textContent = `${originalWidth} x ${originalHeight}`;
    }
    if (currentSizeDisplay) {
      currentSizeDisplay.textContent = `${newWidth} x ${newHeight}`;
    }

    this.scaledCanvas = canvas;

    if (this.imageInspector) {
      this.imageInspector.resetViewport();
    }
  }

  private applyAdjustments(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    if (this.brightness === 0 && this.contrast === 0 && this.saturation === 0)
      return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 明るさ
      r += this.brightness * 2.55;
      g += this.brightness * 2.55;
      b += this.brightness * 2.55;

      // コントラスト
      const contrastFactor =
        (259 * (this.contrast + 255)) / (255 * (259 - this.contrast));
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;

      // 彩度
      if (this.saturation !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const satFactor = 1 + this.saturation / 100;
        r = gray + (r - gray) * satFactor;
        g = gray + (g - gray) * satFactor;
        b = gray + (b - gray) * satFactor;
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
  }

  private applyPaletteToCanvas(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const nearestColor = this.findNearestColor([r, g, b]);
      data[i] = nearestColor[0];
      data[i + 1] = nearestColor[1];
      data[i + 2] = nearestColor[2];
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // private convertToPalette(): void {
  //   if (!this.originalImage) return;

  //   const tempCanvas = document.createElement("canvas");
  //   const tempCtx = tempCanvas.getContext("2d");
  //   if (!tempCtx) return;

  //   const width = this.originalImage.naturalWidth;
  //   const height = this.originalImage.naturalHeight;
  //   tempCanvas.width = width;
  //   tempCanvas.height = height;

  //   tempCtx.imageSmoothingEnabled = false;
  //   tempCtx.drawImage(this.originalImage, 0, 0);

  //   const imageData = tempCtx.getImageData(0, 0, width, height);
  //   const data = imageData.data;

  //   for (let i = 0; i < data.length; i += 4) {
  //     const r = data[i];
  //     const g = data[i + 1];
  //     const b = data[i + 2];

  //     const nearestColor = this.findNearestColor([r, g, b]);
  //     data[i] = nearestColor[0];
  //     data[i + 1] = nearestColor[1];
  //     data[i + 2] = nearestColor[2];
  //   }

  //   tempCtx.putImageData(imageData, 0, 0);
  //   this.colorConvertedCanvas = tempCanvas;
  //   this.isColorConverted = true;

  //   this.updateScaledImage();
  // }

  /**
   * 画像サイズチェック・リサイズ
   * 1000px超えたら確認→リサイズ
   */
  private async resizeImageIfNeeded(dataUrl: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 500;
        const needsResize = img.width > maxSize || img.height > maxSize;

        if (!needsResize) {
          resolve(dataUrl);
          return;
        }

        const shouldResize = confirm(
          t`${'large_image_resize_confirm'}\n\n` +
          t`${'current_size'}` + `: ${img.width} x ${img.height}px\n` +
          t`${'resize_to'}` + `: ${maxSize}px`
        );

        if (!shouldResize) {
          resolve(dataUrl);
          return;
        }

        // リサイズ処理
        const scale = maxSize / Math.max(img.width, img.height);
        const newWidth = Math.floor(img.width * scale);
        const newHeight = Math.floor(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        console.log(`🧑‍🎨 : Resized image: ${img.width}x${img.height} → ${newWidth}x${newHeight}`);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  }

  /**
   * ファイル名から座標情報抽出
   * 形式: ${TLX}-${TLY}-${PxX}-${PxY}.png
   */
  private parseDrawPositionFromFileName(fileName: string): DrawPosition | null {
    const match = fileName.match(/^(\d+)-(\d+)-(\d+)-(\d+)\.png$/);
    if (!match) return null;

    return {
      TLX: parseInt(match[1]),
      TLY: parseInt(match[2]),
      PxX: parseInt(match[3]),
      PxY: parseInt(match[4])
    };
  }

  private findNearestColor(
    rgb: [number, number, number]
  ): [number, number, number] {
    let minDistance = Infinity;
    let nearestColor: [number, number, number] = [0, 0, 0];

    for (const colorEntry of colorpalette) {
      if (!this.selectedColorIds.includes(colorEntry.id)) {
        continue;
      }

      const color = colorEntry.rgb;
      const distance = Math.sqrt(
        Math.pow(rgb[0] - color[0], 2) +
          Math.pow(rgb[1] - color[1], 2) +
          Math.pow(rgb[2] - color[2], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestColor = color;
      }
    }

    return nearestColor;
  }
}
