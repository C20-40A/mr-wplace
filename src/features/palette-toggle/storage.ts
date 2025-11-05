import { storage } from "@/utils/browser-api";

export class PaletteToggleStorage {
  private static readonly STORAGE_KEY = "mr-wplace-palette-visible";

  static async get(): Promise<boolean> {
    const result = await storage.get([this.STORAGE_KEY]);
    // Default to visible (true)
    return result[this.STORAGE_KEY] ?? true;
  }

  static async set(visible: boolean): Promise<void> {
    await storage.set({ [this.STORAGE_KEY]: visible });
  }

  static async toggle(): Promise<boolean> {
    const current = await this.get();
    const newVisible = !current;
    await this.set(newVisible);
    return newVisible;
  }
}
