import { ThemeToggleStorage } from "@/features/theme-toggle/storage";

class DarkTheme {
  private button: HTMLButtonElement | null = null;
  private currentTheme: "custom-winter" | "dark" = "custom-winter";

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
    this.button.textContent =
      this.currentTheme === "custom-winter" ? "☀️" : "🌙";
    this.button.className = `
      btn btn-sm btn-circle
      top-2
    `;
    // NOTE: z-index: 1000;だとmodalの上に表示される
    this.button.style.cssText = `
      position: fixed;
      left: 50px;
      font-size: 18px;
      z-index: 800;
      width: 32px;
      height: 32px;
    `;

    this.button.addEventListener("click", () => this.toggleTheme());

    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Dark theme button created");
  }

  private async toggleTheme() {
    const newTheme =
      this.currentTheme === "custom-winter" ? "dark" : "custom-winter";
    this.currentTheme = newTheme;

    // Storage保存
    await ThemeToggleStorage.set(newTheme);

    // ボタン更新
    if (this.button) {
      this.button.textContent = newTheme === "custom-winter" ? "☀️" : "🌙";
    }

    // inject.jsに通知
    this.applyTheme(newTheme);

    console.log("🧑‍🎨 : Theme toggled to:", newTheme);
  }

  private applyTheme(theme: "custom-winter" | "dark") {
    // UIテーマの適用
    localStorage.setItem("theme", theme);

    // inject.jsに通知
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
