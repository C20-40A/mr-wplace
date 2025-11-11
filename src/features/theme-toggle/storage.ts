import { storage } from "@/utils/browser-api";

export class ThemeToggleStorage {
  private static readonly STORAGE_KEY = "mr-wplace-theme";

  static async get(): Promise<"custom-winter" | "dark"> {
    const result = await storage.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] || "custom-winter";
  }

  static async set(theme: "custom-winter" | "dark"): Promise<void> {
    await storage.set({ [this.STORAGE_KEY]: theme });
  }

  static async toggle(): Promise<"custom-winter" | "dark"> {
    const current = await this.get();
    const newTheme = current === "custom-winter" ? "dark" : "custom-winter";
    await this.set(newTheme);
    return newTheme;
  }
}
