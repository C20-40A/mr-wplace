export enum OverlayMode {
  OFF = 'OFF',
  ON = 'ON', 
  TRANSPARENT = 'TRANSPARENT'
}

export class TileOverlayUI {
  private button: HTMLButtonElement | null = null;
  private imageButton: HTMLButtonElement | null = null;
  private modal: HTMLDialogElement | null = null;
  private mode = OverlayMode.ON;
  private onToggle: (mode: OverlayMode) => void;

  constructor(onToggle: (mode: OverlayMode) => void) {
    this.onToggle = onToggle;
    this.createButton();
    this.createImageButton();
    this.createModal();
  }

  private createButton(): void {
    this.button = document.createElement('button');
    this.button.className = 'btn btn-square shadow-md';
    this.button.style.position = 'fixed';
    this.button.style.top = '20px';
    this.button.style.left = '50%';
    this.button.style.transform = 'translateX(-50%)';
    this.button.style.zIndex = '9999';
    
    this.button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/>
        <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd"/>
      </svg>
    `;

    this.button.addEventListener('click', () => {
      this.cycleMode();
    });

    this.updateButtonState();
    document.body.appendChild(this.button);
  }

  private createImageButton(): void {
    this.imageButton = document.createElement('button');
    this.imageButton.className = 'btn btn-square shadow-md';
    this.imageButton.style.position = 'fixed';
    this.imageButton.style.top = '20px';
    this.imageButton.style.left = 'calc(50% + 60px)';
    this.imageButton.style.zIndex = '9999';
    this.imageButton.title = 'Image Overlay';
    
    this.imageButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
        <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd"/>
      </svg>
    `;

    this.imageButton.addEventListener('click', () => {
      this.modal?.showModal();
    });

    document.body.appendChild(this.imageButton);
  }

  private createModal(): void {
    this.modal = document.createElement('dialog');
    this.modal.className = 'modal';
    this.modal.innerHTML = `
      <div class="modal-box max-w-2xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="text-lg font-bold mb-4">画像アップロード</h3>
        
        <div id="wps-dropzone" class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 mx-auto mb-4 text-gray-400">
            <path fill-rule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clip-rule="evenodd"/>
          </svg>
          <p class="text-gray-600 mb-2">画像をドラッグ&ドロップまたはクリックして選択</p>
          <input type="file" id="wps-file-input" accept="image/*" class="hidden">
        </div>
        
        <div id="wps-image-display" class="text-center" style="display: none;">
          <img id="wps-preview-image" class="max-w-full max-h-80 rounded-lg shadow-md" alt="Preview">
        </div>
      </div>
      
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;
    
    document.body.appendChild(this.modal);
    this.setupImageUpload();
  }

  private setupImageUpload(): void {
    const dropzone = document.getElementById('wps-dropzone');
    const fileInput = document.getElementById('wps-file-input') as HTMLInputElement;
    const imageDisplay = document.getElementById('wps-image-display');
    const previewImage = document.getElementById('wps-preview-image') as HTMLImageElement;

    dropzone?.addEventListener('click', () => fileInput.click());
    
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#3b82f6';
      dropzone.style.backgroundColor = '#eff6ff';
    });
    
    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '#d1d5db';
      dropzone.style.backgroundColor = '';
    });
    
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#d1d5db';
      dropzone.style.backgroundColor = '';
      
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
  
  private handleFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageDisplay = document.getElementById('wps-image-display');
      const previewImage = document.getElementById('wps-preview-image') as HTMLImageElement;
      
      if (e.target?.result && imageDisplay && previewImage) {
        previewImage.src = e.target.result as string;
        imageDisplay.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  }

  private cycleMode(): void {
    switch (this.mode) {
      case OverlayMode.ON:
        this.mode = OverlayMode.TRANSPARENT;
        break;
      case OverlayMode.TRANSPARENT:
        this.mode = OverlayMode.OFF;
        break;
      case OverlayMode.OFF:
        this.mode = OverlayMode.ON;
        break;
    }
    this.updateButtonState();
    this.onToggle(this.mode);
  }

  private updateButtonState(): void {
    if (!this.button) return;

    switch (this.mode) {
      case OverlayMode.ON:
        this.button.classList.remove('opacity-50');
        this.button.title = 'Toggle Overlay (ON)';
        break;
      case OverlayMode.TRANSPARENT:
        this.button.classList.remove('opacity-50');
        this.button.style.opacity = '0.7';
        this.button.title = 'Toggle Overlay (TRANSPARENT)';
        break;
      case OverlayMode.OFF:
        this.button.classList.add('opacity-50');
        this.button.style.opacity = '';
        this.button.title = 'Toggle Overlay (OFF)';
        break;
    }
  }
}