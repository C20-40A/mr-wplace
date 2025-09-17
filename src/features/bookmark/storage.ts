import { Bookmark } from "./types";

export class BookmarkStorage {
  private static readonly INDEX_KEY = "wplace_extended_bookmarks";

  private static async setValue(value: any): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.INDEX_KEY]: value }, () => {
        resolve();
      });
    });
  }

  private static async getValue(): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.INDEX_KEY], (result) => {
        resolve(result[this.INDEX_KEY]);
      });
    });
  }

  static async getBookmarks(): Promise<Bookmark[]> {
    const stored = await this.getValue();
    return JSON.parse(stored) ?? [];
  }

  static async addBookmark(bookmark: Bookmark): Promise<void> {
    const bookmarks = await this.getBookmarks();
    bookmarks.push(bookmark);
    await this.setValue(JSON.stringify(bookmarks));
  }

  static async removeBookmark(id: number): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const filtered = bookmarks.filter((fav) => fav.id !== id);
    await this.setValue(JSON.stringify(filtered));
  }
}
