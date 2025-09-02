export class ImageEditorUI {
  private modal: HTMLDialogElement | null = null;

  constructor() {
    this.createModal();
  }

  showModal(): void {
    this.modal?.showModal();
  }

  private createModal(): void {
    this.modal = document.createElement('dialog');
    this.modal.className = 'modal';
    this.modal.innerHTML = `
      <div class="modal-box max-w-2xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="text-lg font-bold mb-4">画像エディタ</h3>
        
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
}
