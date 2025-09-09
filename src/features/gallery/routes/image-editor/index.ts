import { ImageEditorUI } from "./ui";
import { ImageProcessor } from "./editor";

export class GalleryImageEditor {
  private ui: ImageEditorUI;
  private processor: ImageProcessor | null = null;

  constructor() {
    this.ui = new ImageEditorUI();
  }

  render(container: HTMLElement): void {
    // コンテナをクリア
    container.innerHTML = '';
    
    // UIコンテナを作成して追加
    const uiContainer = this.ui.createAndGetContainer();
    container.appendChild(uiContainer);

    // プロセッサーを初期化（空の状態）
    this.processor = new ImageProcessor(uiContainer);
  }
}
