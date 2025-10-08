export class AutoSpoitStorage {
  private static readonly STORAGE_KEY = "mr-wplace-auto-spoit";

  static async get(): Promise<boolean> {
    const result = await chrome.storage.local.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] ?? true; // デフォルトON
  }

  static async set(enabled: boolean): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: enabled });
  }

  static async toggle(): Promise<boolean> {
    const current = await this.get();
    const newState = !current;
    await this.set(newState);
    return newState;
  }
}
