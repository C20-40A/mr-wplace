import { t } from "@/i18n/manager";

/**
 * 画像描画ローディング表示UI
 * 課題: inject.jsでfetchのタイミングでしか画像が更新されないため、
 * 描画開始から次のfetch完了まで表示するローディング画面
 */
export class DrawingLoaderUI {
  private loaderElement: HTMLElement | null = null;

  constructor() {
    this.createLoaderElement();
  }

  private createLoaderElement(): void {
    // ローディング要素作成
    this.loaderElement = document.createElement("div");
    this.loaderElement.id = "wplace-drawing-loader";
    this.loaderElement.style.cssText = `
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      display: none;
      backdrop-filter: blur(4px);
    `;

    // スピナー + テキスト
    this.loaderElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          animation: spin 1s linear infinite;
        "></div>
        <span id="wplace-loader-text">${t`${"drawing_image"}`}</span>
      </div>
    `;

    // スピナーアニメーション追加
    const style = document.createElement("style");
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // DOM追加
    document.body.appendChild(this.loaderElement);
  }

  show(message?: string): void {
    if (!this.loaderElement) return;

    if (message) {
      const textElement = this.loaderElement.querySelector(
        "#wplace-loader-text"
      );
      if (textElement) {
        textElement.textContent = message;
      }
    }

    this.loaderElement.style.display = "block";
  }

  hide(): void {
    if (!this.loaderElement) return;
    this.loaderElement.style.display = "none";
  }

  destroy(): void {
    if (this.loaderElement) {
      this.loaderElement.remove();
      this.loaderElement = null;
    }
  }

  // 便利メソッド
  showDrawing(): void {
    this.show(t`${"drawing_image"}`);
  }

  showProcessing(): void {
    this.show(t`${"processing_image"}`);
  }

  showWaiting(): void {
    this.show(t`${"waiting_for_update"}`);
  }
}
