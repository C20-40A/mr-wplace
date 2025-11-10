import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "data-saver-enabled";
const CACHE_SIZE_KEY = "data-saver-cache-size";
const DEFAULT_CACHE_SIZE = 100;

export class DataSaverStorage {
  static async get(): Promise<boolean> {
    const result = await storage.get(STORAGE_KEY);
    return result[STORAGE_KEY] ?? false;
  }

  static async set(enabled: boolean): Promise<void> {
    await storage.set({ [STORAGE_KEY]: enabled });
  }

  static async getMaxCacheSize(): Promise<number> {
    const result = await storage.get(CACHE_SIZE_KEY);
    return result[CACHE_SIZE_KEY] ?? DEFAULT_CACHE_SIZE;
  }

  static async setMaxCacheSize(size: number): Promise<void> {
    await storage.set({ [CACHE_SIZE_KEY]: size });
  }
}
