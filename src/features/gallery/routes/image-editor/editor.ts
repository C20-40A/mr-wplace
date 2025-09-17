import { availableColors, paidColors } from "../../../../constants/colors";
import { t } from "../../../../i18n/manager";
import { ImageInspector } from "../../../../components/image-inspector";

export class ImageProcessor {
  private container: HTMLElement;
  private originalImage: HTMLImageElement | null = null;
  private colorConvertedCanvas: HTMLCanvasElement | null = null;
  private scaledCanvas: HTMLCanvasElement | null = null;
  private imageScale = 1.0;
  private isColorConverted = false;
  private includePaidColors = true;
  private imageInspector: ImageInspector | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  handleFile(file: File): void {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        this.displayImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }

  onScaleChange(scale: number): void {
    this.imageScale = scale;
    this.updateScaledImage();
  }

  clearImage(): void {
    if (this.imageInspector) {
      this.imageInspector.destroy();
      this.imageInspector = null;
    }
    
    this.originalImage = null;
    this.colorConvertedCanvas = null;
    this.scaledCanvas = null;
    this.imageScale = 1.0;
    this.isColorConverted = false;
    this.includePaidColors = true;

    // UI状態をリセット
    const dropzone = this.container.querySelector("#wps-dropzone");
    const imageDisplay = this.container.querySelector("#wps-image-display");
    const controls = this.container.querySelector("#wps-controls");
    const slider = this.container.querySelector("#wps-scale-slider") as HTMLInputElement;
    const valueDisplay = this.container.querySelector("#wps-scale-value");
    const paidToggle = this.container.querySelector("#wps-paid-toggle") as HTMLInputElement;

    if (slider) slider.value = "1";
    if (valueDisplay) valueDisplay.textContent = "1.0";
    if (paidToggle) paidToggle.checked = true;

    dropzone?.classList.remove("hidden");
    imageDisplay?.classList.add("hidden");
    controls?.classList.add("hidden");

    const actionButtons = this.container.querySelector("#wps-action-buttons");
    actionButtons?.classList.add("hidden");
  }

  onPaidToggle(includePaid: boolean): void {
    this.includePaidColors = includePaid;
    if (this.isColorConverted) {
      setTimeout(() => {
        this.convertToPalette();
      }, 50);
    }
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
      
      try {
        const { GalleryStorage } = await import('../../storage');
        const galleryStorage = new GalleryStorage();
        
        const galleryItem = {
          key: key,
          timestamp: Date.now(),
          dataUrl: base64
        };
        
        await galleryStorage.save(galleryItem);
        console.log(t`${'saved_to_gallery'}`);

        if ((window as any).wplaceStudio?.imageEditor) {
          (window as any).wplaceStudio.imageEditor.closeModal();
        }

        if ((window as any).wplaceStudio?.gallery) {
          (window as any).wplaceStudio.gallery.show();
        }
      } catch (error) {
        console.error('Failed to save to gallery:', error);
      }
    };
    reader.readAsDataURL(blob);
  }

  private displayImage(imageSrc: string): void {
    const dropzone = this.container.querySelector("#wps-dropzone");
    const imageDisplay = this.container.querySelector("#wps-image-display");
    const controls = this.container.querySelector("#wps-controls");
    const originalImage = this.container.querySelector("#wps-original-image") as HTMLImageElement;

    if (originalImage) {
      originalImage.src = imageSrc;
      this.originalImage = originalImage;

      originalImage.onload = () => {
        this.updateOriginalImageDisplay();
        
        const canvas = this.container.querySelector("#wps-scaled-canvas") as HTMLCanvasElement;
        if (canvas) {
          this.imageInspector = new ImageInspector(canvas);
        }
        
        setTimeout(() => {
          this.convertToPalette();
        }, 50);
      };
    }

    dropzone?.classList.add("hidden");
    imageDisplay?.classList.remove("hidden");
    controls?.classList.remove("hidden");

    const actionButtons = this.container.querySelector("#wps-action-buttons");
    actionButtons?.classList.remove("hidden");
  }

  private updateOriginalImageDisplay(): void {
    const originalImage = this.container.querySelector("#wps-original-image") as HTMLImageElement;
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

    const canvas = this.container.querySelector("#wps-scaled-canvas") as HTMLCanvasElement;
    const originalSizeDisplay = this.container.querySelector("#wps-original-size");
    const currentSizeDisplay = this.container.querySelector("#wps-current-size");
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const originalWidth = this.originalImage.naturalWidth;
    const originalHeight = this.originalImage.naturalHeight;
    const newWidth = Math.floor(originalWidth * this.imageScale);
    const newHeight = Math.floor(originalHeight * this.imageScale);

    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx.imageSmoothingEnabled = false;

    const sourceImage = this.isColorConverted && this.colorConvertedCanvas
      ? this.colorConvertedCanvas
      : this.originalImage;

    if (sourceImage instanceof HTMLCanvasElement) {
      ctx.drawImage(sourceImage, 0, 0, originalWidth, originalHeight, 0, 0, newWidth, newHeight);
    } else {
      ctx.drawImage(sourceImage, 0, 0, newWidth, newHeight);
    }

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

  private convertToPalette(): void {
    if (!this.originalImage) return;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    const width = this.originalImage.naturalWidth;
    const height = this.originalImage.naturalHeight;
    tempCanvas.width = width;
    tempCanvas.height = height;

    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(this.originalImage, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, width, height);
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

    tempCtx.putImageData(imageData, 0, 0);
    this.colorConvertedCanvas = tempCanvas;
    this.isColorConverted = true;

    this.updateScaledImage();
  }

  private findNearestColor(rgb: [number, number, number]): [number, number, number] {
    let minDistance = Infinity;
    let nearestColor: [number, number, number] = [0, 0, 0];

    for (const color of Object.values(availableColors)) {
      if (!this.includePaidColors) {
        const rgbKey = `${color[0]},${color[1]},${color[2]}`;
        if (paidColors.has(rgbKey)) {
          continue;
        }
      }

      const distance = Math.sqrt(
        Math.pow(rgb[0] - color[0], 2) +
          Math.pow(rgb[1] - color[1], 2) +
          Math.pow(rgb[2] - color[2], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestColor = color as [number, number, number];
      }
    }

    return nearestColor;
  }
}
