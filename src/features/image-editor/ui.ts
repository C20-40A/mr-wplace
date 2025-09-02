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
      <div class="modal-box max-w-4xl">
        <form method="dialog">
          <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
        </form>
        
        <h3 class="text-lg font-bold mb-4">画像エディタ</h3>
        
        <div id="wps-image-editor-container">
          <!-- 画像編集機能がここに挿入されます -->
        </div>
      </div>
      
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    `;
    
    document.body.appendChild(this.modal);
  }

  getContainer(): HTMLElement | null {
    return document.getElementById('wps-image-editor-container');
  }
}
