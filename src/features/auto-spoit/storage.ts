import { storage } from "@/utils/browser-api";
export class AutoSpoitStorage {
  private static readonly STORAGE_KEY = "mr-wplace-auto-spoit";
  private static readonly DEV_MODE_KEY = "mr-wplace-auto-spoit-dev-mode";
  private static readonly WARNING_SHOWN_KEY =
    "mr-wplace-auto-spoit-warning-shown";

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

  static async getDevMode(): Promise<boolean> {
    const result = await storage.get([this.DEV_MODE_KEY]);
    return result[this.DEV_MODE_KEY] ?? false; // デフォルトOFF
  }

  static async setDevMode(enabled: boolean): Promise<void> {
    await storage.set({ [this.DEV_MODE_KEY]: enabled });
  }

  static async toggleDevMode(): Promise<boolean> {
    const current = await this.getDevMode();
    const newState = !current;
    await this.setDevMode(newState);
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
