import { storage } from "@/utils/browser-api";

export interface BaseImageItem {
  key: string;
  timestamp: number;
  dataUrl: string;
  thumbnail?: string; // 200x200px thumbnail for UI performance
}

interface ImageIndex<T> {
  items: Array<Pick<T, "key" | "timestamp">>;
  lastUpdated: number;
}

export class ImageStorage<T extends BaseImageItem> {
  private indexKey: string;

  constructor(private prefix: string) {
    this.indexKey = `${prefix}_index`;
  }

  async get(key: string): Promise<T | undefined> {
    const dataResult = await storage.get([key]);
    const data = dataResult[key];

    if (!data) return undefined;

    let item: T;

    // 新形式（完全オブジェクト）で保存されている場合
    if (typeof data === "object" && data.key) {
      item = data as T;
    } else {
      // 旧形式（dataUrlのみ）で保存されている場合
      const timestamp = parseInt(key.replace(`${this.prefix}_`, ""));
      item = {
        key,
        timestamp,
        dataUrl: data || "",
      } as T;
    }

    // サムネイルがない場合は生成
    if (!item.thumbnail && item.dataUrl) {
      const thumbnail = await this.generateThumbnail(item.dataUrl);
      if (thumbnail) {
        item = { ...item, thumbnail };
        // サムネイルを保存
        await this.save(item);
      }
    }

    return item;
  }

  async getAll(): Promise<T[]> {
    // 1. インデックス取得
    const indexResult = await storage.get([this.indexKey]);

    // 2. インデックス未作成 → 従来方式で全取得+インデックス作成
    if (!indexResult[this.indexKey]) {
      return this.createIndexAndGetAll();
    }

    // 3. インデックスからキー一覧取得 → 実データ取得
    const index: ImageIndex<T> = indexResult[this.indexKey];
    const keys = index.items.map((item) => item.key);
    const dataResult = await storage.get(keys);

    // 4. ImageItem配列構築
    const items = index.items.map((meta) => {
      const data = dataResult[meta.key];
      // 新形式（完全オブジェクト）で保存されている場合
      if (typeof data === "object" && data.key) {
        return data as T;
      }
      // 旧形式（dataUrlのみ）で保存されている場合
      return {
        ...meta,
        dataUrl: data || "",
      } as T;
    });

    // 5. サムネイルがない画像を検出して生成
    const itemsNeedingThumbnails = items.filter(
      (item) => !item.thumbnail && item.dataUrl
    );

    if (itemsNeedingThumbnails.length > 0) {
      console.log(
        `🧑‍🎨 : Generating thumbnails for ${itemsNeedingThumbnails.length} images...`
      );

      // 並列でサムネイル生成
      await Promise.all(
        itemsNeedingThumbnails.map(async (item) => {
          const thumbnail = await this.generateThumbnail(item.dataUrl);
          if (thumbnail) {
            item.thumbnail = thumbnail;
            await this.save(item);
          }
        })
      );
    }

    return items;
  }

  async save(item: T): Promise<void> {
    // サムネイルがない場合は生成
    if (!item.thumbnail && item.dataUrl) {
      const thumbnail = await this.generateThumbnail(item.dataUrl);
      if (thumbnail) {
        item = { ...item, thumbnail };
      }
    }

    // 1. 実データ保存（完全なオブジェクト）
    await storage.set({ [item.key]: item });

    // 2. インデックス更新
    await this.updateIndex(item.key, item.timestamp);
  }

  async delete(key: string): Promise<void> {
    // 1. 実データ削除
    await storage.remove(key);

    // 2. インデックスから削除
    await this.removeFromIndex(key);
  }

  private async createIndexAndGetAll(): Promise<T[]> {
    // 従来方式: 全キー取得
    const result = await storage.get(null);
    const items: T[] = [];
    const indexItems: Array<Pick<T, "key" | "timestamp">> = [];

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith(`${this.prefix}_`) && !key.endsWith("_index")) {
        const timestamp = parseInt(key.replace(`${this.prefix}_`, ""));
        const item = {
          key,
          timestamp,
          dataUrl: value as string,
        } as T;

        items.push(item);
        indexItems.push({ key, timestamp } as Pick<T, "key" | "timestamp">);
      }
    }

    // インデックス作成
    const index: ImageIndex<T> = {
      items: indexItems.sort((a, b) => b.timestamp - a.timestamp),
      lastUpdated: Date.now(),
    };
    await storage.set({ [this.indexKey]: index });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async updateIndex(key: string, timestamp: number): Promise<void> {
    const indexResult = await storage.get([this.indexKey]);
    const index: ImageIndex<T> = indexResult[this.indexKey] || {
      items: [],
      lastUpdated: 0,
    };

    // 既存エントリ削除（更新の場合）
    index.items = index.items.filter((item) => item.key !== key);

    // 新エントリ追加
    index.items.unshift({ key, timestamp } as Pick<T, "key" | "timestamp">);
    index.lastUpdated = Date.now();

    await storage.set({ [this.indexKey]: index });
  }

  private async removeFromIndex(key: string): Promise<void> {
    const indexResult = await storage.get([this.indexKey]);
    if (!indexResult[this.indexKey]) return;

    const index: ImageIndex<T> = indexResult[this.indexKey];
    index.items = index.items.filter((item) => item.key !== key);
    index.lastUpdated = Date.now();

    await storage.set({ [this.indexKey]: index });
  }

  /**
   * サムネイル生成 (200x200px)
   * 小さい画像（200px以下）の場合はnullを返す
   */
  async generateThumbnail(dataUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const THUMBNAIL_SIZE = 200;

        // 小さい画像はサムネイル不要
        if (img.width <= THUMBNAIL_SIZE && img.height <= THUMBNAIL_SIZE) {
          resolve(null);
          return;
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        // アスペクト比を保持してリサイズ
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > THUMBNAIL_SIZE) {
            height = (height * THUMBNAIL_SIZE) / width;
            width = THUMBNAIL_SIZE;
          }
        } else {
          if (height > THUMBNAIL_SIZE) {
            width = (width * THUMBNAIL_SIZE) / height;
            height = THUMBNAIL_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // ピクセルアートの場合はimageSmoothingを無効化
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }
}
