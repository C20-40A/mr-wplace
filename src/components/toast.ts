export type ToastType = 'success' | 'error';

export class Toast {
  static show(message: string, type: ToastType = 'success'): void {
    const toast = document.createElement("div");
    toast.className = "toast toast-top toast-end z-50";
    
    const alertClass = type === 'success' ? 'alert-success' : 'alert-error';
    toast.innerHTML = `
      <div class="alert ${alertClass}">
        <span>${message}</span>
      </div>
    `;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  static success(message: string): void {
    this.show(message, 'success');
  }

  static error(message: string): void {
    this.show(message, 'error');
  }
}
