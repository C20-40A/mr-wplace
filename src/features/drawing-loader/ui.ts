import { t } from "../../i18n/manager";

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
    this.loaderElement = document.createElement('div');
    this.loaderElement.id = 'wplace-drawing-loader';
    this.loaderElement.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 30px;
      border-radius: 10px;
      font-size: 16px;
      z-index: 10000;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: none;
    `;

    // スピナー + テキスト
    this.loaderElement.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        "></div>
        <span id="wplace-loader-text">${t`${'drawing_image'}`}</span>
      </div>
    `;

    // スピナーアニメーション追加
    const style = document.createElement('style');
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
      const textElement = this.loaderElement.querySelector('#wplace-loader-text');
      if (textElement) {
        textElement.textContent = message;
      }
    }
    
    this.loaderElement.style.display = 'block';
  }

  hide(): void {
    if (!this.loaderElement) return;
    this.loaderElement.style.display = 'none';
  }

  destroy(): void {
    if (this.loaderElement) {
      this.loaderElement.remove();
      this.loaderElement = null;
    }
  }

  // 便利メソッド
  showDrawing(): void {
    this.show(t`${'drawing_image'}`);
  }

  showProcessing(): void {
    this.show(t`${'processing_image'}`);
  }

  showWaiting(): void {
    this.show(t`${'waiting_for_update'}`);
  }
}
