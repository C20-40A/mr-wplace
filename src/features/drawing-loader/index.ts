import { DrawingLoaderUI } from "./ui";

/**
 * 画像描画ローディングマネージャー
 * 役割: 描画開始〜fetch完了までの状態管理
 */
export class DrawingLoader {
  private ui: DrawingLoaderUI;
  private isLoading = false;
  private loadingStartTime: number = 0;

  constructor() {
    this.ui = new DrawingLoaderUI();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 描画開始監視
    window.addEventListener("message", (event) => {
      if (event.data.source === "wplace-studio-drawing-start") {
        this.startLoading();
      }

      // fetch完了監視 (inject.js → content.ts)
      if (event.data.source === "mr-wplace-processed") {
        this.finishLoading();
      }
    });
  }

  startLoading(): void {
    if (this.isLoading) return;

    this.isLoading = true;
    this.loadingStartTime = Date.now();
    this.ui.showDrawing();
    console.log("🎨 Drawing loader started");
  }

  finishLoading(): void {
    if (!this.isLoading) return;

    const duration = Date.now() - this.loadingStartTime;
    console.log(`🎨 Drawing loader finished (${duration}ms)`);

    this.isLoading = false;
    this.ui.hide();
  }

  // 手動制御用
  show(message?: string): void {
    this.ui.show(message);
  }

  hide(): void {
    this.ui.hide();
  }

  destroy(): void {
    this.ui.destroy();
  }
}
