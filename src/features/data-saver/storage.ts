import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "data-saver-enabled";

export class DataSaverStorage {
  static async get(): Promise<boolean> {
    const result = await storage.get(STORAGE_KEY);
    return result[STORAGE_KEY] ?? false;
  }

  static async set(enabled: boolean): Promise<void> {
    await storage.set({ [STORAGE_KEY]: enabled });
  }
}
