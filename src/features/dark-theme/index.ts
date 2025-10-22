import { ThemeToggleStorage } from "@/features/theme-toggle/storage";

class DarkTheme {
  private button: HTMLButtonElement | null = null;
  private currentTheme: "light" | "dark" = "light";

  async init() {
    // 現在のtheme読み込み
    this.currentTheme = await ThemeToggleStorage.get();

    // ボタン作成
    this.createButton();

    // 初期theme適用
    this.applyTheme(this.currentTheme);
  }

  private createButton() {
    this.button = document.createElement("button");
    this.button.textContent = this.currentTheme === "light" ? "☀️" : "🌙";
    this.button.style.cssText = `
      position: fixed;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      width: 40px;
      height: 40px;
      font-size: 20px;
      border: 2px solid #000;
      border-radius: 8px;
      background: #fff;
      cursor: pointer;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    `;

    this.button.addEventListener("click", () => this.toggleTheme());

    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Dark theme button created");
  }

  private async toggleTheme() {
    const newTheme = this.currentTheme === "light" ? "dark" : "light";
    this.currentTheme = newTheme;

    // Storage保存
    await ThemeToggleStorage.set(newTheme);

    // ボタン更新
    if (this.button) {
      this.button.textContent = newTheme === "light" ? "☀️" : "🌙";
    }

    // inject.jsに通知
    this.applyTheme(newTheme);

    console.log("🧑‍🎨 : Theme toggled to:", newTheme);
  }

  private applyTheme(theme: "light" | "dark") {
    window.postMessage(
      {
        source: "mr-wplace-theme-update",
        theme,
      },
      "*"
    );
  }
}

export const darkThemeAPI = {
  initDarkTheme: async () => {
    const instance = new DarkTheme();
    await instance.init();
  },
};
