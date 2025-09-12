export type ToastType = "success" | "error";

export class Toast {
  static show(message: string, type: ToastType = "success"): void {
    const toast = document.createElement("div");
    
    // 基本のコンテナスタイル（右上固定）
    const containerStyle = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 50;
      border-radius: 8px;
      padding: 12px 16px;
      background: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      border: 1px solid #e5e5e5;
      min-width: 250px;
      max-width: 400px;
    `;

    // タイプ別の左ボーダー色
    const borderColor = type === "success" ? "#10b981" : "#ef4444";
    const borderStyle = `border-left: 4px solid ${borderColor};`;

    toast.style.cssText = containerStyle + borderStyle;
    toast.innerHTML = `<span style="color: #374151; font-size: 14px;">${message}</span>`;

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  static success(message: string): void {
    this.show(message, "success");
  }

  static error(message: string): void {
    this.show(message, "error");
  }
}
