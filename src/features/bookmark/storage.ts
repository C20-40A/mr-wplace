import { Bookmark } from "./types";

const STORAGE_KEYS = {
  bookmarks: "wplace_extended_bookmarks",
  location: "location",
};

export class BookmarkStorage {
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

  static async getFavorites(): Promise<Bookmark[]> {
    const stored = await this.getValue(STORAGE_KEYS.bookmarks, "[]");
    return JSON.parse(stored);
  }
}

export { STORAGE_KEYS };
