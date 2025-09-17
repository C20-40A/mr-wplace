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

export class ImportExportService {
  static async exportFavorites(): Promise<ExportResult> {
    try {
      const favorites = await BookmarkStorage.getBookmarks();

      if (favorites.length === 0) {
        return {
          success: false,
          message: t`${'no_export_bookmarks'}`,
        };
      }

      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        count: favorites.length,
        favorites: favorites,
        source: "WPlace Studio Chrome Extension",
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
        message: `${favorites.length}${t`${'bookmarks_exported'}`}`,
      };
    } catch (error) {
      console.error("WPlace Studio: エクスポートエラー:", error);
      return { success: false, message: t`${'export_failed'}` };
    }
  }

  static importFavorites(): Promise<ImportResult> {
    return new Promise((resolve) => {
      const fileInput = document.getElementById(
        "wps-import-file"
      ) as HTMLInputElement;
      if (!fileInput) {
        resolve({ success: false, message: t`${'file_input_not_found'}` });
        return;
      }

      fileInput.click();

      fileInput.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) {
          resolve({
            success: false,
            message: t`${'no_file_selected'}`,
          });
          return;
        }

        try {
          const text = await file.text();
          const importData = JSON.parse(text);

          if (!importData.favorites || !Array.isArray(importData.favorites)) {
            throw new Error(t`${'invalid_file_format'}`);
          }

          const currentBookmarks = await BookmarkStorage.getBookmarks();
          const importCount = importData.favorites.length;

          if (
            !confirm(
              `${importCount}${t`${'import_confirm'}`}`
            )
          ) {
            resolve({
              success: false,
              message: t`${'import_cancelled'}`,
            });
            return;
          }

          const newBookmarks = importData.favorites.filter(
            (importFav: Bookmark) => {
              return !currentBookmarks.some(
                (existing: Bookmark) =>
                  Math.abs(existing.lat - importFav.lat) < 0.001 &&
                  Math.abs(existing.lng - importFav.lng) < 0.001
              );
            }
          );

          newBookmarks.forEach((fav: Bookmark, index: number) => {
            fav.id = Date.now() + index;
          });

          await BookmarkStorage.addBookmark(newBookmarks);

          resolve({
            success: true,
            message: `${newBookmarks.length}${t`${'bookmarks_imported'}`}`,
            shouldRender: true,
          });
        } catch (error) {
          console.error("WPlace Studio: インポートエラー:", error);
          resolve({
            success: false,
            message:
              t`${'import_failed_prefix'}` +
              (error instanceof Error ? error.message : String(error)),
          });
        }

        target.value = "";
      };
    });
  }
}
