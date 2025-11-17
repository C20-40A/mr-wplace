import { storage } from "@/utils/browser-api";

export class AutoCanvasClickStorage {
  private static readonly STORAGE_KEY = "mr-wplace-auto-canvas-click";
  private static readonly WARNING_SHOWN_KEY =
    "mr-wplace-auto-canvas-click-warning-shown";

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

  static async hasShownWarning(): Promise<boolean> {
    const result = await storage.get([this.WARNING_SHOWN_KEY]);
    return result[this.WARNING_SHOWN_KEY] ?? false;
  }

  static async setWarningShown(): Promise<void> {
    await storage.set({ [this.WARNING_SHOWN_KEY]: true });
  }
}
