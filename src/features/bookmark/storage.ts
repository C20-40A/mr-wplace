import { Bookmark, Tag } from "./types";
import { storage } from "@/utils/browser-api";

export class BookmarkStorage {
  private static readonly INDEX_KEY = "wplace_extended_bookmarks";

  private static async setValue(value: any): Promise<void> {
    await storage.set({ [this.INDEX_KEY]: value });
  }

  private static async getValue(): Promise<any> {
    const result = await storage.get([this.INDEX_KEY]);
    return result[this.INDEX_KEY];
  }

  static async getBookmarks(): Promise<Bookmark[]> {
    const stored = await this.getValue();
    return stored ? JSON.parse(stored) : [];
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

  static async updateBookmark(bookmark: Bookmark): Promise<void> {
    const bookmarks = await this.getBookmarks();
    const index = bookmarks.findIndex((b) => b.id === bookmark.id);
    if (index !== -1) {
      bookmarks[index] = bookmark;
      await this.setValue(JSON.stringify(bookmarks));
    }
  }

  static async getExistingTags(): Promise<Tag[]> {
    const bookmarks = await this.getBookmarks();
    const tagMap = new Map<string, Tag>();

    for (const bookmark of bookmarks) {
      if (bookmark.tag) {
        const key = `${bookmark.tag.color}-${bookmark.tag.name || ""}`;
        if (!tagMap.has(key)) {
          tagMap.set(key, bookmark.tag);
        }
      }
    }

    const tags = Array.from(tagMap.values());
    // 名前順ソート
    tags.sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    return tags;
  }
}
