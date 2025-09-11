export interface BaseImageItem {
  key: string;
  timestamp: number;
  dataUrl: string;
}

interface ImageIndex<T> {
  items: Array<Pick<T, 'key' | 'timestamp'>>;
  lastUpdated: number;
}

export class ImageStorage<T extends BaseImageItem> {
  private indexKey: string;

  constructor(private prefix: string) {
    this.indexKey = `${prefix}_index`;
  }

  async getAll(): Promise<T[]> {
    // 1. インデックス取得
    const indexResult = await chrome.storage.local.get([this.indexKey]);
    
    // 2. インデックス未作成 → 従来方式で全取得+インデックス作成
    if (!indexResult[this.indexKey]) {
      return this.createIndexAndGetAll();
    }
    
    // 3. インデックスからキー一覧取得 → 実データ取得
    const index: ImageIndex<T> = indexResult[this.indexKey];
    const keys = index.items.map(item => item.key);
    const dataResult = await chrome.storage.local.get(keys);
    
    // 4. ImageItem配列構築
    return index.items.map(meta => ({
      ...meta,
      dataUrl: dataResult[meta.key] || ''
    } as T));
  }

  async save(item: T): Promise<void> {
    // 1. 実データ保存
    await chrome.storage.local.set({ [item.key]: item.dataUrl });
    
    // 2. インデックス更新
    await this.updateIndex(item.key, item.timestamp);
  }

  async delete(key: string): Promise<void> {
    // 1. 実データ削除
    await chrome.storage.local.remove(key);
    
    // 2. インデックスから削除
    await this.removeFromIndex(key);
  }

  private async createIndexAndGetAll(): Promise<T[]> {
    // 従来方式: 全キー取得
    const result = await chrome.storage.local.get(null);
    const items: T[] = [];
    const indexItems: Array<Pick<T, 'key' | 'timestamp'>> = [];

    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith(`${this.prefix}_`) && !key.endsWith('_index')) {
        const timestamp = parseInt(key.replace(`${this.prefix}_`, ''));
        const item = {
          key,
          timestamp,
          dataUrl: value as string
        } as T;
        
        items.push(item);
        indexItems.push({ key, timestamp } as Pick<T, 'key' | 'timestamp'>);
      }
    }

    // インデックス作成
    const index: ImageIndex<T> = {
      items: indexItems.sort((a, b) => b.timestamp - a.timestamp),
      lastUpdated: Date.now()
    };
    await chrome.storage.local.set({ [this.indexKey]: index });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async updateIndex(key: string, timestamp: number): Promise<void> {
    const indexResult = await chrome.storage.local.get([this.indexKey]);
    const index: ImageIndex<T> = indexResult[this.indexKey] || { items: [], lastUpdated: 0 };
    
    // 既存エントリ削除（更新の場合）
    index.items = index.items.filter(item => item.key !== key);
    
    // 新エントリ追加
    index.items.unshift({ key, timestamp } as Pick<T, 'key' | 'timestamp'>);
    index.lastUpdated = Date.now();
    
    await chrome.storage.local.set({ [this.indexKey]: index });
  }

  private async removeFromIndex(key: string): Promise<void> {
    const indexResult = await chrome.storage.local.get([this.indexKey]);
    if (!indexResult[this.indexKey]) return;
    
    const index: ImageIndex<T> = indexResult[this.indexKey];
    index.items = index.items.filter(item => item.key !== key);
    index.lastUpdated = Date.now();
    
    await chrome.storage.local.set({ [this.indexKey]: index });
  }
}
