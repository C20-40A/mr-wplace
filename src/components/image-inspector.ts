import { t } from "../i18n/manager";

interface ImageInspectorOptions {
  minZoom?: number; // デフォルト0.1
  maxZoom?: number; // デフォルト1.0
  containerSize?: number; // コンテナサイズ（デフォルト300px）
  onViewportChange?: (zoom: number, panX: number, panY: number) => void;
}

/**
 * 画像キャンバスの詳細表示・ズーム・パン機能を提供するコンポーネント
 * 画像を細かくチェックするための機能群
 */
export class ImageInspector {
  private canvas: HTMLCanvasElement;
  private options: Required<ImageInspectorOptions>;
  private zoom: number = 1.0;
  private panX: number = 0;
  private panY: number = 0;
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private zoomIndicator?: HTMLElement;
  private resetButton?: HTMLElement;
  private containerElement?: HTMLElement;
  private controlsContainer?: HTMLElement;

  constructor(canvas: HTMLCanvasElement, options: ImageInspectorOptions = {}) {
    this.canvas = canvas;
    this.options = {
      minZoom: options.minZoom ?? 1.0, // 縮小禁止、拡大のみ
      maxZoom: options.maxZoom ?? 5.0, // 最大5倍まで拡大
      containerSize: options.containerSize ?? 300, // デフォルト300px
      onViewportChange: options.onViewportChange ?? (() => {}),
    };

    this.init();
  }

  private init(): void {
    this.setupZoomControls();
    this.setupWheelZoom();
    this.setupDragPan();
    this.updateDisplay();
  }

  private setupZoomControls(): void {
    // canvas の親要素を取得
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.containerElement = parent;

    // コントロールボタンをまとめるコンテナを作成し、flexboxで横並びに配置
    this.controlsContainer = document.createElement("div");
    const controlsContainer = this.controlsContainer;
    controlsContainer.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
    this.containerElement.appendChild(controlsContainer);

    // ボタンとインジケーターに共通のスタイルを定義
    const commonStyle = `
    background-color: rgba(255, 255, 255, 0.8);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    color: #4b5563;
  `;

    // リセットボタン作成
    this.resetButton = document.createElement("button");
    this.resetButton.style.cssText = `${commonStyle} cursor: pointer;`; // 個別のスタイルを追加
    this.resetButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3" style="width: 12px; height: 12px;">
      <path fill-rule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273z" clip-rule="evenodd"/>
    </svg>
  `;
    this.resetButton.title = t`${"reset_viewport"}`;
    this.resetButton.style.display = "none"; // 初期は非表示
    this.resetButton.addEventListener("click", () => this.resetViewport());
    controlsContainer.appendChild(this.resetButton);

    // ズームインジケーター作成
    this.zoomIndicator = document.createElement("div");
    this.zoomIndicator.style.cssText = `${commonStyle} pointer-events: none; padding: 4px 10px;`; // 個別のスタイルを追加
    this.zoomIndicator.style.display = "none"; // 初期は非表示
    controlsContainer.appendChild(this.zoomIndicator);
  }

  private setupWheelZoom(): void {
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(
        this.options.minZoom,
        Math.min(this.options.maxZoom, this.zoom + delta)
      );

      if (newZoom !== this.zoom) {
        // ズームが1.0に戻ったらパンもリセット
        if (newZoom === 1.0) {
          this.panX = 0;
          this.panY = 0;
        }
        this.zoom = newZoom;
        this.updateDisplay();
        this.options.onViewportChange(this.zoom, this.panX, this.panY);
      }
    });
  }

  private setupDragPan(): void {
    const handleMouseDown = (e: MouseEvent) => {
      if (this.zoom <= 1.0) return; // ズーム時のみドラッグ可能

      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = "grabbing";
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return;

      const deltaX = e.clientX - this.lastMouseX;
      const deltaY = e.clientY - this.lastMouseY;

      this.panX += deltaX;
      this.panY += deltaY;

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      this.updateDisplay();
      this.options.onViewportChange(this.zoom, this.panX, this.panY);
    };

    const handleMouseUp = () => {
      if (!this.isDragging) return;

      this.isDragging = false;
      this.canvas.style.cursor = this.zoom > 1.0 ? "move" : "grab";
    };

    // イベントリスナー登録
    this.canvas.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // マウスがcanvas外に出た時の処理
    this.canvas.addEventListener("mouseleave", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.canvas.style.cursor = this.zoom > 1.0 ? "move" : "grab";
      }
    });
  }

  private updateDisplay(): void {
    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;
    const containerSize = this.options.containerSize; // 動的コンテナサイズ

    // 基本表示サイズを計算（コンテナに収まるサイズ）
    let baseDisplayScale: number;
    if (canvasWidth <= containerSize && canvasHeight <= containerSize) {
      // 小さい画像はコンテナいっぱいに拡大
      baseDisplayScale = Math.min(
        containerSize / canvasWidth,
        containerSize / canvasHeight
      );
    } else {
      // 大きい画像はコンテナに収まるように縮小
      baseDisplayScale = Math.min(
        containerSize / canvasWidth,
        containerSize / canvasHeight
      );
    }

    // ズームを適用
    const finalDisplayScale = baseDisplayScale * this.zoom;
    const displayWidth = canvasWidth * finalDisplayScale;
    const displayHeight = canvasHeight * finalDisplayScale;

    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;
    this.canvas.style.imageRendering = "pixelated";
    this.canvas.style.imageRendering = "crisp-edges";
    this.canvas.style.transform = `translate(calc(-50% + ${this.panX}px), calc(-50% + ${this.panY}px))`;
    this.canvas.style.cursor = this.zoom > 1.0 ? "move" : "grab";

    // ズームインジケーターとリセットボタンの表示制御（100%以外のときのみ）
    const shouldShow = this.zoom !== 1.0;
    if (this.zoomIndicator) {
      this.zoomIndicator.style.display = shouldShow ? "block" : "none";
      this.zoomIndicator.textContent = `${Math.round(this.zoom * 100)}%`;
    }
    if (this.resetButton) {
      this.resetButton.style.display = shouldShow ? "block" : "none";
    }
  }

  /**
   * ズームとパンをリセット（100%, 中央位置）
   */
  resetViewport(): void {
    this.zoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.updateDisplay();
    this.options.onViewportChange(this.zoom, this.panX, this.panY);
  }

  /**
   * 現在のズーム値を取得
   */
  getCurrentZoom(): number {
    return this.zoom;
  }

  /**
   * リソース解放
   */
  destroy(): void {
    // DOM要素を削除
    if (this.controlsContainer && this.containerElement && this.containerElement.contains(this.controlsContainer)) {
      this.containerElement.removeChild(this.controlsContainer);
    }

    // イベントリスナーは自動的に削除される（要素削除時）
    this.zoomIndicator = undefined;
    this.resetButton = undefined;
    this.containerElement = undefined;
    this.controlsContainer = undefined;
  }
}
