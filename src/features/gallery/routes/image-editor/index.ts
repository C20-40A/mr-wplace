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
      onScaleChange: (scale) => this.controller?.onScaleChange(scale),
      onBrightnessChange: (value) => this.controller?.onBrightnessChange(value),
      onContrastChange: (value) => this.controller?.onContrastChange(value),
      onSaturationChange: (value) => this.controller?.onSaturationChange(value),
      onClear: () => this.controller?.clearImage(),
      onSaveToGallery: () => this.controller?.saveToGallery(),
      onDownload: () => this.controller?.downloadImage()
    };
    
    this.ui.setupUI(callbacks);
  }
}
