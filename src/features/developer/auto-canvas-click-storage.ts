import { storage } from "@/utils/browser-api";

export class AutoCanvasClickStorage {
  private static readonly STORAGE_KEY = "mr-wplace-auto-canvas-click";

  static async get(): Promise<boolean> {
    const result = await storage.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] ?? false; // デフォルトOFF
  }

  static async set(enabled: boolean): Promise<void> {
    await storage.set({ [this.STORAGE_KEY]: enabled });
  }

  static async toggle(): Promise<boolean> {
    const current = await this.get();
    const newState = !current;
    await this.set(newState);
    return newState;
  }
}
