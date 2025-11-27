import { storage } from "@/utils/browser-api";

export interface BaseImageItem {
  key: string;
  timestamp: number;
  dataUrl: string;
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

    // 5. Hybrid: Fetch missing dataUrls from IndexedDB
    await this.fetchMissingDataUrlsFromIndexedDB(items);

    return items;
  }

  /**
   * Fetch missing dataUrls from IndexedDB (hybrid storage)
   * Chrome storage: metadata only (lightweight)
   * IndexedDB: dataUrl (heavy data)
   */
  private async fetchMissingDataUrlsFromIndexedDB(items: T[]): Promise<void> {
    const missingKeys = items
      .filter((item) => !item.dataUrl || item.dataUrl === "")
      .map((item) => item.key);

    if (missingKeys.length === 0) {
      return;
    }

    console.log(
      `🧑‍🎨 : Fetching ${missingKeys.length} missing dataUrls from IndexedDB...`
    );

    // Fetch from IndexedDB via inject context
    const dataUrls = await this.fetchDataUrlsFromIndexedDB(missingKeys);

    // Update items with fetched dataUrls
    for (const item of items) {
      if (dataUrls.has(item.key)) {
        item.dataUrl = dataUrls.get(item.key)!;
      }
    }

    console.log(
      `🧑‍🎨 : Fetched ${dataUrls.size}/${missingKeys.length} dataUrls from IndexedDB`
    );
  }

  /**
   * Request dataUrls from IndexedDB via inject context
   */
  private async fetchDataUrlsFromIndexedDB(
    keys: string[]
  ): Promise<Map<string, string>> {
    return new Promise((resolve) => {
      const result = new Map<string, string>();
      let receivedCount = 0;

      const handler = (event: MessageEvent) => {
        if (event.data.source === "mr-wplace-gallery-dataurl-response") {
          const { key, dataUrl } = event.data;

          if (dataUrl) {
            result.set(key, dataUrl);
          }

          receivedCount++;

          // All responses received
          if (receivedCount >= keys.length) {
            window.removeEventListener("message", handler);
            resolve(result);
          }
        }
      };

      window.addEventListener("message", handler);

      // Send requests for each key
      for (const key of keys) {
        window.postMessage(
          {
            source: "mr-wplace-gallery-dataurl-request",
            key,
          },
          "*"
        );
      }

      // Timeout after 10s
      setTimeout(() => {
        window.removeEventListener("message", handler);
        console.warn(
          `🧑‍🎨 : IndexedDB dataUrl fetch timeout (${receivedCount}/${keys.length} received)`
        );
        resolve(result);
      }, 10000);
    });
  }

  async save(item: T): Promise<void> {
    // 実データ保存（完全なオブジェクト）
    await storage.set({ [item.key]: item });

    // インデックス更新
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
}
