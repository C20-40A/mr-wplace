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
      onSharpnessToggle: (enabled) => this.controller?.onSharpnessToggle(enabled),
      onSharpnessChange: (value) => this.controller?.onSharpnessChange(value),
      onDitheringChange: (enabled) => this.controller?.onDitheringChange(enabled),
      onDitheringThresholdChange: (threshold) => this.controller?.onDitheringThresholdChange(threshold),
      onQuantizationMethodChange: (method) => this.controller?.onQuantizationMethodChange(method),
      onGpuToggle: (enabled) => this.controller?.onGpuToggle(enabled),
      onTransparentColorsChange: (colors) => this.controller?.onTransparentColorsChange(colors),
      onClear: () => this.controller?.clearImage(),
      onSaveToGallery: () => this.controller?.saveToGallery(),
      onDownload: () => this.controller?.downloadImage()
    };

    this.ui.setupUI(callbacks);

    // 初期タイトル設定（新規追加モード）
    this.controller.updateTitle();
  }

  destroy(): void {
    console.log("🧑‍🎨 : Destroying GalleryImageEditor...");

    if (this.controller) {
      // Controller 内の ImageInspector, ColorPalette は自動破棄される
      this.controller = null;
    }

    this.onSaveSuccess = undefined;

    console.log("🧑‍🎨 : GalleryImageEditor destroyed");
  }
}
