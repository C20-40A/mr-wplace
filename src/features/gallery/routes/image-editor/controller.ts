import { t } from "@/i18n/manager";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import { isDesktopViewport } from "@/constants/breakpoints";
import { ImageInspector } from "@/components/image-inspector";
import { ColorPalette } from "@/components/color-palette";
import { DrawPosition, GalleryItem } from "@/states/galleryStorage";
import {
  readFileAsDataUrl,
  showImageSizeDialog,
  createBlobFromCanvas,
  blobToDataUrl,
  downloadBlob,
  parseDrawPositionFromFileName,
} from "./file-handler";
import { ImageAdjustments, QuantizationMethod } from "./canvas-processor";

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
  private outlineEnabled = false;
  private outlineThreshold = 55;
  private outlineWidth = 1;
  private outlineUseFixedColor = false;
  private outlineFixedColor = "#000000";
  private ditheringEnabled = false;
  private ditheringThreshold = 500;
  private quantizationMethod: QuantizationMethod = "rgb-euclidean";
  private useGpu = true;
  private transparentColors = new Set<string>();
  private imageInspector: ImageInspector | null = null;
  private colorPalette: ColorPalette | null = null;
  private onSaveSuccess?: () => void;
  private currentFileName: string | null = null;
  private drawPosition: DrawPosition | null = null;
  private isEditMode = false;
  private editingItemKey: string | null = null;
  private isDesktopMode = true;
  private cachedResizedBitmap: ImageBitmap | null = null;
  private cachedOutlineBitmap: ImageBitmap | null = null;
  private cachedOutlineKey = "";
  private cachedScale = 1.0;
  private readonly inspectorContainerSize = 300;
  private transparencyMask: Uint8Array | null = null;
  private transparencyWorkingMask: Uint8Array | null = null;
  private transparencyMaskWidth = 0;
  private transparencyMaskHeight = 0;
  private transparencyBoundaryAdjust = 0;
  private transparencyWorkingCanvas: HTMLCanvasElement | null = null;
  private transparencyPreviewHandler?: (canvas: HTMLCanvasElement) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setOnSaveSuccess(callback?: () => void): void {
    this.onSaveSuccess = callback;
  }

  setTransparencyPreviewHandler(
    handler: (canvas: HTMLCanvasElement) => void,
  ): void {
    this.transparencyPreviewHandler = handler;
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
      "#wps-add-to-gallery",
    ) as HTMLButtonElement;
    if (!saveBtn) return;

    saveBtn.textContent = this.isEditMode ? t`💾 ${"update"}` : t`💾 ${"save"}`;

    // タイトルも更新
    this.updateTitle();
  }

  updateTitle(): void {
    const titleElement = document.querySelector(
      "#wplace-studio-gallery-modal-title",
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
      const { readFileAsText, parseBluemarbleJson } =
        await import("./file-handler");

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
      this.container,
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
      const { readFileAsText, parseBluemarbleJson } =
        await import("./file-handler");

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

    // 画像差し替え時は警告ダイアログをスキップして直接編集を続行
    const dataUrl = await readFileAsDataUrl(file);
    this.replaceImageDisplay(dataUrl);
  }

  onScaleChange(scale: number): void {
    this.imageScale = scale;
    // スケール変更時はキャッシュをクリア
    if (this.cachedResizedBitmap) {
      this.cachedResizedBitmap.close();
      this.cachedResizedBitmap = null;
    }
    this.clearOutlineBitmapCache();
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

  onOutlineToggle(enabled: boolean): void {
    console.log("🧑‍🎨 : Outline preserve toggled:", enabled);
    this.outlineEnabled = enabled;
    this.clearOutlineBitmapCache();
    this.updateScaledImage();
  }

  onOutlineThresholdChange(value: number): void {
    this.outlineThreshold = value;
    this.clearOutlineBitmapCache();
    this.updateScaledImage();
  }

  onOutlineWidthChange(value: number): void {
    this.outlineWidth = value;
    this.clearOutlineBitmapCache();
    this.updateScaledImage();
  }

  onOutlineUseFixedColorChange(enabled: boolean): void {
    this.outlineUseFixedColor = enabled;
    this.clearOutlineBitmapCache();
    this.updateScaledImage();
  }

  onOutlineFixedColorChange(value: string): void {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return;
    this.outlineFixedColor = value;
    this.clearOutlineBitmapCache();
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

  getProcessedImage(): HTMLCanvasElement | null {
    return this.scaledCanvas;
  }

  onTransparentColorsChange(colors: Set<string>): void {
    this.transparentColors = colors;
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
    this.selectedColorIds = colorpalette
      .filter((c) => c.id !== TRANSPARENT_COLOR_ID)
      .map((c) => c.id);
    this.colorPalette = new ColorPalette(container, {
      selectedColorIds: this.selectedColorIds,
      onChange: (colorIds) => this.onColorSelectionChange(colorIds),
      hasExtraColorsBitmap: true,
      showColorStats: true,
      colorStatsTotalOnly: true,
      showDisableUnusedButton: true,
      controlSize: "xs",
      sortOrder: "least-remaining",
    });
  }

  updateColorPaletteContainer(isMobile: boolean): void {
    if (!this.originalImage) return;

    const containerSelector = isMobile
      ? "#wps-color-palette-container-mobile"
      : "#wps-color-palette-container";
    const newContainer = this.container.querySelector(
      containerSelector,
    ) as HTMLElement;

    if (!newContainer) return;

    if (this.colorPalette) {
      this.colorPalette.destroy();
    }

    this.colorPalette = new ColorPalette(newContainer, {
      selectedColorIds: this.selectedColorIds,
      onChange: (colorIds) => this.onColorSelectionChange(colorIds),
      hasExtraColorsBitmap: true,
      showColorStats: true,
      colorStatsTotalOnly: true,
      showDisableUnusedButton: true,
      controlSize: "xs",
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
    this.clearOutlineBitmapCache();

    this.originalImage = null;
    this.scaledCanvas = null;
    this.imageScale = 1.0;
    this.cachedScale = 1.0;
    this.brightness = 0;
    this.contrast = 0;
    this.saturation = 0;
    this.outlineEnabled = false;
    this.outlineThreshold = 55;
    this.outlineWidth = 1;
    this.outlineUseFixedColor = false;
    this.outlineFixedColor = "#000000";
    this.ditheringEnabled = false;
    this.ditheringThreshold = 500;
    this.quantizationMethod = "rgb-euclidean";
    this.useGpu = true;
    this.transparentColors.clear();
    this.resetTransparencyState();
    this.currentFileName = null;
    this.drawPosition = null;
    this.isEditMode = false;
    this.editingItemKey = null;

    const dropzone = this.container.querySelector(
      "#wps-dropzone-container",
    ) as HTMLElement;
    const imageDisplay = this.container.querySelector(
      "#wps-image-display",
    ) as HTMLElement;
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
    const outlineCheckbox = this.container.querySelector(
      "#wps-outline-checkbox",
    ) as HTMLInputElement;
    const outlineThresholdSlider = this.container.querySelector(
      "#wps-outline-threshold-slider",
    ) as HTMLInputElement;
    const outlineThresholdValue = this.container.querySelector(
      "#wps-outline-threshold-value",
    );
    const outlineWidthSlider = this.container.querySelector(
      "#wps-outline-width-slider",
    ) as HTMLInputElement;
    const outlineWidthValue = this.container.querySelector(
      "#wps-outline-width-value",
    );
    const outlineColorCheckbox = this.container.querySelector(
      "#wps-outline-color-checkbox",
    ) as HTMLInputElement;
    const outlineColorInput = this.container.querySelector(
      "#wps-outline-color-input",
    ) as HTMLInputElement;
    const ditheringCheckbox = this.container.querySelector(
      "#wps-dithering-checkbox",
    ) as HTMLInputElement;
    const gpuToggle = this.container.querySelector(
      "#wps-gpu-toggle",
    ) as HTMLInputElement;
    const tlxInput = this.container.querySelector(
      "#wps-coord-tlx",
    ) as HTMLInputElement;
    const tlyInput = this.container.querySelector(
      "#wps-coord-tly",
    ) as HTMLInputElement;
    const pxxInput = this.container.querySelector(
      "#wps-coord-pxx",
    ) as HTMLInputElement;
    const pxyInput = this.container.querySelector(
      "#wps-coord-pxy",
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
    if (outlineCheckbox) outlineCheckbox.checked = false;
    if (outlineThresholdSlider) {
      outlineThresholdSlider.value = "55";
      outlineThresholdSlider.disabled = true;
    }
    if (outlineThresholdValue) outlineThresholdValue.textContent = "55";
    if (outlineWidthSlider) {
      outlineWidthSlider.value = "1";
      outlineWidthSlider.disabled = true;
    }
    if (outlineWidthValue) outlineWidthValue.textContent = "1";
    if (outlineColorCheckbox) {
      outlineColorCheckbox.checked = false;
      outlineColorCheckbox.disabled = true;
    }
    if (outlineColorInput) {
      outlineColorInput.value = "#000000";
      outlineColorInput.disabled = true;
    }
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
    isEditMode = false,
  ): Promise<void> {
    const itemKey =
      key || `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // Convert blob to dataUrl for v2 API
    const dataUrl = await blobToDataUrl(blob);

    // Use v2 API directly - saves image + thumbnail + metadata + tiles in one call
    const { saveGalleryItem } =
      await import("@/core/bridge/gallery-storage-bridge");

    await saveGalleryItem(itemKey, dataUrl, {
      title: undefined,
      coords: this.drawPosition || undefined,
      visible: this.drawPosition ? true : false,
      zIndex: 0,
      timestamp: Date.now(),
    });

    console.log(
      "🧑‍🎨 : ",
      isEditMode ? t`${"updated"}` : t`${"saved_to_gallery"}`,
      itemKey,
    );

    this.onSaveSuccess?.();
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
      "#wps-dropzone-container",
    ) as HTMLElement;
    const imageDisplay = this.container.querySelector(
      "#wps-image-display",
    ) as HTMLElement;
    const originalImage = this.container.querySelector(
      "#wps-original-image",
    ) as HTMLImageElement;

    // 新しい画像を表示する際はキャッシュをクリア
    if (this.cachedResizedBitmap) {
      this.cachedResizedBitmap.close();
      this.cachedResizedBitmap = null;
    }
    this.clearOutlineBitmapCache();
    this.resetTransparencyState();

    if (originalImage) {
      originalImage.src = imageSrc;
      this.originalImage = originalImage;

      originalImage.onload = () => {
        this.updateOriginalImageDisplay();

        // 画像サイズ入力の初期化
        const widthInput = this.container.querySelector(
          "#wps-width-input",
        ) as HTMLInputElement;
        const heightInput = this.container.querySelector(
          "#wps-height-input",
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
            originalHeight,
          );
        }

        const canvas = this.container.querySelector(
          "#wps-scaled-canvas",
        ) as HTMLCanvasElement;
        // デスクトップ環境のみImageInspector初期化
        if (canvas && this.isDesktopMode) {
          this.imageInspector = new ImageInspector(canvas, {
            onViewportChange: (zoom, panX, panY) =>
              this.syncOriginalImageViewport(zoom, panX, panY),
          });
        }

        const isMobile = !isDesktopViewport();
        const colorPaletteContainer = isMobile
          ? (this.container.querySelector(
              "#wps-color-palette-container-mobile",
            ) as HTMLElement)
          : (this.container.querySelector(
              "#wps-color-palette-container",
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
    this.clearOutlineBitmapCache();
    this.resetTransparencyState();

    const originalImage = this.container.querySelector(
      "#wps-original-image",
    ) as HTMLImageElement;

    if (originalImage) {
      originalImage.src = imageSrc;
      this.originalImage = originalImage;

      originalImage.onload = () => {
        this.updateOriginalImageDisplay();

        // 画像サイズ入力の更新（元画像サイズ基準）
        const widthInput = this.container.querySelector(
          "#wps-width-input",
        ) as HTMLInputElement;
        const heightInput = this.container.querySelector(
          "#wps-height-input",
        ) as HTMLInputElement;
        const slider = this.container.querySelector(
          "#wps-scale-slider",
        ) as HTMLInputElement;

        if (widthInput && heightInput && this.originalImage) {
          const originalWidth = this.originalImage.naturalWidth;
          const originalHeight = this.originalImage.naturalHeight;

          // 現在のscaleを維持してサイズを更新
          widthInput.value = Math.round(
            originalWidth * this.imageScale,
          ).toString();
          heightInput.value = Math.round(
            originalHeight * this.imageScale,
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
            originalHeight,
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
      "#wps-coord-tlx",
    ) as HTMLInputElement;
    const tlyInput = this.container.querySelector(
      "#wps-coord-tly",
    ) as HTMLInputElement;
    const pxxInput = this.container.querySelector(
      "#wps-coord-pxx",
    ) as HTMLInputElement;
    const pxyInput = this.container.querySelector(
      "#wps-coord-pxy",
    ) as HTMLInputElement;

    if (tlxInput) tlxInput.value = this.drawPosition.TLX.toString();
    if (tlyInput) tlyInput.value = this.drawPosition.TLY.toString();
    if (pxxInput) pxxInput.value = this.drawPosition.PxX.toString();
    if (pxyInput) pxyInput.value = this.drawPosition.PxY.toString();

    console.log("🧑‍🎨 : Auto-filled coordinates:", this.drawPosition);
  }

  private updateOriginalImageDisplay(): void {
    const originalImage = this.container.querySelector(
      "#wps-original-image",
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
      "#wps-scaled-canvas",
    ) as HTMLCanvasElement;

    if (isDesktop && canvas && !this.imageInspector) {
      this.imageInspector = new ImageInspector(canvas, {
        onViewportChange: (zoom, panX, panY) =>
          this.syncOriginalImageViewport(zoom, panX, panY),
      });
    } else if (!isDesktop && this.imageInspector) {
      // モバイルモードではImageInspectorを破棄
      this.imageInspector = null;
      this.resetOriginalImageViewport();
      this.updateOriginalImageDisplay();
    }

    // 画像を再描画
    this.updateScaledImage();
  }

  private async updateScaledImage(): Promise<void> {
    if (!this.originalImage) return;

    const canvas = this.container.querySelector(
      "#wps-scaled-canvas",
    ) as HTMLCanvasElement;
    const image = this.container.querySelector(
      "#wps-scaled-image",
    ) as HTMLImageElement;

    const adjustments: ImageAdjustments = {
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
    };

    // スケール変更時のみリサイズを実行、それ以外はキャッシュを利用
    if (!this.cachedResizedBitmap || this.cachedScale !== this.imageScale) {
      console.log("🧑‍🎨 : Scale changed, creating new resized bitmap");

      // リサイズ実行
      const { createResizedImageBitmap } =
        await import("@/utils/image-bitmap-compat");
      const originalWidth = this.originalImage.naturalWidth;
      const originalHeight = this.originalImage.naturalHeight;
      const newWidth = Math.floor(originalWidth * this.imageScale);
      const newHeight = Math.floor(originalHeight * this.imageScale);

      // 古いキャッシュをクリア
      if (this.cachedResizedBitmap) {
        this.cachedResizedBitmap.close();
      }

      this.cachedResizedBitmap = await createResizedImageBitmap(
        this.originalImage,
        {
          width: newWidth,
          height: newHeight,
          quality: "pixelated",
        },
      );
      this.cachedScale = this.imageScale;
      this.clearOutlineBitmapCache();
    }
    if (!this.cachedResizedBitmap) return;

    let processingSourceBitmap = this.cachedResizedBitmap;
    if (this.outlineEnabled && this.imageScale < 1) {
      const outlineKey = [
        this.imageScale.toFixed(4),
        this.outlineThreshold,
        this.outlineWidth,
        this.outlineUseFixedColor ? 1 : 0,
        this.outlineFixedColor,
        this.originalImage.naturalWidth,
        this.originalImage.naturalHeight,
      ].join("|");

      if (!this.cachedOutlineBitmap || this.cachedOutlineKey !== outlineKey) {
        const { createOutlinePreservedBitmap } = await import("./canvas-processor");
        this.clearOutlineBitmapCache();
        this.cachedOutlineBitmap = await createOutlinePreservedBitmap(
          this.originalImage,
          this.imageScale,
          {
            enabled: true,
            threshold: this.outlineThreshold,
            width: this.outlineWidth,
            useFixedColor: this.outlineUseFixedColor,
            fixedColor: this.outlineFixedColor,
          },
        );
        this.cachedOutlineKey = outlineKey;
      }

      if (this.cachedOutlineBitmap) {
        processingSourceBitmap = this.cachedOutlineBitmap;
      }
    } else {
      this.clearOutlineBitmapCache();
    }

    if (processingSourceBitmap === this.cachedResizedBitmap) {
      console.log("🧑‍🎨 : Using cached bitmap for processing");
    } else {
      console.log("🧑‍🎨 : Using outline-preserved bitmap for processing");
    }

    const { createProcessedCanvasFromBitmap } =
      await import("./canvas-processor");
    const processedCanvas = await createProcessedCanvasFromBitmap(
      processingSourceBitmap,
      adjustments,
      this.selectedColorIds,
      this.ditheringEnabled,
      this.ditheringThreshold,
      this.useGpu,
      this.quantizationMethod,
      this.transparentColors,
    );

    // 透過マスク適用（編集後も維持）
    if (this.transparencyMask) {
      if (
        processedCanvas.width !== this.transparencyMaskWidth ||
        processedCanvas.height !== this.transparencyMaskHeight
      ) {
        this.resetTransparencyState();
      } else {
        this.applyTransparencyMaskToCanvas(processedCanvas, this.transparencyMask);
      }
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

    // ピクセル数を集計してColorPaletteを更新
    this.updateColorPaletteWithPixelCounts(processedCanvas);
  }

  private updateColorPaletteWithPixelCounts(canvas: HTMLCanvasElement): void {
    if (!this.colorPalette) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const pixelCounts = new Map<string, number>();

    // ピクセル数を集計
    let totalPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // 透明ピクセルはスキップ
      if (a === 0) continue;

      totalPixels++;
      const key = `${r},${g},${b}`;
      pixelCounts.set(key, (pixelCounts.get(key) || 0) + 1);
    }

    // colorStats形式に変換 (matched: 0, total: ピクセル数)
    const colorStats: Record<string, { matched: number; total: number }> = {};
    for (const [key, count] of pixelCounts.entries()) {
      colorStats[key] = { matched: 0, total: count };
    }

    if (this.colorPalette) {
      this.colorPalette.updateColorStats(colorStats);
    } else {
      const isMobile = !this.isDesktopMode;
      const containerSelector = isMobile
        ? "#wps-color-palette-container-mobile"
        : "#wps-color-palette-container";
      const container = this.container.querySelector(
        containerSelector,
      ) as HTMLElement;

      if (container) {
        this.colorPalette = new ColorPalette(container, {
          selectedColorIds: this.selectedColorIds,
          onChange: (colorIds) => this.onColorSelectionChange(colorIds),
          hasExtraColorsBitmap: true,
          showColorStats: true,
          colorStats,
          showDisableUnusedButton: true,
          controlSize: "xs",
        });
      }
    }

    // ピクセル数と予想時間を更新
    this.updatePixelCountAndTime(totalPixels);
  }

  private updatePixelCountAndTime(totalPixels: number): void {
    const sizeReductionLabel = this.container.querySelector(
      "#wps-size-reduction-label",
    ) as HTMLElement;
    if (!sizeReductionLabel) return;

    if (totalPixels > 0) {
      const timeStr = this.formatEstimatedTime(totalPixels);
      sizeReductionLabel.innerHTML = `${t("size_reduction")} <span style="color: #9ca3af; font-size: 0.6875rem;">${totalPixels.toLocaleString()}px(${timeStr})</span>`;
    } else {
      sizeReductionLabel.textContent = t("size_reduction");
    }
  }

  private formatEstimatedTime(remainingPixels: number): string {
    const totalSeconds = remainingPixels * 30;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.length > 0 ? parts.join("") : "<1m";
  }

  private resetOriginalImageViewport(): void {
    const originalImage = this.container.querySelector(
      "#wps-original-image",
    ) as HTMLImageElement;
    if (!originalImage) return;

    originalImage.style.position = "";
    originalImage.style.top = "";
    originalImage.style.left = "";
    originalImage.style.transform = "";
    originalImage.style.width = "";
    originalImage.style.height = "";
  }

  private syncOriginalImageViewport(
    zoom: number,
    panX: number,
    panY: number,
  ): void {
    if (!this.isDesktopMode) return;
    const originalImage = this.container.querySelector(
      "#wps-original-image",
    ) as HTMLImageElement;
    const canvas = this.container.querySelector(
      "#wps-scaled-canvas",
    ) as HTMLCanvasElement;
    if (!originalImage || !canvas) return;
    if (!originalImage.naturalWidth || !originalImage.naturalHeight) return;
    if (!canvas.width || !canvas.height) return;

    const containerSize = this.inspectorContainerSize;
    const baseScaleCurrent = Math.min(
      containerSize / canvas.width,
      containerSize / canvas.height,
    );
    const baseScaleOriginal = Math.min(
      containerSize / originalImage.naturalWidth,
      containerSize / originalImage.naturalHeight,
    );

    const currentDisplayWidth = canvas.width * baseScaleCurrent * zoom;
    const currentDisplayHeight = canvas.height * baseScaleCurrent * zoom;
    const originalDisplayWidth =
      originalImage.naturalWidth * baseScaleOriginal * zoom;
    const originalDisplayHeight =
      originalImage.naturalHeight * baseScaleOriginal * zoom;

    const panXScaled =
      currentDisplayWidth > 0
        ? (panX / currentDisplayWidth) * originalDisplayWidth
        : panX;
    const panYScaled =
      currentDisplayHeight > 0
        ? (panY / currentDisplayHeight) * originalDisplayHeight
        : panY;

    originalImage.style.position = "absolute";
    originalImage.style.top = "50%";
    originalImage.style.left = "50%";
    originalImage.style.width = `${originalDisplayWidth}px`;
    originalImage.style.height = `${originalDisplayHeight}px`;
    originalImage.style.transform = `translate(calc(-50% + ${panXScaled}px), calc(-50% + ${panYScaled}px))`;
  }

  onTransparencyClick(x: number, y: number): void {
    if (!this.scaledCanvas) return;
    const ctx = this.scaledCanvas.getContext("2d");
    if (!ctx) return;

    const width = this.scaledCanvas.width;
    const height = this.scaledCanvas.height;
    if (!width || !height) return;
    if (x < 0 || y < 0 || x >= width || y >= height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const seedIndex = (y * width + x) * 4;
    if (imageData.data[seedIndex + 3] === 0) return;

    this.ensureTransparencyWorkingMask(width, height);
    if (!this.transparencyWorkingMask) return;

    const region = this.computeFloodFillRegion(imageData, x, y);
    const adjustedRegion = this.applyBoundaryAdjustToRegion(
      region,
      width,
      height,
      this.transparencyBoundaryAdjust,
    );

    for (let i = 0; i < adjustedRegion.length; i++) {
      if (adjustedRegion[i]) this.transparencyWorkingMask[i] = 1;
    }

    this.updateTransparencyPreview(imageData, this.transparencyWorkingMask);
  }

  onTransparencyBoundaryAdjust(value: number): void {
    this.transparencyBoundaryAdjust = value;
  }

  onTransparencyApply(): void {
    if (this.transparencyWorkingMask) {
      this.transparencyMask = new Uint8Array(this.transparencyWorkingMask);
    } else {
      this.transparencyMask = null;
      this.transparencyMaskWidth = 0;
      this.transparencyMaskHeight = 0;
    }
    this.transparencyWorkingMask = null;
    this.transparencyWorkingCanvas = null;
    this.updateScaledImage();
  }

  onTransparencyReset(): void {
    this.transparencyWorkingMask = null;
    this.transparencyWorkingCanvas = null;
    if (this.scaledCanvas) {
      this.transparencyPreviewHandler?.(this.scaledCanvas);
    }
  }

  private resetTransparencyState(): void {
    this.transparencyMask = null;
    this.transparencyWorkingMask = null;
    this.transparencyMaskWidth = 0;
    this.transparencyMaskHeight = 0;
    this.transparencyWorkingCanvas = null;
    this.transparencyBoundaryAdjust = 0;
  }

  private clearOutlineBitmapCache(): void {
    if (this.cachedOutlineBitmap) {
      this.cachedOutlineBitmap.close();
      this.cachedOutlineBitmap = null;
    }
    this.cachedOutlineKey = "";
  }

  private ensureTransparencyWorkingMask(width: number, height: number): void {
    if (
      !this.transparencyWorkingMask ||
      this.transparencyMaskWidth !== width ||
      this.transparencyMaskHeight !== height
    ) {
      this.transparencyMaskWidth = width;
      this.transparencyMaskHeight = height;
      this.transparencyWorkingMask = new Uint8Array(width * height);
      if (this.transparencyMask) {
        this.transparencyWorkingMask.set(this.transparencyMask);
      }
    }
  }

  private computeFloodFillRegion(
    imageData: ImageData,
    startX: number,
    startY: number,
  ): Uint8Array {
    const { width, height, data } = imageData;
    const region = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);

    const startIndex = startY * width + startX;
    const baseOffset = startIndex * 4;
    const baseR = data[baseOffset];
    const baseG = data[baseOffset + 1];
    const baseB = data[baseOffset + 2];
    const baseA = data[baseOffset + 3];

    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    queue[tail++] = startIndex;
    visited[startIndex] = 1;

    while (head < tail) {
      const idx = queue[head++];
      const offset = idx * 4;

      if (
        data[offset] !== baseR ||
        data[offset + 1] !== baseG ||
        data[offset + 2] !== baseB ||
        data[offset + 3] !== baseA
      ) {
        continue;
      }

      region[idx] = 1;

      const x = idx % width;
      const y = Math.floor(idx / width);

      if (x > 0) {
        const left = idx - 1;
        if (!visited[left]) {
          visited[left] = 1;
          queue[tail++] = left;
        }
      }
      if (x + 1 < width) {
        const right = idx + 1;
        if (!visited[right]) {
          visited[right] = 1;
          queue[tail++] = right;
        }
      }
      if (y > 0) {
        const up = idx - width;
        if (!visited[up]) {
          visited[up] = 1;
          queue[tail++] = up;
        }
      }
      if (y + 1 < height) {
        const down = idx + width;
        if (!visited[down]) {
          visited[down] = 1;
          queue[tail++] = down;
        }
      }
    }

    return region;
  }

  private applyBoundaryAdjustToRegion(
    region: Uint8Array,
    width: number,
    height: number,
    adjust: number,
  ): Uint8Array {
    if (adjust === 0) return region;

    const steps = Math.abs(adjust);
    let current = region;
    let temp = new Uint8Array(width * height);

    for (let step = 0; step < steps; step++) {
      temp.fill(0);
      if (adjust > 0) {
        for (let y = 0; y < height; y++) {
          const rowOffset = y * width;
          for (let x = 0; x < width; x++) {
            const idx = rowOffset + x;
            if (!current[idx]) continue;
            temp[idx] = 1;
            if (x > 0) temp[idx - 1] = 1;
            if (x + 1 < width) temp[idx + 1] = 1;
            if (y > 0) temp[idx - width] = 1;
            if (y + 1 < height) temp[idx + width] = 1;
          }
        }
      } else {
        for (let y = 0; y < height; y++) {
          const rowOffset = y * width;
          for (let x = 0; x < width; x++) {
            const idx = rowOffset + x;
            if (!current[idx]) continue;
            // Treat image edges as "region continues" so erosion
            // only shrinks from internal color boundaries, not image borders
            const left = x === 0 || current[idx - 1];
            const right = x + 1 === width || current[idx + 1];
            const up = y === 0 || current[idx - width];
            const down = y + 1 === height || current[idx + width];
            if (left && right && up && down) {
              temp[idx] = 1;
            }
          }
        }
      }
      const swap = current;
      current = temp;
      temp = swap;
    }

    return current;
  }

  private updateTransparencyPreview(
    baseImageData: ImageData,
    mask: Uint8Array,
  ): void {
    if (!this.transparencyPreviewHandler) return;

    const previewData = new ImageData(
      new Uint8ClampedArray(baseImageData.data),
      baseImageData.width,
      baseImageData.height,
    );
    this.applyTransparencyMaskToImageData(previewData, mask);

    if (!this.transparencyWorkingCanvas) {
      this.transparencyWorkingCanvas = document.createElement("canvas");
    }

    this.transparencyWorkingCanvas.width = previewData.width;
    this.transparencyWorkingCanvas.height = previewData.height;
    const ctx = this.transparencyWorkingCanvas.getContext("2d");
    if (!ctx) return;
    ctx.putImageData(previewData, 0, 0);
    this.transparencyPreviewHandler(this.transparencyWorkingCanvas);
  }

  private applyTransparencyMaskToCanvas(
    canvas: HTMLCanvasElement,
    mask: Uint8Array,
  ): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.applyTransparencyMaskToImageData(imageData, mask);
    ctx.putImageData(imageData, 0, 0);
  }

  private applyTransparencyMaskToImageData(
    imageData: ImageData,
    mask: Uint8Array,
  ): void {
    const data = imageData.data;
    const len = Math.min(mask.length, data.length / 4);
    for (let i = 0; i < len; i++) {
      if (mask[i]) data[i * 4 + 3] = 0;
    }
  }
}
