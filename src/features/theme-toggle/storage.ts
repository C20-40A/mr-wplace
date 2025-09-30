export class ThemeToggleStorage {
  private static readonly STORAGE_KEY = "mr-wplace-theme";

  static async get(): Promise<"light" | "dark"> {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] || "light";
  }

  static async set(theme: "light" | "dark"): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: theme });
  }

  static async toggle(): Promise<"light" | "dark"> {
    const current = await this.get();
    const newTheme = current === "light" ? "dark" : "light";
    await this.set(newTheme);
    return newTheme;
  }
}
