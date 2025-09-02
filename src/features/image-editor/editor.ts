export class ImageProcessor {
  private container: HTMLElement;
  private originalImage: HTMLImageElement | null = null;
  private scaledCanvas: HTMLCanvasElement | null = null;
  private currentScale = 1.0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
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
              <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd"/>
            </svg>
            <p class="text-gray-600 mb-2">画像をドラッグ&ドロップまたはクリックして選択</p>
            <input type="file" id="wps-file-input" accept="image/*" class="hidden">
          </div>
        </div>
        
        <div id="wps-image-display" class="hidden">
          <div class="grid grid-cols-2 gap-4">
            <div class="text-center">
              <h4 class="text-sm font-medium mb-2">元画像</h4>
              <img id="wps-original-image" class="max-w-full max-h-60 rounded shadow" alt="Original">
            </div>
            <div class="text-center">
              <h4 class="text-sm font-medium mb-2">スケール後</h4>
              <canvas id="wps-scaled-canvas" class="max-w-full max-h-60 rounded shadow border"></canvas>
            </div>
          </div>
        </div>
      </div>
      
      <div id="wps-controls" class="hidden space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">スケール: <span id="wps-scale-value">1.0</span>x</label>
          <input type="range" id="wps-scale-slider" min="0.1" max="5" step="0.1" value="1" class="w-full">
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.1x</span>
            <span>5.0x</span>
          </div>
        </div>
      </div>
    `;
  }

  private setupImageUpload(): void {
    const dropzone = this.container.querySelector('#wps-dropzone');
    const fileInput = this.container.querySelector('#wps-file-input') as HTMLInputElement;
    const imageArea = this.container.querySelector('#wps-image-area') as HTMLElement;

    dropzone?.addEventListener('click', () => fileInput?.click());
    
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (imageArea) {
        imageArea.style.borderColor = '#3b82f6';
        imageArea.style.backgroundColor = '#eff6ff';
      }
    });
    
    dropzone?.addEventListener('dragleave', () => {
      if (imageArea) {
        imageArea.style.borderColor = '#d1d5db';
        imageArea.style.backgroundColor = '';
      }
    });
    
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      if (imageArea) {
        imageArea.style.borderColor = '#d1d5db';
        imageArea.style.backgroundColor = '';
      }
      
      const files = e.dataTransfer?.files;
      if (files && files[0]) {
        this.handleFile(files[0]);
      }
    });
    
    fileInput?.addEventListener('change', (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files[0]) {
        this.handleFile(files[0]);
      }
    });
  }

  private setupScaleControl(): void {
    const slider = this.container.querySelector('#wps-scale-slider') as HTMLInputElement;
    const valueDisplay = this.container.querySelector('#wps-scale-value');
    
    slider?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.currentScale = parseFloat(value);
      if (valueDisplay) {
        valueDisplay.textContent = value;
      }
      this.updateScaledImage();
    });
  }

  private handleFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        this.displayImage(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }
  
  private displayImage(imageSrc: string): void {
    const dropzone = this.container.querySelector('#wps-dropzone');
    const imageDisplay = this.container.querySelector('#wps-image-display');
    const controls = this.container.querySelector('#wps-controls');
    const originalImage = this.container.querySelector('#wps-original-image') as HTMLImageElement;
    
    if (originalImage) {
      originalImage.src = imageSrc;
      this.originalImage = originalImage;
      
      originalImage.onload = () => {
        this.updateScaledImage();
      };
    }
    
    // UI状態変更
    dropzone?.classList.add('hidden');
    imageDisplay?.classList.remove('hidden');
    controls?.classList.remove('hidden');
  }

  private updateScaledImage(): void {
    if (!this.originalImage) return;
    
    const canvas = this.container.querySelector('#wps-scaled-canvas') as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    const newWidth = Math.floor(this.originalImage.naturalWidth * this.currentScale);
    const newHeight = Math.floor(this.originalImage.naturalHeight * this.currentScale);
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // ピクセル化を防ぐため
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.originalImage, 0, 0, newWidth, newHeight);
    
    this.scaledCanvas = canvas;
  }
}
