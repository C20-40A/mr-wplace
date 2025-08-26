import { Favorite } from './types';

const STORAGE_KEYS = {
  favorites: "wplace_extended_favorites",
  location: "location",
};

export class FavoriteStorage {
  static async setValue(key: string, value: any): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, () => {
        resolve();
      });
    });
  }

  static async getValue(key: string, defaultValue: any = null): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  }

  static async getFavorites(): Promise<Favorite[]> {
    try {
      const stored = await this.getValue(STORAGE_KEYS.favorites, "[]");
      return JSON.parse(stored);
    } catch (error) {
      console.error("WPlace Studio: お気に入り取得エラー:", error);
      return [];
    }
  }
}

export { STORAGE_KEYS };
