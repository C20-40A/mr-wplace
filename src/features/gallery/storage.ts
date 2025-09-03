export interface GalleryItem {
  key: string;
  timestamp: number;
  dataUrl: string;
  lat?: number;
  lng?: number;
}

export class GalleryStorage {
  async getAll(): Promise<GalleryItem[]> {
    return new Promise((resolve) => {
      (chrome as any).storage.local.get(
        null,
        (items: Record<string, string>) => {
          if (chrome.runtime.lastError) {
            console.error("Gallery storage error:", chrome.runtime.lastError);
            resolve([]);
            return;
          }

          const galleryItems: GalleryItem[] = [];

          for (const [key, value] of Object.entries(items)) {
            if (key.startsWith("gallery_")) {
              const timestamp = parseInt(key.replace("gallery_", ""));
              galleryItems.push({
                key,
                timestamp,
                dataUrl: value,
              });
            }
          }

          // 新しい順にソート
          galleryItems.sort((a, b) => b.timestamp - a.timestamp);
          resolve(galleryItems);
        }
      );
    });
  }

  async delete(key: string): Promise<void> {
    return new Promise((resolve) => {
      (chrome as any).storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          console.error("Gallery delete error:", chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }
}
