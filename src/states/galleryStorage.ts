import { storage } from "@/utils/browser-api";
import type { ColorStats } from "@/types/image";

export interface DrawPosition {
  TLX: number;
  TLY: number;
  PxX: number;
  PxY: number;
}

export interface GalleryItem {
  key: string;
  timestamp: number;
  // Legacy: dataUrl is deprecated, will be removed in future versions
  // New images should only use thumbnail + IndexedDB blob storage
  dataUrl?: string;
  // Thumbnail (128x128) for UI display, generated on save
  thumbnail?: string;
  title?: string;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  layerOrder?: number;
  // 統計フィールド
  matchedColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
  // タイル別統計（タイルまたぎの画像だと、タイルごとに更新が必要）
  perTileColorStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >;
}

interface GalleryIndex {
  items: Array<{
    key: string;
    timestamp: number;
    // Phase 4: cleaned flag removed - Doctor feature eliminated
    // State is now managed purely by isOptimized flag in IndexedDB LayerMetadata
  }>;
  lastUpdated: number;
}

export class GalleryStorage {
  private readonly prefix = "gallery";
  private readonly indexKey = "gallery_index";

  /**
   * layerOrderを自動採番（未設定画像がある場合のみ）
   * NOTE: Must NOT call getAll() to avoid infinite loop
   */
  private async ensureLayerOrders(): Promise<void> {
    // Direct storage access to avoid getAll() → ensureLayerOrders() loop
    const items = await this.getAllItemsRaw();
    const itemsWithDrawPosition = items.filter((i) => i.drawPosition);
    const needsUpdate = itemsWithDrawPosition.some(
      (i) => i.layerOrder === undefined
    );

    if (!needsUpdate) return;

    // timestamp順でlayerOrder設定
    const sorted = itemsWithDrawPosition.sort(
      (a, b) => a.timestamp - b.timestamp
    );
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].layerOrder === undefined) {
        await this.save({ ...sorted[i], layerOrder: i });
      }
    }
  }

  async updateTileColorStats(
    imageKey: string,
    perTileStatsMap: Map<string, ColorStats>
  ): Promise<void> {
    const images = await this.getAllItemsRaw();
    const image = images.find((i) => i.key === imageKey);
    if (!image) throw new Error(`Image not found: ${imageKey}`);

    // Map→Record変換
    const perTileRecord: Record<
      string,
      { matched: Record<string, number>; total: Record<string, number> }
    > = {};
    for (const [tileKey, stats] of perTileStatsMap.entries()) {
      perTileRecord[tileKey] = {
        matched: Object.fromEntries(stats.matched),
        total: Object.fromEntries(stats.total),
      };
    }

    // 全タイル合算
    const matchedSum = new Map<string, number>();
    const totalSum = new Map<string, number>();
    for (const stats of perTileStatsMap.values()) {
      for (const [colorKey, count] of stats.matched.entries()) {
        matchedSum.set(colorKey, (matchedSum.get(colorKey) || 0) + count);
      }
      for (const [colorKey, count] of stats.total.entries()) {
        totalSum.set(colorKey, (totalSum.get(colorKey) || 0) + count);
      }
    }

    await this.save({
      ...image,
      perTileColorStats: perTileRecord,
      matchedColorStats: Object.fromEntries(matchedSum),
      totalColorStats: Object.fromEntries(totalSum),
    });
  }

  async get(key: string): Promise<GalleryItem | undefined> {
    const dataResult = await storage.get([key]);
    const data = dataResult[key];

    if (!data) return undefined;

    let item: GalleryItem;

    // 新形式（完全オブジェクト）で保存されている場合
    if (typeof data === "object" && data.key) {
      item = data as GalleryItem;
      // Doctor cleanupでdataUrlが削除されている場合があるので、undefinedなら空文字列に
      if (item.dataUrl === undefined) {
        item.dataUrl = "";
      }
    } else {
      // 旧形式（dataUrlのみ）で保存されている場合
      const timestamp = parseInt(key.replace(`${this.prefix}_`, ""));
      item = {
        key,
        timestamp,
        dataUrl: data || "",
      } as GalleryItem;
    }

    // Always fetch full image from IndexedDB if needed
    if (!item.dataUrl || item.dataUrl === "") {
      const { getFullImageDataUrl } = await import("@/utils/indexed-db-bridge");
      const dataUrl = await getFullImageDataUrl(item, {
        logContext: "gallery storage",
      });
      item.dataUrl = dataUrl || "";
    }

    return item;
  }

  /**
   * Get all items without ensureLayerOrders (raw access for internal use)
   */
  private async getAllItemsRaw(options?: {
    fullImage?: boolean;
  }): Promise<GalleryItem[]> {
    // 1. インデックス取得
    const indexResult = await storage.get([this.indexKey]);

    // 2. インデックス未作成 → 従来方式で全取得+インデックス作成
    if (!indexResult[this.indexKey]) return this.createIndexAndGetAll();

    // 3. インデックスからキー一覧取得 → 実データ取得
    const index: GalleryIndex = indexResult[this.indexKey];
    const keys = index.items.map((item) => item.key);
    const dataResult = await storage.get(keys);

    // 4. GalleryItem配列構築
    const items = index.items.map((meta) => {
      const data = dataResult[meta.key];

      // データが存在しない場合（Doctor が削除した後など）
      if (!data) {
        return {
          key: meta.key,
          timestamp: meta.timestamp,
          dataUrl: "",
        } as GalleryItem;
      }

      // 新形式（完全オブジェクト）で保存されている場合
      if (typeof data === "object" && data.key) {
        const item = data as GalleryItem;
        // Doctor cleanupでdataUrlが削除されている場合があるので、undefinedなら空文字列に
        if (item.dataUrl === undefined) {
          item.dataUrl = "";
        }
        return item;
      }

      // 旧形式（dataUrlのみ）で保存されている場合
      return {
        ...meta,
        dataUrl: data || "",
      } as GalleryItem;
    });

    // 5. fetch full image from IndexedDB if requested (slow)
    if (options?.fullImage) await this.fetchMissingDataUrlsFromIndexedDB(items);

    return items;
  }

  async getAll(options?: { fullImage?: boolean }): Promise<GalleryItem[]> {
    await this.ensureLayerOrders();
    return this.getAllItemsRaw(options);
  }

  /**
   * Fetch missing dataUrls from IndexedDB (hybrid storage)
   * Chrome storage: metadata + thumbnail (lightweight)
   * IndexedDB: full image (heavy data)
   *
   * Priority:
   * 1. Use existing dataUrl (full image)
   * 2. Use thumbnail if available (fast)
   * 3. Fetch from IndexedDB (fallback)
   */
  private async fetchMissingDataUrlsFromIndexedDB(
    items: GalleryItem[]
  ): Promise<void> {
    let thumbnailCount = 0;
    let missingKeys: string[] = [];
    let hasDataUrlCount = 0;

    // Check each item
    for (const item of items) {
      // Already has full dataUrl? Skip
      if (item.dataUrl && item.dataUrl !== "") {
        hasDataUrlCount++;
        continue;
      }

      // Has thumbnail? Use it
      if ((item as any).thumbnail) {
        item.dataUrl = (item as any).thumbnail;
        thumbnailCount++;
        continue;
      }

      // No dataUrl and no thumbnail? Need to fetch from IndexedDB
      missingKeys.push(item.key);
    }

    console.log(
      `🧑‍🎨 [Gallery] Data status: ${hasDataUrlCount} with dataUrl, ${thumbnailCount} using thumbnails, ${missingKeys.length} need IndexedDB fetch`
    );

    if (thumbnailCount > 0) {
      console.log(`🧑‍🎨 : Using thumbnails for ${thumbnailCount} items`);
    }

    if (missingKeys.length === 0) {
      return;
    }

    console.log(
      `🧑‍🎨 : Fetching ${missingKeys.length} missing dataUrls from IndexedDB (no thumbnail)...`
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
      `🧑‍🎨 : Fetched ${dataUrls.size}/${missingKeys.length} full images from IndexedDB`
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

  async save(item: GalleryItem): Promise<void> {
    // 新規描画時にlayerOrderを自動設定
    if (item.drawPosition && item.layerOrder === undefined) {
      const items = await this.getAllItemsRaw();
      const maxOrder = items
        .filter((i) => i.drawPosition && i.layerOrder !== undefined)
        .reduce((max, i) => Math.max(max, i.layerOrder!), -1);
      item.layerOrder = maxOrder + 1;
    }

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

  private async createIndexAndGetAll(): Promise<GalleryItem[]> {
    // 従来方式: 全キー取得
    const result = await storage.get(null);
    const items: GalleryItem[] = [];
    const indexItems: Array<{ key: string; timestamp: number }> = [];

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith(`${this.prefix}_`) && !key.endsWith("_index")) {
        const timestamp = parseInt(key.replace(`${this.prefix}_`, ""));
        const item = {
          key,
          timestamp,
          dataUrl: value as string,
        } as GalleryItem;

        items.push(item);
        indexItems.push({ key, timestamp });
      }
    }

    // インデックス作成
    const index: GalleryIndex = {
      items: indexItems.sort((a, b) => b.timestamp - a.timestamp),
      lastUpdated: Date.now(),
    };
    await storage.set({ [this.indexKey]: index });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async updateIndex(key: string, timestamp: number): Promise<void> {
    const indexResult = await storage.get([this.indexKey]);
    const index: GalleryIndex = indexResult[this.indexKey] || {
      items: [],
      lastUpdated: 0,
    };

    // 既存エントリ削除（更新の場合）
    index.items = index.items.filter((item) => item.key !== key);

    // 新エントリ追加
    index.items.unshift({ key, timestamp });
    index.lastUpdated = Date.now();

    await storage.set({ [this.indexKey]: index });
  }

  private async removeFromIndex(key: string): Promise<void> {
    const indexResult = await storage.get([this.indexKey]);
    if (!indexResult[this.indexKey]) return;

    const index: GalleryIndex = indexResult[this.indexKey];
    index.items = index.items.filter((item) => item.key !== key);
    index.lastUpdated = Date.now();

    await storage.set({ [this.indexKey]: index });
  }

  /**
   * レイヤー順序変更
   */
  async moveLayer(imageKey: string, direction: "up" | "down"): Promise<void> {
    const items = await this.getAllItemsRaw();
    const layerImages = items
      .filter((i) => i.drawPosition)
      .sort((a, b) => (a.layerOrder ?? 0) - (b.layerOrder ?? 0));

    const index = layerImages.findIndex((i) => i.key === imageKey);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= layerImages.length) return;

    // layerOrder入れ替え
    const temp = layerImages[index].layerOrder;
    layerImages[index].layerOrder = layerImages[targetIndex].layerOrder;
    layerImages[targetIndex].layerOrder = temp;

    // 保存
    await this.save(layerImages[index]);
    await this.save(layerImages[targetIndex]);
  }
}
