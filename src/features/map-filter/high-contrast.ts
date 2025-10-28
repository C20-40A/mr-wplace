import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mapFilter_highContrast";
const STYLE_ID = "mr-wplace-high-contrast-style";

class HighContrast {
  private button: HTMLButtonElement | null = null;
  private enabled = false;

  async init() {
    // 現在の状態読み込み
    const stored = await storage.get(STORAGE_KEY);
    this.enabled = stored[STORAGE_KEY] ?? false;

    // ボタン作成
    this.createButton();

    // 初期スタイル適用
    if (this.enabled) {
      this.applyStyle();
    }
  }

  private createButton() {
    this.button = document.createElement("button");
    this.button.textContent = this.enabled ? "🔆" : "⚪";
    this.button.className = "btn btn-sm btn-circle";
    // NOTE: z-index: 1000;だとmodalの上に表示される
    this.button.style.cssText = `
      position: fixed;
      left: 50px;
      top: 44px;
      font-size: 18px;
      z-index: 800;
      width: 32px;
      height: 32px;
    `;

    this.button.addEventListener("click", () => this.toggle());

    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : High contrast button created");
  }

  private async toggle() {
    this.enabled = !this.enabled;

    // Storage保存
    await storage.set({ [STORAGE_KEY]: this.enabled });

    // ボタン更新
    if (this.button) {
      this.button.textContent = this.enabled ? "🔆" : "⚪";
    }

    // スタイル適用/解除
    if (this.enabled) {
      this.applyStyle();
    } else {
      this.removeStyle();
    }

    console.log("🧑‍🎨 : High contrast toggled to:", this.enabled);
  }

  private applyStyle() {
    // 既存のstyleがあれば削除
    this.removeStyle();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.innerHTML = `
      .maplibregl-canvas-container canvas,
      [id^="color-"] {
        filter: brightness(0.8) contrast(2) !important;
      }
    `;
    document.head.appendChild(style);
  }

  private removeStyle() {
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }
  }
}

export const highContrastAPI = {
  initHighContrast: async () => {
    const instance = new HighContrast();
    await instance.init();
  },
};
