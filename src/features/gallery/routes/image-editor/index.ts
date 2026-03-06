import { ImageEditorUI, ImageEditorCallbacks } from "./ui";
import { EditorController } from "./controller";

export class GalleryImageEditor {
  private ui: ImageEditorUI;
  private controller: EditorController | null = null;
  private onSaveSuccess?: () => void;

  constructor() {
    this.ui = new ImageEditorUI();
  }

  setOnSaveSuccess(callback: () => void): void {
    this.onSaveSuccess = callback;
  }

  async loadExistingImage(item: any): Promise<void> {
    await this.controller?.loadExistingImage(item);
  }

  render(container: HTMLElement): void {
    container.innerHTML = '';

    const uiContainer = this.ui.createAndGetContainer();
    container.appendChild(uiContainer);

    this.controller = new EditorController(uiContainer);
    this.controller.setOnSaveSuccess(this.onSaveSuccess);
    this.ui.setController(this.controller);

    // コールバック設定
    const callbacks: ImageEditorCallbacks = {
      onFileHandle: (file) => this.controller?.handleFile(file),
      onReplaceImage: (file) => this.controller?.replaceImage(file),
      onScaleChange: (scale) => this.controller?.onScaleChange(scale),
      onBrightnessChange: (value) => this.controller?.onBrightnessChange(value),
      onContrastChange: (value) => this.controller?.onContrastChange(value),
      onSaturationChange: (value) => this.controller?.onSaturationChange(value),
      onOutlineToggle: (enabled) => this.controller?.onOutlineToggle(enabled),
      onOutlineThresholdChange: (value) => this.controller?.onOutlineThresholdChange(value),
      onOutlineWidthChange: (value) => this.controller?.onOutlineWidthChange(value),
      onOutlineUseFixedColorChange: (enabled) =>
        this.controller?.onOutlineUseFixedColorChange(enabled),
      onOutlineFixedColorChange: (value) =>
        this.controller?.onOutlineFixedColorChange(value),
      onDitheringChange: (enabled) => this.controller?.onDitheringChange(enabled),
      onDitheringThresholdChange: (threshold) => this.controller?.onDitheringThresholdChange(threshold),
      onDitheringMethodChange: (method) => this.controller?.onDitheringMethodChange(method),
      onQuantizationMethodChange: (method) => this.controller?.onQuantizationMethodChange(method),
      onGpuToggle: (enabled) => this.controller?.onGpuToggle(enabled),
      onTransparentColorsChange: (colors) => this.controller?.onTransparentColorsChange(colors),
      onOpenTransparencyTool: () => this.controller?.getProcessedImage() ?? null,
      onOpenAdjustTool: () => this.controller?.openAdjustTool(),
      onTransparencyCanvasClick: (x, y) => this.controller?.onTransparencyClick(x, y),
      onTransparencyThresholdChange: (value) =>
        this.controller?.onTransparencyBoundaryAdjust(value),
      onTransparencyApply: () => this.controller?.onTransparencyApply(),
      onTransparencyReset: () => this.controller?.onTransparencyReset(),
      onClear: () => this.controller?.clearImage(),
      onSaveToGallery: () => this.controller?.saveToGallery(),
      onDownload: () => this.controller?.downloadImage()
    };

    this.ui.setupUI(callbacks);
    this.controller.setTransparencyPreviewHandler((canvas) =>
      this.ui.updateTransparencyPreview(canvas),
    );

    // 初期タイトル設定（新規追加モード）
    this.controller.updateTitle();
  }

  destroy(): void {
    console.log("🧑‍🎨 : Destroying GalleryImageEditor...");

    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }

    this.onSaveSuccess = undefined;

    console.log("🧑‍🎨 : GalleryImageEditor destroyed");
  }
}
