import { availableColors, paidColors } from "../../../../constants/colors";

export class ImageProcessor {
  private container: HTMLElement;
  private originalImage: HTMLImageElement | null = null;
  private colorConvertedCanvas: HTMLCanvasElement | null = null; // 色変換後の中間状態
  private scaledCanvas: HTMLCanvasElement | null = null;
  private imageScale = 1.0; // 実際のサイズ変更
  private displayZoom = 1.0; // UI表示用ズーム
  private isColorConverted = false; // パレット変換済みフラグ
  private includePaidColors = true; // Paid色を含むかどうか
  private panX = 0; // ドラッグ移動X座標
  private panY = 0; // ドラッグ移動Y座標
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private downloadImage(): void {
    if (!this.scaledCanvas) return;

    this.scaledCanvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wplace-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  private saveToGallery(): void {
    if (!this.scaledCanvas) return;

    // PNG形式で可逆圧縮保存
    this.scaledCanvas.toBlob((blob) => {
      if (!blob) return;
      this.saveCanvasToGallery(blob);
    }, "image/png");
  }

  private saveCanvasToGallery(blob: Blob): void {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const key = `gallery_${Date.now()}`;

      (chrome as any).storage.local.set({ [key]: base64 }, () => {
        console.log("画像をギャラリーに保存しました");

        // ImageEditorモーダルを閉じる
        if ((window as any).wplaceStudio?.imageEditor) {
          (window as any).wplaceStudio.imageEditor.closeModal();
        }

        // ギャラリーモーダルを開く
        if ((window as any).wplaceStudio?.gallery) {
          (window as any).wplaceStudio.gallery.show();
        }
      });
    };
    reader.readAsDataURL(blob);
  }

  private init(): void {
    this.createUI();
    this.setupImageUpload();
    this.setupScaleControl();
  }

  private createUI(): void {
    this.container.innerHTML = `
      <div id="wps-image-area" class="border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4 min-h-80">
        <div id="wps-dropzone" class="flex items-center justify-center h-full text-center">
          <div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 mx-auto mb-4 text-gray-400">
              <path fill-rule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06L12.75 4.81V15a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25A1.5 1.5 0 005.25 21h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd"/>
            </svg>
            <p class="text-gray-600 mb-2">画像をドラッグ&ドロップまたはクリックして選択</p>
            <input type="file" id="wps-file-input" accept="image/*" class="hidden">
          </div>
        </div>
        
        <div id="wps-image-display" class="hidden relative">
          <button id="wps-clear-btn" class="btn btn-xs btn-circle btn-ghost absolute -top-2 -right-2 z-10 opacity-60 hover:opacity-100" title="画像をクリア">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3">
              <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd"/>
            </svg>
          </button>
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center">
              <h4 class="text-sm font-medium mb-2">元画像</h4>
              <img id="wps-original-image" class="border rounded shadow" style="max-width: 300px; max-height: 300px; object-fit: contain; image-rendering: pixelated; image-rendering: crisp-edges;" alt="Original">
            </div>
            <div class="text-center relative">
              <h4 class="text-sm font-medium mb-2">現在の画像
                <button id="wps-reset-btn" class="btn btn-xs btn-ghost ml-2 opacity-60 hover:opacity-100" title="編集リセット">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3">
                    <path fill-rule="evenodd" d="M4.755 10.059a7.5 7.5 0 0112.548-3.364l1.903 1.903h-3.183a.75.75 0 100 1.5h4.992a.75.75 0 00.75-.75V4.356a.75.75 0 00-1.5 0v3.18l-1.9-1.9A9 9 0 003.306 9.67a.75.75 0 101.45.388zm15.408 3.352a.75.75 0 00-.919.53 7.5 7.5 0 01-12.548 3.364l-1.902-1.903h3.183a.75.75 0 000-1.5H2.984a.75.75 0 00-.75.75v4.992a.75.75 0 001.5 0v-3.18l1.9 1.9a9 9 0 0015.059-4.035.75.75 0 00-.53-.918z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </h4>
              <div class="canvas-container" style="width: 300px; height: 300px; border: 1px solid #d1d5db; border-radius: 0.375rem; overflow: hidden; position: relative; margin: 0 auto; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
                <canvas id="wps-scaled-canvas" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></canvas>
                <div id="wps-zoom-indicator" class="absolute bottom-2 right-2 text-xs text-gray-500 bg-white bg-opacity-80 px-1 rounded pointer-events-none">
                  100%
                </div>
              </div>
              <p class="text-xs text-gray-500 mt-2">マウスホイールでズーム</p>
            </div>
          </div>
        </div>
      </div>
      
      <div id="wps-controls" class="hidden space-y-4">
        <div class="grid grid-cols-2 gap-4 mb-4">
          <div class="text-sm">
            <span class="font-medium">元サイズ:</span> <span id="wps-original-size">-</span>
          </div>
          <div class="text-sm">
            <span class="font-medium">現在サイズ:</span> <span id="wps-current-size">-</span>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">サイズ縮小: <span id="wps-scale-value">1.0</span>x</label>
          <input type="range" id="wps-scale-slider" min="0.1" max="1" step="0.05" value="1" class="w-full">
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.1x</span>
            <span>1.0x</span>
          </div>
        </div>
        <div>
          <label class="flex items-center space-x-2">
            <input type="checkbox" id="wps-paid-toggle" checked class="checkbox checkbox-xs">
            <span class="text-sm">Paid色を含む</span>
          </label>
        </div>
        
        <div id="wps-action-buttons" class="hidden flex gap-2 mt-4">
          <button id="wps-add-to-gallery" class="btn btn-primary flex-1">ギャラリーに追加</button>
          <button id="wps-download" class="btn btn-ghost">ダウンロード</button>
        </div>
      </div>
    `;
  }

  private setupImageUpload(): void {
    const dropzone = this.container.querySelector("#wps-dropzone");
    const fileInput = this.container.querySelector(
      "#wps-file-input"
    ) as HTMLInputElement;
    const imageArea = this.container.querySelector(
      "#wps-image-area"
    ) as HTMLElement;

    dropzone?.addEventListener("click", () => fileInput?.click());

    dropzone?.addEventListener("dragover", (e) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      if (imageArea) {
        imageArea.style.borderColor = "#3b82f6";
        imageArea.style.backgroundColor = "#eff6ff";
      }
    });

    dropzone?.addEventListener("dragleave", () => {
      if (imageArea) {
        imageArea.style.borderColor = "#d1d5db";
        imageArea.style.backgroundColor = "";
      }
    });

    dropzone?.addEventListener("drop", (e) => {
      const dragEvent = e as DragEvent;
      dragEvent.preventDefault();
      if (imageArea) {
        imageArea.style.borderColor = "#d1d5db";
        imageArea.style.backgroundColor = "";
      }

      const files = dragEvent.dataTransfer?.files;
      if (files && files[0]) {
        this.handleFile(files[0]);
      }
    });

    fileInput?.addEventListener("change", (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        this.handleFile(files[0]);
      }
    });
  }

  private setupScaleControl(): void {
    const slider = this.container.querySelector(
      "#wps-scale-slider"
    ) as HTMLInputElement;
    const valueDisplay = this.container.querySelector("#wps-scale-value");
    const canvas = this.container.querySelector(
      "#wps-scaled-canvas"
    ) as HTMLCanvasElement;
    const zoomIndicator = this.container.querySelector("#wps-zoom-indicator");
    const resetBtn = this.container.querySelector("#wps-reset-btn");
    const clearBtn = this.container.querySelector("#wps-clear-btn");
    const paidToggle = this.container.querySelector(
      "#wps-paid-toggle"
    ) as HTMLInputElement;
    const addToGalleryBtn = this.container.querySelector("#wps-add-to-gallery");
    const downloadBtn = this.container.querySelector("#wps-download");

    // サイズ縮小スライダー
    slider?.addEventListener("input", (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.imageScale = parseFloat(value);
      if (valueDisplay) {
        valueDisplay.textContent = value;
      }
      this.updateScaledImage();
    });

    // マウスホイールズーム（UI表示のみ）
    canvas?.addEventListener("wheel", (e) => {
      const wheelEvent = e as WheelEvent;
      wheelEvent.preventDefault();
      const delta = wheelEvent.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.5, Math.min(5.0, this.displayZoom + delta));

      this.displayZoom = newZoom;
      if (zoomIndicator) {
        zoomIndicator.textContent = Math.round(newZoom * 100) + "%";
      }
      this.updateCanvasDisplay();
    });

    // ドラッグ移動機能
    this.setupDragPan(canvas);

    // 編集リセットボタン
    resetBtn?.addEventListener("click", () => {
      this.imageScale = 1.0;
      this.displayZoom = 1.0;
      this.isColorConverted = false;
      this.panX = 0;
      this.panY = 0;

      if (slider) slider.value = "1";
      if (valueDisplay) valueDisplay.textContent = "1.0";
      if (zoomIndicator) zoomIndicator.textContent = "100%";

      this.updateScaledImage();
    });

    // 画像クリアボタン
    clearBtn?.addEventListener("click", () => {
      if (confirm("画像をクリアして初期状態に戻しますか？")) {
        this.clearImage();
      }
    });

    // Paid色トグル
    paidToggle?.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      this.includePaidColors = target.checked;
      if (this.isColorConverted) {
        // 色変換をやり直し
        setTimeout(() => {
          this.convertToPalette();
        }, 50);
      }
    });

    // ギャラリーに追加
    addToGalleryBtn?.addEventListener("click", () => {
      this.saveToGallery();
    });

    // ダウンロード
    downloadBtn?.addEventListener("click", () => {
      this.downloadImage();
    });
  }

  private handleFile(file: File): void {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        this.displayImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }

  private displayImage(imageSrc: string): void {
    const dropzone = this.container.querySelector("#wps-dropzone");
    const imageDisplay = this.container.querySelector("#wps-image-display");
    const controls = this.container.querySelector("#wps-controls");
    const originalImage = this.container.querySelector(
      "#wps-original-image"
    ) as HTMLImageElement;
    const zoomIndicator = this.container.querySelector("#wps-zoom-indicator");

    // 初期化
    this.displayZoom = 1.0;
    this.panX = 0;
    this.panY = 0;

    if (zoomIndicator) {
      zoomIndicator.textContent = "100%";
    }

    if (originalImage) {
      originalImage.src = imageSrc;
      this.originalImage = originalImage;

      originalImage.onload = () => {
        this.updateOriginalImageDisplay();
        // 色変換を非同期で自動実行
        setTimeout(() => {
          this.convertToPalette();
        }, 50);
      };
    }

    // UI状態変更
    dropzone?.classList.add("hidden");
    imageDisplay?.classList.remove("hidden");
    controls?.classList.remove("hidden");

    // アクションボタンを表示
    const actionButtons = this.container.querySelector("#wps-action-buttons");
    actionButtons?.classList.remove("hidden");
  }

  private updateOriginalImageDisplay(): void {
    const originalImage = this.container.querySelector(
      "#wps-original-image"
    ) as HTMLImageElement;
    if (!originalImage || !this.originalImage) return;

    const width = this.originalImage.naturalWidth;
    const height = this.originalImage.naturalHeight;
    const maxDisplaySize = 300;

    // 小さい画像は拡大表示
    if (width <= maxDisplaySize && height <= maxDisplaySize) {
      const scale = Math.min(maxDisplaySize / width, maxDisplaySize / height);
      originalImage.style.width = `${width * scale}px`;
      originalImage.style.height = `${height * scale}px`;
    } else {
      originalImage.style.width = "auto";
      originalImage.style.height = "auto";
    }
  }

  private updateScaledImage(): void {
    if (!this.originalImage) return;

    const canvas = this.container.querySelector(
      "#wps-scaled-canvas"
    ) as HTMLCanvasElement;
    const originalSizeDisplay =
      this.container.querySelector("#wps-original-size");
    const currentSizeDisplay =
      this.container.querySelector("#wps-current-size");
    const zoomIndicator = this.container.querySelector("#wps-zoom-indicator");
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const originalWidth = this.originalImage.naturalWidth;
    const originalHeight = this.originalImage.naturalHeight;
    const newWidth = Math.floor(originalWidth * this.imageScale);
    const newHeight = Math.floor(originalHeight * this.imageScale);

    // Canvasの実際のサイズ設定
    canvas.width = newWidth;
    canvas.height = newHeight;

    // ピクセル化を防ぐため
    ctx.imageSmoothingEnabled = false;

    // 色変換済みの場合はcolorConvertedCanvas、そうでなければoriginalImageを使用
    const sourceImage =
      this.isColorConverted && this.colorConvertedCanvas
        ? this.colorConvertedCanvas
        : this.originalImage;

    if (sourceImage instanceof HTMLCanvasElement) {
      ctx.drawImage(
        sourceImage,
        0,
        0,
        originalWidth,
        originalHeight,
        0,
        0,
        newWidth,
        newHeight
      );
    } else {
      ctx.drawImage(sourceImage, 0, 0, newWidth, newHeight);
    }

    // サイズ表示更新
    if (originalSizeDisplay) {
      originalSizeDisplay.textContent = `${originalWidth} x ${originalHeight}`;
    }
    if (currentSizeDisplay) {
      currentSizeDisplay.textContent = `${newWidth} x ${newHeight}`;
    }
    if (zoomIndicator) {
      zoomIndicator.textContent = Math.round(this.displayZoom * 100) + "%";
    }

    this.scaledCanvas = canvas;
    this.updateCanvasDisplay();
  }

  private updateCanvasDisplay(): void {
    const canvas = this.container.querySelector(
      "#wps-scaled-canvas"
    ) as HTMLCanvasElement;
    if (!canvas || !this.scaledCanvas) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const containerSize = 300; // 固定コンテナサイズ

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
    const finalDisplayScale = baseDisplayScale * this.displayZoom;

    const displayWidth = canvasWidth * finalDisplayScale;
    const displayHeight = canvasHeight * finalDisplayScale;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.style.imageRendering = "pixelated"; // ピクセル保持
    canvas.style.imageRendering = "crisp-edges"; // フォールバック

    // ドラッグ移動を適用（コンテナの中央からのオフセット）
    canvas.style.transform = `translate(calc(-50% + ${this.panX}px), calc(-50% + ${this.panY}px))`;

    // カーソル状態変更
    canvas.style.cursor = this.displayZoom > 1.0 ? "move" : "grab";
  }

  private setupDragPan(canvas: HTMLCanvasElement | null): void {
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (this.displayZoom <= 1.0) return; // ズーム時のみドラッグ可能

      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      canvas.style.cursor = "grabbing";
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

      this.updateCanvasDisplay();
    };

    const handleMouseUp = () => {
      if (!this.isDragging) return;

      this.isDragging = false;
      canvas.style.cursor = this.displayZoom > 1.0 ? "move" : "grab";
    };

    // イベントリスナー登録
    canvas.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // マウスがCanvas外に出た時の処理
    canvas.addEventListener("mouseleave", () => {
      if (this.isDragging) {
        this.isDragging = false;
        canvas.style.cursor = this.displayZoom > 1.0 ? "move" : "grab";
      }
    });
  }

  private clearImage(): void {
    // 初期状態にリセット
    this.originalImage = null;
    this.colorConvertedCanvas = null;
    this.scaledCanvas = null;
    this.imageScale = 1.0;
    this.displayZoom = 1.0;
    this.isColorConverted = false;
    this.includePaidColors = true;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;

    // UI状態をリセット
    const dropzone = this.container.querySelector("#wps-dropzone");
    const imageDisplay = this.container.querySelector("#wps-image-display");
    const controls = this.container.querySelector("#wps-controls");
    const slider = this.container.querySelector(
      "#wps-scale-slider"
    ) as HTMLInputElement;
    const valueDisplay = this.container.querySelector("#wps-scale-value");
    const paidToggle = this.container.querySelector(
      "#wps-paid-toggle"
    ) as HTMLInputElement;

    // スライダーリセット
    if (slider) slider.value = "1";
    if (valueDisplay) valueDisplay.textContent = "1.0";
    if (paidToggle) paidToggle.checked = true;

    // UI表示切り替え
    dropzone?.classList.remove("hidden");
    imageDisplay?.classList.add("hidden");
    controls?.classList.add("hidden");

    // アクションボタンを非表示
    const actionButtons = this.container.querySelector("#wps-action-buttons");
    actionButtons?.classList.add("hidden");
  }

  private convertToPalette(): void {
    if (!this.originalImage) return;

    // 元画像から色変換を実行
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;

    const width = this.originalImage.naturalWidth;
    const height = this.originalImage.naturalHeight;
    tempCanvas.width = width;
    tempCanvas.height = height;

    // ピクセル補間無効化
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(this.originalImage, 0, 0);

    const imageData = tempCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // RGB距離計算で最寄り色に変換
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const nearestColor = this.findNearestColor([r, g, b]);
      data[i] = nearestColor[0]; // R
      data[i + 1] = nearestColor[1]; // G
      data[i + 2] = nearestColor[2]; // B
      // Alpha値は変更しない
    }

    tempCtx.putImageData(imageData, 0, 0);
    this.colorConvertedCanvas = tempCanvas;
    this.isColorConverted = true;

    // スケール適用して表示更新
    this.updateScaledImage();
  }

  private findNearestColor(
    rgb: [number, number, number]
  ): [number, number, number] {
    let minDistance = Infinity;
    let nearestColor: [number, number, number] = [0, 0, 0];

    for (const color of Object.values(availableColors)) {
      // Paid色を除外するかチェック
      if (!this.includePaidColors) {
        const rgbKey = `${color[0]},${color[1]},${color[2]}`;
        if (paidColors.has(rgbKey)) {
          continue; // Paid色をスキップ
        }
      }

      const distance = Math.sqrt(
        Math.pow(rgb[0] - color[0], 2) +
          Math.pow(rgb[1] - color[1], 2) +
          Math.pow(rgb[2] - color[2], 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestColor = color as [number, number, number];
      }
    }

    return nearestColor;
  }
}
