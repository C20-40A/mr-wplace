import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "palette-toggle-hidden";

export class PaletteToggleStorage {
  static async get(): Promise<boolean> {
    const result = await storage.get(STORAGE_KEY);
    return result[STORAGE_KEY] ?? false;
  }

  static async set(isHidden: boolean): Promise<void> {
    await storage.set({ [STORAGE_KEY]: isHidden });
  }
}
