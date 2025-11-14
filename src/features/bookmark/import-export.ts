import { Bookmark } from "./types";
import { BookmarkStorage } from "./storage";
import { t } from "../../i18n/manager";

interface ExportResult {
  success: boolean;
  message: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  shouldRender?: boolean;
}

interface ImportData {
  version: string;
  exportDate: string;
  count: number;
  favorites: unknown[];
  source: string;
}

function validateImportData(data: unknown): data is ImportData {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== "string") return false;
  if (typeof obj.exportDate !== "string") return false;
  if (typeof obj.count !== "number") return false;
  if (!Array.isArray(obj.favorites)) return false;
  if (typeof obj.source !== "string") return false;

  return true;
}

function validateBookmark(item: unknown): item is Bookmark {
  if (!item || typeof item !== "object") return false;

  const obj = item as Record<string, unknown>;

  if (typeof obj.id !== "number") return false;
  if (typeof obj.name !== "string") return false;
  if (typeof obj.lat !== "number") return false;
  if (typeof obj.lng !== "number") return false;
  if (typeof obj.zoom !== "number") return false;
  if (typeof obj.date !== "string") return false;

  // 緯度経度範囲チェック
  if (obj.lat < -90 || obj.lat > 90) return false;
  if (obj.lng < -180 || obj.lng > 180) return false;

  return true;
}

export class ImportExportService {
  static async exportFavorites(): Promise<ExportResult> {
    const favorites = await BookmarkStorage.getBookmarks();

    if (favorites.length === 0) {
      return {
        success: false,
        message: t`${"no_export_bookmarks"}`,
      };
    }

    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      count: favorites.length,
      favorites: favorites,
      source: "mr-wplace",
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(dataBlob);
    link.download = `wplace-studio-favorites-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();

    return {
      success: true,
      message: `${favorites.length}${t`${"bookmarks_exported"}`}`,
    };
  }

  static async exportFavoritesByTags(tags: import("./types").Tag[]): Promise<ExportResult> {
    const allBookmarks = await BookmarkStorage.getBookmarks();

    const filteredBookmarks = allBookmarks.filter((bookmark) => {
      if (!bookmark.tag) return false;
      return tags.some(
        (tag) =>
          tag.color === bookmark.tag!.color &&
          (tag.name || "") === (bookmark.tag!.name || "")
      );
    });

    if (filteredBookmarks.length === 0) {
      return {
        success: false,
        message: t`${"no_export_bookmarks"}`,
      };
    }

    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      count: filteredBookmarks.length,
      favorites: filteredBookmarks,
      source: "mr-wplace",
      tags: tags,
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(dataBlob);
    const tagNames = tags.map((tag) => tag.name || "no-name").join("-");
    link.download = `wplace-studio-favorites-${tagNames}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();

    return {
      success: true,
      message: `${filteredBookmarks.length}${t`${"bookmarks_exported"}`}`,
    };
  }

  static importFavorites(): Promise<ImportResult> {
    return new Promise((resolve) => {
      const fileInput = document.getElementById(
        "wps-import-file"
      ) as HTMLInputElement;
      if (!fileInput) {
        resolve({ success: false, message: t`${"file_input_not_found"}` });
        return;
      }

      fileInput.click();

      fileInput.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) {
          resolve({
            success: false,
            message: t`${"no_file_selected"}`,
          });
          return;
        }

        const text = await file.text();
        let importData: ImportData;

        try {
          const parsedData = JSON.parse(text);
          if (!validateImportData(parsedData)) {
            throw new Error("invalid_file_format");
          }
          importData = parsedData;
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new Error("invalid_json_format");
          }
          throw e;
        }

        // favorites各要素のバリデーション
        const invalidItems = importData.favorites.filter(
          (item) => !validateBookmark(item)
        );
        if (invalidItems.length > 0) {
          throw new Error(`${invalidItems.length} invalid_bookmark_items`);
        }

        const validBookmarks = importData.favorites.filter(
          validateBookmark
        ) as Bookmark[];
        const currentBookmarks = await BookmarkStorage.getBookmarks();
        const importCount = validBookmarks.length;

        if (!confirm(`${importCount}${t`${"import_confirm"}`}`)) {
          resolve({
            success: false,
            message: t`${"import_cancelled"}`,
          });
          return;
        }

        const newBookmarks = validBookmarks.filter((importFav: Bookmark) => {
          return !currentBookmarks.some(
            (existing: Bookmark) =>
              Math.abs(existing.lat - importFav.lat) < 0.001 &&
              Math.abs(existing.lng - importFav.lng) < 0.001
          );
        });

        newBookmarks.forEach((fav: Bookmark, index: number) => {
          fav.id = Date.now() + index;
        });

        for (const bookmark of newBookmarks) {
          await BookmarkStorage.addBookmark(bookmark);
        }

        resolve({
          success: true,
          message: `${newBookmarks.length}${t`${"bookmarks_imported"}`}`,
          shouldRender: true,
        });
      };
    });
  }
}
