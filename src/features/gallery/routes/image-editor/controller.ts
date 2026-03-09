import { t } from "@/i18n/manager";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import { isDesktopViewport } from "@/constants/breakpoints";
import { ImageInspector } from "@/components/image-inspector";
import { ColorPalette } from "@/components/color-palette";
import {
  ImageAdjustToolMode,
  type AdjustToolProcessingParams,
} from "@/features/image-adjust-tool";
import type { ProcessingState } from "@/features/image-adjust-tool/panel";
import { DrawPosition, GalleryItem } from "@/states/galleryStorage";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { gotoPosition } from "@/utils/position";
import { TransparencyMaskEditor } from "./transparency-mask-editor";
import {
  readFileAsDataUrl,
  showImageSizeDialog,
  createBlobFromCanvas,
  blobToDataUrl,
  downloadBlob,
  parseDrawPositionFromFileName,
} from "./file-handler";
import {
  ColorFlattenMode,
  DitheringMethod,
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
  private outlineEnabled = false;
  private outlineThreshold = 55;
  private outlineWidth = 1;
  private outlineUseFixedColor = false;
  private outlineFixedColor = "#000000";
  private ditheringEnabled = false;
  private ditheringThreshold = 500;
  private ditheringMethod: DitheringMethod = "ordered";
  private quantizationMethod: QuantizationMethod = "rgb-euclidean";
  private colorFlattenMode: ColorFlattenMode = "none";
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
  private transparencyMaskEditor = new TransparencyMaskEditor();
  private adjustToolMode: ImageAdjustToolMode | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setOnSaveSuccess(callback?: () => void): void {
    this.onSaveSuccess = callback;
  }

  setTransparencyPreviewHandler(
    handler: (canvas: HTMLCanvasElement) => void,
  ): void {
    this.transparencyMaskEditor.setPreviewHandler(handler);
  }

  destroy(): void {
    this.adjustToolMode?.destroy();
    this.adjustToolMode = null;
    this.clearImage();
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

  onDitheringMethodChange(method: DitheringMethod): void {
    this.ditheringMethod = method === "floyd-steinberg" ? method : "ordered";
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

  onColorFlattenModeChange(mode: ColorFlattenMode): void {
    console.log("🧑‍🎨 : Color flatten mode changed:", mode);
    this.colorFlattenMode = mode;
    this.updateScaledImage();
  }

  openAdjustTool(): void {
    if (!this.originalImage) return;
    if (!this.originalImage.src) return;

    this.adjustToolMode?.destroy();
    this.adjustToolMode = new ImageAdjustToolMode({
      imageSrc: this.originalImage.src,
      naturalWidth: this.originalImage.naturalWidth,
      naturalHeight: this.originalImage.naturalHeight,
      initialScale: this.imageScale,
      initialDrawPosition: this.drawPosition ?? undefined,
      initialProcessingState: this.buildAdjustToolInitialState(),
      onConfirm: ({ widthPx, heightPx, drawPosition, processingParams }) => {
        this.applyAdjustToolResult(
          widthPx,
          heightPx,
          drawPosition,
          processingParams,
        );
      },
      onCancel: () => {
        this.adjustToolMode = null;
      },
    });

    const opened = this.adjustToolMode.open();
    if (!opened) {
      this.adjustToolMode = null;
      return;
    }

    const dp = this.drawPosition;
    if (dp && (dp.TLX !== 0 || dp.TLY !== 0 || dp.PxX !== 0 || dp.PxY !== 0)) {
      const { lat, lng } = tilePixelToLatLng(dp.TLX, dp.TLY, dp.PxX, dp.PxY);
      void gotoPosition({ lat, lng, zoom: 12 });
    }

    console.log("🧑‍🎨 : Opened adjust tool mode");
  }

  private applyAdjustToolResult(
    targetWidthPx: number,
    targetHeightPx: number,
    drawPosition: DrawPosition | null,
    processingParams?: AdjustToolProcessingParams,
  ): void {
    if (!this.originalImage) return;

    const widthInput = this.container.querySelector(
      "#wps-width-input",
    ) as HTMLInputElement;
    const heightInput = this.container.querySelector(
      "#wps-height-input",
    ) as HTMLInputElement;
    const slider = this.container.querySelector(
      "#wps-scale-slider",
    ) as HTMLInputElement;

    const originalWidth = this.originalImage.naturalWidth;
    const originalHeight = this.originalImage.naturalHeight;
    const widthScale = targetWidthPx / originalWidth;
    const heightScale = targetHeightPx / originalHeight;
    const nextScale = Math.max(
      0.01,
      Math.min(1, Math.min(widthScale, heightScale)),
    );
    const nextWidth = Math.max(1, Math.round(originalWidth * nextScale));
    const nextHeight = Math.max(1, Math.round(originalHeight * nextScale));

    if (slider) slider.value = nextScale.toString();
    if (widthInput) widthInput.value = nextWidth.toString();
    if (heightInput) heightInput.value = nextHeight.toString();

    if (drawPosition) {
      this.drawPosition = drawPosition;
      this.setCoordinateInputs(drawPosition);
    }

    // Apply processing params from adjust tool
    if (processingParams) {
      this.applyProcessingParams(processingParams);
    }

    this.onScaleChange(nextScale);
    this.adjustToolMode = null;

    console.log(
      "🧑‍🎨 : Applied adjust tool result:",
      `${nextWidth}x${nextHeight}`,
      drawPosition,
      processingParams ? "with processing params" : "",
    );
  }

  private applyProcessingParams(params: AdjustToolProcessingParams): void {
    const { adjustments } = params;
    this.brightness = adjustments.brightness;
    this.contrast = adjustments.contrast;
    this.saturation = adjustments.saturation;
    this.ditheringEnabled = params.ditheringEnabled;
    this.ditheringThreshold = params.ditheringThreshold;
    this.ditheringMethod = params.ditheringMethod;
    this.quantizationMethod = params.quantizationMethod;
    this.colorFlattenMode = params.colorFlattenMode;
    this.outlineEnabled = params.outlineEnabled;
    this.outlineThreshold = params.outlineThreshold;
    this.outlineWidth = params.outlineWidth;
    this.outlineUseFixedColor = params.outlineUseFixedColor;
    this.outlineFixedColor = params.outlineFixedColor;
    this.selectedColorIds = params.selectedColorIds;

    // Sync UI controls
    this.syncControlsUI(params);
  }

  private syncControlsUI(params: AdjustToolProcessingParams): void {
    const set = (id: string, value: string) => {
      const el = this.container.querySelector(`#${id}`) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      if (el) (el as any).value = value;
    };
    const setChecked = (id: string, checked: boolean) => {
      const el = this.container.querySelector(
        `#${id}`,
      ) as HTMLInputElement | null;
      if (el) el.checked = checked;
    };
    const setText = (id: string, text: string) => {
      const el = this.container.querySelector(`#${id}`) as HTMLElement | null;
      if (el) el.textContent = text;
    };
    const setDisabled = (id: string, disabled: boolean) => {
      const el = this.container.querySelector(`#${id}`) as
        | HTMLInputElement
        | HTMLSelectElement
        | null;
      if (el) el.disabled = disabled;
    };

    set("wps-brightness-slider", `${params.adjustments.brightness}`);
    setText("wps-brightness-value", `${params.adjustments.brightness}`);
    set("wps-contrast-slider", `${params.adjustments.contrast}`);
    setText("wps-contrast-value", `${params.adjustments.contrast}`);
    set("wps-saturation-slider", `${params.adjustments.saturation}`);
    setText("wps-saturation-value", `${params.adjustments.saturation}`);

    setChecked("wps-dithering-checkbox", params.ditheringEnabled);
    set("wps-dithering-threshold-slider", `${params.ditheringThreshold}`);
    setText("wps-dithering-threshold-value", `${params.ditheringThreshold}`);
    set("wps-dithering-method", params.ditheringMethod);
    setDisabled("wps-dithering-threshold-slider", !params.ditheringEnabled);
    setDisabled("wps-dithering-method", !params.ditheringEnabled);

    set("wps-quantization-method", params.quantizationMethod);
    set("wps-color-flatten-mode", params.colorFlattenMode);

    setChecked("wps-outline-checkbox", params.outlineEnabled);
    set("wps-outline-threshold-slider", `${params.outlineThreshold}`);
    setText("wps-outline-threshold-value", `${params.outlineThreshold}`);
    set("wps-outline-width-slider", `${params.outlineWidth}`);
    setText("wps-outline-width-value", `${params.outlineWidth}`);
    setChecked("wps-outline-color-checkbox", params.outlineUseFixedColor);
    set("wps-outline-color-input", params.outlineFixedColor);
    setDisabled("wps-outline-threshold-slider", !params.outlineEnabled);
    setDisabled("wps-outline-width-slider", !params.outlineEnabled);
    setDisabled("wps-outline-color-checkbox", !params.outlineEnabled);
    setDisabled(
      "wps-outline-color-input",
      !params.outlineEnabled || !params.outlineUseFixedColor,
    );

    // Update color palette
    if (this.colorPalette) {
      this.colorPalette.destroy();
      this.colorPalette = null;
    }
    const isMobile = !this.isDesktopMode;
    const containerSelector = isMobile
      ? "#wps-color-palette-container-mobile"
      : "#wps-color-palette-container";
    const paletteContainer = this.container.querySelector(
      containerSelector,
    ) as HTMLElement;
    if (paletteContainer) {
      this.colorPalette = new ColorPalette(paletteContainer, {
        selectedColorIds: params.selectedColorIds,
        onChange: (colorIds) => this.onColorSelectionChange(colorIds),
        hasExtraColorsBitmap: true,
        showColorStats: true,
        colorStatsTotalOnly: true,
        showDisableUnusedButton: true,
        controlSize: "xs",
        sortOrder: "least-remaining",
      });
    }
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
    this.adjustToolMode?.destroy();
    this.adjustToolMode = null;

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
    this.ditheringMethod = "ordered";
    this.quantizationMethod = "rgb-euclidean";
    this.colorFlattenMode = "none";
    this.useGpu = true;
    this.transparentColors.clear();
    this.transparencyMaskEditor.clear();
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
    const quantizationMethodSelect = this.container.querySelector(
      "#wps-quantization-method",
    ) as HTMLSelectElement;
    const ditheringMethodSelect = this.container.querySelector(
      "#wps-dithering-method",
    ) as HTMLSelectElement;
    const colorFlattenModeSelect = this.container.querySelector(
      "#wps-color-flatten-mode",
    ) as HTMLSelectElement;
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
    if (quantizationMethodSelect)
      quantizationMethodSelect.value = "rgb-euclidean";
    if (ditheringMethodSelect) {
      ditheringMethodSelect.value = "ordered";
      ditheringMethodSelect.disabled = true;
    }
    if (colorFlattenModeSelect) colorFlattenModeSelect.value = "none";
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
    this.adjustToolMode?.destroy();
    this.adjustToolMode = null;

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
    this.transparencyMaskEditor.clear();

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
    this.adjustToolMode?.destroy();
    this.adjustToolMode = null;

    // 画像を置き換える際はキャッシュをクリア
    if (this.cachedResizedBitmap) {
      this.cachedResizedBitmap.close();
      this.cachedResizedBitmap = null;
    }
    this.clearOutlineBitmapCache();
    this.transparencyMaskEditor.clear();

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
    this.setCoordinateInputs(this.drawPosition);

    console.log("🧑‍🎨 : Auto-filled coordinates:", this.drawPosition);
  }

  private setCoordinateInputs(position: DrawPosition): void {
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

    if (tlxInput) tlxInput.value = position.TLX.toString();
    if (tlyInput) tlyInput.value = position.TLY.toString();
    if (pxxInput) pxxInput.value = position.PxX.toString();
    if (pxyInput) pxyInput.value = position.PxY.toString();
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

    const adjustments = this.buildImageAdjustments();
    const processingSourceBitmap = await this.resolveProcessingSourceBitmap();
    if (!processingSourceBitmap) return;

    if (processingSourceBitmap === this.cachedResizedBitmap) {
      console.log("🧑‍🎨 : Using cached bitmap for processing");
    } else {
      console.log("🧑‍🎨 : Using outline-preserved bitmap for processing");
    }

    // GPU toggle affects only the final adjustment/quantization backend.
    // Resizing and outline bitmap generation still happen through the browser image/canvas path.
    const { createProcessedCanvasFromBitmap } =
      await import("./canvas-processor");
    const processedCanvas = await createProcessedCanvasFromBitmap(
      processingSourceBitmap,
      adjustments,
      this.selectedColorIds,
      this.ditheringEnabled,
      this.ditheringThreshold,
      this.ditheringMethod,
      this.useGpu,
      this.quantizationMethod,
      this.colorFlattenMode,
      this.transparentColors,
    );

    const transparencyResult =
      this.transparencyMaskEditor.applyCommittedMaskToCanvas(processedCanvas);
    if (transparencyResult === "size_mismatch") {
      this.transparencyMaskEditor.clear();
    }

    // デスクトップモード: canvas更新
    if (canvas && this.isDesktopMode) {
      canvas.width = processedCanvas.width;
      canvas.height = processedCanvas.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
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

  private buildImageAdjustments(): ImageAdjustments {
    return {
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
    };
  }

  private buildAdjustToolInitialState(): ProcessingState {
    return {
      brightness: this.brightness,
      contrast: this.contrast,
      saturation: this.saturation,
      selectedColorIds: [...this.selectedColorIds],
      ditheringEnabled: this.ditheringEnabled,
      ditheringThreshold: this.ditheringThreshold,
      ditheringMethod: this.ditheringMethod,
      quantizationMethod: this.quantizationMethod,
      colorFlattenMode: this.colorFlattenMode,
      outlineEnabled: this.outlineEnabled,
      outlineThreshold: this.outlineThreshold,
      outlineWidth: this.outlineWidth,
      outlineUseFixedColor: this.outlineUseFixedColor,
      outlineFixedColor: this.outlineFixedColor,
    };
  }

  private async ensureResizedBitmap(): Promise<ImageBitmap | null> {
    if (!this.originalImage) return null;

    if (this.cachedResizedBitmap && this.cachedScale === this.imageScale) {
      return this.cachedResizedBitmap;
    }

    console.log("🧑‍🎨 : Scale changed, creating new resized bitmap");

    const { createResizedImageBitmap } =
      await import("@/utils/image-bitmap-compat");
    const newWidth = Math.floor(
      this.originalImage.naturalWidth * this.imageScale,
    );
    const newHeight = Math.floor(
      this.originalImage.naturalHeight * this.imageScale,
    );

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
    return this.cachedResizedBitmap;
  }

  private buildOutlineCacheKey(): string {
    if (!this.originalImage) return "";

    return [
      this.imageScale.toFixed(4),
      this.outlineThreshold,
      this.outlineWidth,
      this.outlineUseFixedColor ? 1 : 0,
      this.outlineFixedColor,
      this.originalImage.naturalWidth,
      this.originalImage.naturalHeight,
    ].join("|");
  }

  private async resolveProcessingSourceBitmap(): Promise<ImageBitmap | null> {
    const resizedBitmap = await this.ensureResizedBitmap();
    if (!resizedBitmap || !this.originalImage) return null;

    if (!this.outlineEnabled || this.imageScale >= 1) {
      this.clearOutlineBitmapCache();
      return resizedBitmap;
    }

    const outlineKey = this.buildOutlineCacheKey();
    if (!this.cachedOutlineBitmap || this.cachedOutlineKey !== outlineKey) {
      const { createOutlinePreservedBitmap } =
        await import("./canvas-processor");
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

    return this.cachedOutlineBitmap ?? resizedBitmap;
  }

  private updateColorPaletteWithPixelCounts(canvas: HTMLCanvasElement): void {
    if (!this.colorPalette) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
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
    this.updatePixelCountAndTime(totalPixels, canvas.width, canvas.height);
  }

  private updatePixelCountAndTime(totalPixels: number, width?: number, height?: number): void {
    const sizeReductionLabel = this.container.querySelector(
      "#wps-size-reduction-label",
    ) as HTMLElement;
    if (!sizeReductionLabel) return;

    if (totalPixels > 0) {
      const timeStr = this.formatEstimatedTime(totalPixels);
      const sizeStr = width && height ? `${width}×${height}px` : `${totalPixels.toLocaleString()}px`;
      sizeReductionLabel.innerHTML = `${t("size_reduction")} <span style="color: #9ca3af; font-size: 0.6875rem;">${sizeStr}<br>(${timeStr})</span>`;
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
    this.transparencyMaskEditor.handleCanvasClick(this.scaledCanvas, x, y);
  }

  onTransparencyBoundaryAdjust(value: number): void {
    this.transparencyMaskEditor.setBoundaryAdjust(value);
  }

  onTransparencyApply(): void {
    this.transparencyMaskEditor.applyPendingSelection();
    this.updateScaledImage();
  }

  onTransparencyReset(): void {
    this.transparencyMaskEditor.resetPreview(this.scaledCanvas);
  }

  private clearOutlineBitmapCache(): void {
    if (this.cachedOutlineBitmap) {
      this.cachedOutlineBitmap.close();
      this.cachedOutlineBitmap = null;
    }
    this.cachedOutlineKey = "";
  }
}
