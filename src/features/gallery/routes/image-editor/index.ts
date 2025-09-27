import { ImageEditorUI, ImageEditorCallbacks } from "./ui";
import { ImageProcessor } from "./editor";

export class GalleryImageEditor {
  private ui: ImageEditorUI;
  private processor: ImageProcessor | null = null;

  constructor() {
    this.ui = new ImageEditorUI();
  }

  render(container: HTMLElement): void {
    container.innerHTML = '';
    
    const uiContainer = this.ui.createAndGetContainer();
    container.appendChild(uiContainer);

    this.processor = new ImageProcessor(uiContainer);
    this.ui.setImageProcessor(this.processor);
    
    // コールバック設定
    const callbacks: ImageEditorCallbacks = {
      onFileHandle: (file) => this.processor?.handleFile(file),
      onScaleChange: (scale) => this.processor?.onScaleChange(scale),
      onBrightnessChange: (value) => this.processor?.onBrightnessChange(value),
      onContrastChange: (value) => this.processor?.onContrastChange(value),
      onSaturationChange: (value) => this.processor?.onSaturationChange(value),
      onClear: () => this.processor?.clearImage(),
      onSaveToGallery: () => this.processor?.saveToGallery(),
      onDownload: () => this.processor?.downloadImage()
    };
    
    this.ui.setupUI(callbacks);
  }
}
