import { Favorite } from "./types";
import { FavoriteStorage, STORAGE_KEYS } from "./storage";

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
      const favorites = await FavoriteStorage.getFavorites();

      if (favorites.length === 0) {
        return {
          success: false,
          message: "エクスポートするお気に入りがありません",
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
        message: `${favorites.length}件のお気に入りをエクスポートしました`,
      };
    } catch (error) {
      console.error("WPlace Studio: エクスポートエラー:", error);
      return { success: false, message: "エクスポートに失敗しました" };
    }
  }

  static importFavorites(): Promise<ImportResult> {
    return new Promise((resolve) => {
      const fileInput = document.getElementById(
        "wps-import-file"
      ) as HTMLInputElement;
      if (!fileInput) {
        resolve({ success: false, message: "ファイル入力が見つかりません" });
        return;
      }

      fileInput.click();

      fileInput.onchange = async (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) {
          resolve({
            success: false,
            message: "ファイルが選択されませんでした",
          });
          return;
        }

        try {
          const text = await file.text();
          const importData = JSON.parse(text);

          if (!importData.favorites || !Array.isArray(importData.favorites)) {
            throw new Error("無効なファイル形式です");
          }

          const currentFavorites = await FavoriteStorage.getFavorites();
          const importCount = importData.favorites.length;

          if (
            !confirm(
              `${importCount}件のお気に入りをインポートしますか？\n既存のデータは保持されます。`
            )
          ) {
            resolve({
              success: false,
              message: "インポートがキャンセルされました",
            });
            return;
          }

          const newFavorites = importData.favorites.filter(
            (importFav: Favorite) => {
              return !currentFavorites.some(
                (existing: Favorite) =>
                  Math.abs(existing.lat - importFav.lat) < 0.001 &&
                  Math.abs(existing.lng - importFav.lng) < 0.001
              );
            }
          );

          newFavorites.forEach((fav: Favorite, index: number) => {
            fav.id = Date.now() + index;
          });

          const mergedFavorites = [...currentFavorites, ...newFavorites];
          await FavoriteStorage.setValue(
            STORAGE_KEYS.favorites,
            JSON.stringify(mergedFavorites)
          );

          resolve({
            success: true,
            message: `${newFavorites.length}件のお気に入りをインポートしました`,
            shouldRender: true,
          });
        } catch (error) {
          console.error("WPlace Studio: インポートエラー:", error);
          resolve({
            success: false,
            message:
              "インポートに失敗しました: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

        target.value = "";
      };
    });
  }
}
