# 実装設計書: Unified Layer & Progressive Migration Architecture

## 目次

1. [現状分析](#1-現状分析)
2. [設計目標](#2-設計目標)
3. [データモデル詳細](#3-データモデル詳細)
4. [アーキテクチャ詳細](#4-アーキテクチャ詳細)
5. [移行戦略](#5-移行戦略)
6. [Phase 1: Worker Infrastructure](#phase-1-worker-infrastructure)
7. [Phase 2: Repository & Data Layer](#phase-2-repository--data-layer)
8. [Phase 3: Integration](#phase-3-integration)
9. [Phase 4: Migration & Cleanup](#phase-4-migration--cleanup)
10. [API 仕様](#10-api-仕様)

---

## 1. 現状分析

### 1.1 既存実装の詳細

**ストレージ構成:**
```typescript
// Chrome Storage (同期・容量制限あり)
{
  "gallery_<timestamp>": GalleryItem,  // dataUrl (Base64) を含む
  "gallery_index": { items: [...] },
  "text_layers": TextLayerItem[],      // 全て1つのキーに配列で保存
  "tile_snapshot_<timestamp>_<x>_<y>": string (dataUrl),
  "tile_snapshots_index": { snapshots: [...] }
}
```

**処理フロー:**
```
【画像配置時】
1. content.ts: sendGalleryImagesToInject()
   → dataUrl を含む全画像データを postMessage で送信
   → サイズ: 数MB〜数十MB (画像枚数による)

2. inject: handleGalleryImages()
   → 各画像を Image → ImageBitmap に変換
   → addImageToOverlayLayers() で分割処理

3. inject: splitImageOnTiles()
   → Canvas API で 1000x1000 グリッドに分割
   → ImageBitmap を Record<string, ImageBitmap> に保存
   → メモリ: 1枚あたり数MB〜数十MB

【タイル描画時】
1. WPlace が tile を fetch
2. fetch-interceptor が intercept
3. drawOverlayLayersOnTile() で overlay 合成
   → フィルター適用、統計計算、背景比較
```

### 1.2 主要な問題点

| 問題 | 原因 | 影響 |
|------|------|------|
| **起動が遅い** | sendGalleryImagesToInject() で全画像データ（dataUrl）を送信 | 初回ロード: 5-10秒 |
| **画像配置が重い** | 毎回 splitImageOnTiles() を実行 | 大画像: 2-5秒のフリーズ |
| **メモリ使用量が多い** | 全画像を ImageBitmap で保持 | 10枚で 100MB+ |
| **容量制限** | Chrome Storage は QUOTA_BYTES 制限あり | 大量の画像で保存失敗 |
| **編集時の再処理** | 画像移動・編集時に全て再分割 | ユーザー体験の悪化 |

---

## 2. 設計目標

### 2.1 優先順位（ユーザー指定）

1. **【最優先】既存ユーザーのデータを壊さず安全に移行**
   - ロールバック可能な段階的移行
   - 新旧データの並行稼働
   - 移行失敗時の自動復旧

2. **【優先2】起動時の処理落ちを防止**
   - 初回ロード: 1秒以内
   - 重い処理は Worker で非同期化
   - メインスレッドは常に 60fps 維持

3. **【優先3】シンプルな構成**
   - 複雑な状態管理を避ける
   - Repository Pattern で抽象化
   - 既存コードへの影響を最小化

4. **【優先4】動作時のパフォーマンス**
   - タイル描画: 16ms 以内
   - 画像配置: 即座に完了（Worker で処理）

### 2.2 技術的目標

- Chrome Storage → IndexedDB への段階的移行
- オンデマンド分割 → 事前分割への移行
- 同期処理 → Web Worker での非同期処理
- Firefox/Chrome 両対応

---

## 3. データモデル詳細

### 3.1 IndexedDB スキーマ

```typescript
// Database: "mr-wplace-v2"
// Version: 1

/**
 * Object Store: "layers"
 * KeyPath: "id"
 * Indexes:
 *   - "type" (non-unique)
 *   - "visible" (non-unique)
 */
interface LayerMetadata {
  // 識別子
  id: string;                    // "gallery_<timestamp>" | "text_<timestamp>" | "snapshot_<timestamp>_<x>_<y>"
  type: "gallery" | "text" | "snapshot";

  // 表示設定
  visible: boolean;              // 描画ON/OFF
  zIndex: number;                // レイヤー順序
  opacity: number;               // 不透明度 (0-1)

  // 座標・範囲
  coords: {
    TLX: number;                 // タイル X 座標
    TLY: number;                 // タイル Y 座標
    PxX: number;                 // ピクセル X オフセット
    PxY: number;                 // ピクセル Y オフセット
  };
  bounds: {
    top: number;                 // 最小タイル Y
    left: number;                // 最小タイル X
    right: number;               // 最大タイル X
    bottom: number;              // 最大タイル Y
  };

  // 状態管理
  isOptimized: boolean;          // true = タイル化済み, false = 生データのみ

  // メタデータ
  title?: string;                // ユーザー設定のタイトル
  timestamp: number;             // 作成日時

  // Gallery 専用フィールド
  layerOrder?: number;           // ギャラリーのレイヤー順序

  // Text 専用フィールド
  text?: string;                 // テキスト内容
  font?: string;                 // フォント名

  // Snapshot 専用フィールド
  snapshotName?: string;         // スナップショット名
}

/**
 * Object Store: "legacy_blobs"
 * KeyPath: "id"
 */
interface LegacyBlobData {
  id: string;                    // LayerMetadata.id と同じ
  blob: Blob;                    // 元画像データ (PNG/JPEG)
  width: number;                 // 画像幅
  height: number;                // 画像高さ
  timestamp: number;             // 保存日時
}

/**
 * Object Store: "optimized_tiles"
 * KeyPath: ["layerId", "tileKey"]
 * Indexes:
 *   - "layerId" (non-unique)
 *   - "tileKey" (non-unique)
 */
interface OptimizedTileData {
  layerId: string;               // LayerMetadata.id
  tileKey: string;               // "0123,0456,123,456" (TLX,TLY,PxX,PxY)
  blob: Blob;                    // 分割済み画像 (PNG)
  width: number;                 // タイル幅 (通常 1000 以下)
  height: number;                // タイル高さ (通常 1000 以下)
  timestamp: number;             // 最適化日時
}

/**
 * Object Store: "statistics"
 * KeyPath: "layerId"
 */
interface LayerStatistics {
  layerId: string;               // LayerMetadata.id
  perTileStats: Record<string, {
    matched: Record<string, number>;  // 背景と一致した色のカウント
    total: Record<string, number>;    // 全体の色のカウント
  }>;
  lastUpdated: number;           // 統計更新日時
}
```

### 3.2 Chrome Storage との並行稼働

移行期間中は Chrome Storage と IndexedDB を並行稼働:

```typescript
/**
 * Chrome Storage (移行期間中も保持)
 * - 軽量なメタデータのみ
 * - IndexedDB が使えない環境でのフォールバック
 */
{
  "migration_status": {
    version: 2,
    completedLayers: string[],   // 移行完了した LayerId のリスト
    failedLayers: string[],      // 移行失敗した LayerId のリスト
    lastMigrationTime: number
  }
}
```

---

## 4. アーキテクチャ詳細

### 4.1 レイヤー構成

```
┌─────────────────────────────────────────────────┐
│ UI Layer (content.ts)                           │
│ - ユーザー操作の受付                             │
│ - Chrome Storage への保存（メタデータのみ）      │
│ - inject へのデータ送信                          │
└────────────┬────────────────────────────────────┘
             │
             ↓ postMessage
┌─────────────────────────────────────────────────┐
│ Repository Layer (inject context)               │
│ - LayerRepository: データ取得の抽象化            │
│ - TileCache: タイルのメモリキャッシュ            │
└────────────┬────────────────────────────────────┘
             │
             ↓ IndexedDB API
┌─────────────────────────────────────────────────┐
│ Data Layer (IndexedDB)                          │
│ - layers: メタデータ                             │
│ - legacy_blobs: 生データ (State A)               │
│ - optimized_tiles: 分割済みデータ (State B)      │
│ - statistics: 統計情報                           │
└────────────┬────────────────────────────────────┘
             │
             ↓ Web Worker
┌─────────────────────────────────────────────────┐
│ Worker Layer (migration.worker.ts)              │
│ - 画像分割処理 (splitImageOnTiles)               │
│ - 統計計算 (computeStats)                        │
│ - 直列キュー管理 (SerialQueue)                   │
└─────────────────────────────────────────────────┘
```

### 4.2 Repository Pattern の詳細

**LayerRepository の役割:**
- 内部状態（isOptimized）を隠蔽
- 高速パス/フォールバックパスの自動切り替え
- Worker への移行リクエスト自動送信

```typescript
class LayerRepository {
  private db: IDBDatabase;
  private tileCache: Map<string, ImageBitmap>;
  private worker: Worker;
  private migrationQueue: Set<string>;

  /**
   * タイルを取得（高速パス or フォールバック）
   */
  async getTile(layerId: string, tileKey: string): Promise<ImageBitmap | null> {
    // 1. メモリキャッシュ確認
    const cacheKey = `${layerId}:${tileKey}`;
    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey)!;
    }

    // 2. レイヤーメタデータ取得
    const layer = await this.getLayerMetadata(layerId);
    if (!layer) return null;

    // 3. 状態に応じて分岐
    if (layer.isOptimized) {
      // 高速パス: optimized_tiles から取得
      const tile = await this.getOptimizedTile(layerId, tileKey);
      if (tile) {
        this.tileCache.set(cacheKey, tile);
        return tile;
      }
    }

    // 4. フォールバックパス: legacy_blobs から切り出し
    const tile = await this.extractTileFromLegacyBlob(layerId, tileKey);
    if (tile) {
      this.tileCache.set(cacheKey, tile);

      // 5. Worker に最適化をリクエスト（キューになければ）
      if (!layer.isOptimized && !this.migrationQueue.has(layerId)) {
        this.requestMigration(layerId);
      }
    }

    return tile;
  }

  /**
   * レイヤーを無効化（編集・移動時）
   */
  async invalidateLayer(layerId: string): Promise<void> {
    // 1. isOptimized を false に設定
    await this.updateLayerMetadata(layerId, { isOptimized: false });

    // 2. optimized_tiles を削除予約（即座には削除しない）
    await this.scheduleOptimizedTilesDeletion(layerId);

    // 3. メモリキャッシュをクリア
    for (const [key, _] of this.tileCache.entries()) {
      if (key.startsWith(`${layerId}:`)) {
        this.tileCache.delete(key);
      }
    }
  }
}
```

### 4.3 Web Worker の詳細

**migration.worker.ts の構造:**

```typescript
// src/inject/workers/migration.worker.ts

interface MigrationTask {
  layerId: string;
  priority: number;  // 0 = 高優先度（可視範囲内）, 1 = 低優先度
}

class MigrationWorker {
  private queue: MigrationTask[] = [];
  private isProcessing: boolean = false;
  private db: IDBDatabase | null = null;

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      // 優先度順にソート
      this.queue.sort((a, b) => a.priority - b.priority);
      const task = this.queue.shift()!;

      try {
        await this.migrateLayer(task.layerId);

        // Main thread に完了通知
        self.postMessage({
          type: 'MIGRATION_COMPLETE',
          layerId: task.layerId,
          success: true
        });
      } catch (error) {
        console.error(`Migration failed for ${task.layerId}:`, error);

        self.postMessage({
          type: 'MIGRATION_COMPLETE',
          layerId: task.layerId,
          success: false,
          error: error.message
        });
      }

      // メモリ解放のため、少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  async migrateLayer(layerId: string) {
    // 1. legacy_blobs から画像取得
    const legacyData = await this.getLegacyBlob(layerId);
    if (!legacyData) throw new Error('Legacy data not found');

    // 2. Blob → ImageBitmap
    const bitmap = await createImageBitmap(legacyData.blob);

    // 3. タイル分割
    const tiles = await this.splitImageOnTiles(bitmap, layerId);

    // 4. optimized_tiles に保存
    await this.saveOptimizedTiles(layerId, tiles);

    // 5. メタデータ更新
    await this.updateLayerMetadata(layerId, { isOptimized: true });

    // 6. メモリ解放
    bitmap.close();
    for (const tile of Object.values(tiles)) {
      tile.close();
    }
  }

  async splitImageOnTiles(
    source: ImageBitmap,
    layerId: string
  ): Promise<Record<string, ImageBitmap>> {
    // OffscreenCanvas で分割処理
    // （既存の splitImageOnTiles ロジックを使用）
  }
}

// Worker メッセージハンドラー
const worker = new MigrationWorker();

self.addEventListener('message', async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'MIGRATE_REQUEST':
      worker.queue.push({
        layerId: data.layerId,
        priority: data.priority ?? 1
      });
      worker.processQueue();
      break;

    case 'CANCEL_MIGRATION':
      worker.queue = worker.queue.filter(t => t.layerId !== data.layerId);
      break;
  }
});
```

---

## 5. 移行戦略

### 5.1 段階的移行フロー

**目標:** 既存ユーザーのデータを壊さず、透過的に新システムへ移行

```
【初回起動時】
1. Chrome Storage から全レイヤーのメタデータを読み込み
2. IndexedDB の "layers" テーブルに変換して保存
   - isOptimized: false に設定
3. dataUrl を Blob に変換して "legacy_blobs" に保存
4. Chrome Storage のデータはそのまま保持（ロールバック用）

【2回目以降の起動】
1. IndexedDB から "layers" を読み込み
2. isOptimized: false のレイヤーは legacy_blobs から取得
3. isOptimized: true のレイヤーは optimized_tiles から取得
4. Worker が裏で少しずつ最適化を実行

【移行完了後】
1. 全レイヤーが isOptimized: true になったことを確認
2. Chrome Storage のデータを削除（任意）
```

### 5.2 ロールバック戦略

**失敗時の安全装置:**

```typescript
/**
 * 移行失敗時のロールバック処理
 * - IndexedDB が壊れた場合
 * - Worker がクラッシュした場合
 */
class MigrationManager {
  async rollbackToLegacy(): Promise<void> {
    console.warn('🧑‍🎨 : Rolling back to legacy Chrome Storage');

    // 1. IndexedDB を全削除
    await indexedDB.deleteDatabase('mr-wplace-v2');

    // 2. Chrome Storage から全データを復元
    // （Chrome Storage はそのまま保持しているため、即座に復元可能）

    // 3. inject 側に legacy モードで動作するよう通知
    window.postMessage({
      source: 'mr-wplace-migration-rollback',
      useLegacyMode: true
    }, '*');
  }

  /**
   * 起動時のヘルスチェック
   */
  async healthCheck(): Promise<boolean> {
    try {
      // IndexedDB が正常に開けるか確認
      const db = await openDatabase();

      // 基本的な読み書きテスト
      await testReadWrite(db);

      db.close();
      return true;
    } catch (error) {
      console.error('🧑‍🎨 : IndexedDB health check failed:', error);
      return false;
    }
  }
}
```

---

## 6. Phase 1: Worker Infrastructure

### 6.1 実装内容

**ファイル構成:**
```
src/inject/workers/
├── migration.worker.ts      # メイン Worker ファイル
├── queue.ts                 # タスクキュー管理
├── tile-splitter.ts         # 画像分割ロジック（OffscreenCanvas）
└── idb-helper.ts            # Worker 内での IndexedDB 操作
```

**migration.worker.ts:**
- タスクキューの管理（直列実行）
- 画像分割処理の実行
- メモリ管理（ImageBitmap.close()）
- Main thread との通信

**queue.ts:**
```typescript
export class SerialQueue<T> {
  private queue: T[] = [];
  private isProcessing = false;

  async enqueue(item: T, processor: (item: T) => Promise<void>): Promise<void> {
    this.queue.push(item);

    if (!this.isProcessing) {
      this.isProcessing = true;
      await this.processQueue(processor);
      this.isProcessing = false;
    }
  }

  private async processQueue(processor: (item: T) => Promise<void>): Promise<void> {
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      await processor(item);

      // メモリ GC のため少し待機
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
}
```

### 6.2 通信プロトコル

**Main → Worker:**
```typescript
// 移行リクエスト
{
  type: 'MIGRATE_REQUEST',
  data: {
    layerId: string,
    priority: 0 | 1,  // 0=高優先度, 1=低優先度
    coords: { TLX, TLY, PxX, PxY },
    bounds: { top, left, right, bottom }
  }
}

// キャンセルリクエスト
{
  type: 'CANCEL_MIGRATION',
  data: { layerId: string }
}
```

**Worker → Main:**
```typescript
// 移行完了
{
  type: 'MIGRATION_COMPLETE',
  layerId: string,
  success: boolean,
  error?: string,
  stats: {
    tileCount: number,
    processingTime: number,
    memoryUsed: number
  }
}

// 進捗更新
{
  type: 'MIGRATION_PROGRESS',
  layerId: string,
  progress: number,  // 0-100
  currentTile: string
}
```

### 6.3 完了条件

- [ ] Worker が画像を分割し IndexedDB に保存できる
- [ ] 直列キューが正しく動作する（同時実行数 1）
- [ ] ImageBitmap のメモリが正しく解放される
- [ ] エラー時に Main thread に通知される

---

## 7. Phase 2: Repository & Data Layer

### 7.1 IndexedDB スキーマ実装

**src/inject/db/schema.ts:**
```typescript
export const DB_NAME = 'mr-wplace-v2';
export const DB_VERSION = 1;

export const STORES = {
  LAYERS: 'layers',
  LEGACY_BLOBS: 'legacy_blobs',
  OPTIMIZED_TILES: 'optimized_tiles',
  STATISTICS: 'statistics'
} as const;

export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // layers store
      if (!db.objectStoreNames.contains(STORES.LAYERS)) {
        const layersStore = db.createObjectStore(STORES.LAYERS, { keyPath: 'id' });
        layersStore.createIndex('type', 'type', { unique: false });
        layersStore.createIndex('visible', 'visible', { unique: false });
      }

      // legacy_blobs store
      if (!db.objectStoreNames.contains(STORES.LEGACY_BLOBS)) {
        db.createObjectStore(STORES.LEGACY_BLOBS, { keyPath: 'id' });
      }

      // optimized_tiles store
      if (!db.objectStoreNames.contains(STORES.OPTIMIZED_TILES)) {
        const tilesStore = db.createObjectStore(STORES.OPTIMIZED_TILES, {
          keyPath: ['layerId', 'tileKey']
        });
        tilesStore.createIndex('layerId', 'layerId', { unique: false });
        tilesStore.createIndex('tileKey', 'tileKey', { unique: false });
      }

      // statistics store
      if (!db.objectStoreNames.contains(STORES.STATISTICS)) {
        db.createObjectStore(STORES.STATISTICS, { keyPath: 'layerId' });
      }
    };
  });
}
```

### 7.2 LayerRepository 実装

**src/inject/db/layer-repository.ts:**
```typescript
export class LayerRepository {
  private db: IDBDatabase;
  private tileCache: Map<string, ImageBitmap>;
  private worker: Worker | null = null;
  private migrationQueue: Set<string>;

  constructor(db: IDBDatabase) {
    this.db = db;
    this.tileCache = new Map();
    this.migrationQueue = new Set();
  }

  setWorker(worker: Worker): void {
    this.worker = worker;
  }

  async getTile(layerId: string, tileKey: string): Promise<ImageBitmap | null> {
    const cacheKey = `${layerId}:${tileKey}`;

    // 1. キャッシュ確認
    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey)!;
    }

    // 2. メタデータ取得
    const layer = await this.getLayerMetadata(layerId);
    if (!layer) return null;

    let bitmap: ImageBitmap | null = null;

    // 3. 高速パス or フォールバック
    if (layer.isOptimized) {
      bitmap = await this.getOptimizedTile(layerId, tileKey);
    }

    if (!bitmap) {
      bitmap = await this.extractTileFromLegacyBlob(layerId, tileKey, layer);

      // Worker に最適化をリクエスト
      if (!layer.isOptimized && !this.migrationQueue.has(layerId)) {
        this.requestMigration(layerId, layer);
      }
    }

    if (bitmap) {
      this.tileCache.set(cacheKey, bitmap);
    }

    return bitmap;
  }

  private async getLayerMetadata(layerId: string): Promise<LayerMetadata | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readonly');
      const store = tx.objectStore(STORES.LAYERS);
      const request = store.get(layerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async getOptimizedTile(
    layerId: string,
    tileKey: string
  ): Promise<ImageBitmap | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.OPTIMIZED_TILES], 'readonly');
      const store = tx.objectStore(STORES.OPTIMIZED_TILES);
      const request = store.get([layerId, tileKey]);

      request.onsuccess = async () => {
        const data: OptimizedTileData | undefined = request.result;
        if (!data) {
          resolve(null);
          return;
        }

        try {
          const bitmap = await createImageBitmap(data.blob);
          resolve(bitmap);
        } catch (error) {
          console.error('Failed to create ImageBitmap from optimized tile:', error);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async extractTileFromLegacyBlob(
    layerId: string,
    tileKey: string,
    layer: LayerMetadata
  ): Promise<ImageBitmap | null> {
    // legacy_blobs から取得して、該当タイルを切り出し
    const legacyData = await this.getLegacyBlob(layerId);
    if (!legacyData) return null;

    const bitmap = await createImageBitmap(legacyData.blob);

    // tileKey から座標を解析
    const [tlx, tly, pxx, pxy] = tileKey.split(',').map(Number);

    // 切り出し範囲を計算
    const offsetX = (tlx - layer.coords.TLX) * 1000 + (pxx - layer.coords.PxX);
    const offsetY = (tly - layer.coords.TLY) * 1000 + (pxy - layer.coords.PxY);

    const width = Math.min(1000 - pxx, bitmap.width - offsetX);
    const height = Math.min(1000 - pxy, bitmap.height - offsetY);

    if (width <= 0 || height <= 0) {
      bitmap.close();
      return null;
    }

    // Canvas で切り出し
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, offsetX, offsetY, width, height, 0, 0, width, height);

    const tileBitmap = await createImageBitmap(canvas);
    bitmap.close();

    return tileBitmap;
  }

  private async getLegacyBlob(layerId: string): Promise<LegacyBlobData | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LEGACY_BLOBS], 'readonly');
      const store = tx.objectStore(STORES.LEGACY_BLOBS);
      const request = store.get(layerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private requestMigration(layerId: string, layer: LayerMetadata): void {
    if (!this.worker) return;

    this.migrationQueue.add(layerId);

    this.worker.postMessage({
      type: 'MIGRATE_REQUEST',
      data: {
        layerId,
        priority: 1,  // デフォルトは低優先度
        coords: layer.coords,
        bounds: layer.bounds
      }
    });
  }

  async invalidateLayer(layerId: string): Promise<void> {
    // 1. isOptimized を false に
    await this.updateLayerMetadata(layerId, { isOptimized: false });

    // 2. optimized_tiles を削除
    await this.deleteOptimizedTiles(layerId);

    // 3. キャッシュクリア
    for (const [key, bitmap] of this.tileCache.entries()) {
      if (key.startsWith(`${layerId}:`)) {
        bitmap.close();
        this.tileCache.delete(key);
      }
    }
  }

  private async updateLayerMetadata(
    layerId: string,
    updates: Partial<LayerMetadata>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.LAYERS], 'readwrite');
      const store = tx.objectStore(STORES.LAYERS);
      const getRequest = store.get(layerId);

      getRequest.onsuccess = () => {
        const layer = getRequest.result;
        if (!layer) {
          reject(new Error(`Layer ${layerId} not found`));
          return;
        }

        const updated = { ...layer, ...updates };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  private async deleteOptimizedTiles(layerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.OPTIMIZED_TILES], 'readwrite');
      const store = tx.objectStore(STORES.OPTIMIZED_TILES);
      const index = store.index('layerId');
      const request = index.openCursor(IDBKeyRange.only(layerId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}
```

### 7.3 完了条件

- [ ] IndexedDB のスキーマが正しく作成される
- [ ] LayerRepository が高速パス/フォールバックを正しく切り替える
- [ ] Worker への移行リクエストが正しく送信される
- [ ] レイヤー無効化が正しく動作する

---

## 8. Phase 3: Integration

### 8.1 fetch-interceptor との統合

**src/inject/fetch-interceptor.ts の変更:**

```typescript
// 既存
import { drawOverlayLayersOnTile } from "./tile-draw";

// 新規追加
import { layerRepository } from "./db/layer-repository";

// handleTileRequest() 内
const handleTileRequest = async (url: string, response: Response) => {
  // ... 既存の処理 ...

  // Repository を使用してタイル取得
  const overlayBitmap = await layerRepository.getTile(layerId, tileKey);

  // 既存の描画処理
  await drawOverlayLayersOnTile(/* ... */);
};
```

### 8.2 content.ts の変更

**Chrome Storage → IndexedDB への初回移行:**

```typescript
// src/content.ts

export const migrateToIndexedDB = async () => {
  const migrationStatus = await storage.get(['migration_status']);

  if (migrationStatus.migration_status?.version === 2) {
    console.log('🧑‍🎨 : Already migrated to IndexedDB');
    return;
  }

  console.log('🧑‍🎨 : Starting migration to IndexedDB...');

  try {
    // 1. Gallery データの移行
    const { GalleryStorage } = await import('@/features/gallery/storage');
    const galleryStorage = new GalleryStorage();
    const galleryItems = await galleryStorage.getAll();

    for (const item of galleryItems) {
      await migrateGalleryItem(item);
    }

    // 2. Text データの移行
    const { TextLayerStorage } = await import('@/features/text-draw/text-layer-storage');
    const textStorage = new TextLayerStorage();
    const textItems = await textStorage.getAll();

    for (const item of textItems) {
      await migrateTextItem(item);
    }

    // 3. Snapshot データの移行
    const { TimeTravelStorage } = await import('@/features/time-travel/storage');
    const tiles = await TimeTravelStorage.getAllTilesWithSnapshots();

    for (const tile of tiles) {
      for (const snapshot of tile.snapshots) {
        await migrateSnapshotItem(snapshot);
      }
    }

    // 4. 移行ステータスを保存
    await storage.set({
      migration_status: {
        version: 2,
        completedLayers: [],
        failedLayers: [],
        lastMigrationTime: Date.now()
      }
    });

    console.log('🧑‍🎨 : Migration to IndexedDB completed');
  } catch (error) {
    console.error('🧑‍🎨 : Migration to IndexedDB failed:', error);
    throw error;
  }
};

const migrateGalleryItem = async (item: GalleryItem) => {
  // dataUrl → Blob 変換
  const blob = await dataUrlToBlob(item.dataUrl);

  // IndexedDB に保存
  window.postMessage({
    source: 'mr-wplace-migration-save-layer',
    data: {
      layer: {
        id: item.key,
        type: 'gallery',
        visible: item.drawEnabled ?? false,
        zIndex: item.layerOrder ?? 0,
        opacity: 1,
        coords: item.drawPosition,
        bounds: calculateBounds(item.drawPosition, blob),
        isOptimized: false,
        title: item.title,
        timestamp: item.timestamp
      },
      blob
    }
  }, '*');
};
```

### 8.3 完了条件

- [ ] 初回起動時に Chrome Storage → IndexedDB へ移行される
- [ ] fetch-interceptor が Repository 経由でタイルを取得する
- [ ] 既存の描画処理が正しく動作する
- [ ] ロールバック機能が動作する

---

## 9. Phase 4: Migration & Cleanup

### 9.1 古いコードの削除

**削除対象:**
- `src/inject/tile-draw/image-processing/split-tiles.ts` の一部（Main thread での分割処理）
- `src/inject/handlers/overlay-handlers.ts` の `addImageToOverlayLayers()` 呼び出し
- `sendGalleryImagesToInject()` での dataUrl 送信

**残すコード:**
- Worker 内での分割処理
- 統計計算ロジック
- フィルター処理

### 9.2 完了条件

- [ ] 全レイヤーが IndexedDB で管理される
- [ ] Chrome Storage の容量が大幅に削減される
- [ ] 起動時間が 1 秒以内になる
- [ ] ドキュメントが更新される

---

## 10. API 仕様

### 10.1 LayerRepository API

```typescript
interface ILayerRepository {
  // レイヤー取得
  getTile(layerId: string, tileKey: string): Promise<ImageBitmap | null>;
  getLayerMetadata(layerId: string): Promise<LayerMetadata | null>;
  getAllLayers(): Promise<LayerMetadata[]>;

  // レイヤー保存
  saveLayer(layer: LayerMetadata, blob: Blob): Promise<void>;
  updateLayer(layerId: string, updates: Partial<LayerMetadata>): Promise<void>;
  deleteLayer(layerId: string): Promise<void>;

  // レイヤー無効化（編集時）
  invalidateLayer(layerId: string): Promise<void>;

  // 統計
  getStatistics(layerId: string): Promise<LayerStatistics | null>;
  updateStatistics(layerId: string, stats: LayerStatistics): Promise<void>;

  // キャッシュ管理
  clearCache(layerId?: string): void;
  getCacheSize(): number;
}
```

### 10.2 Worker API

**Main → Worker:**
```typescript
type WorkerRequest =
  | { type: 'MIGRATE_REQUEST'; data: MigrateRequestData }
  | { type: 'CANCEL_MIGRATION'; data: { layerId: string } }
  | { type: 'COMPUTE_STATS'; data: ComputeStatsData };

interface MigrateRequestData {
  layerId: string;
  priority: 0 | 1;
  coords: LayerCoords;
  bounds: LayerBounds;
}
```

**Worker → Main:**
```typescript
type WorkerResponse =
  | { type: 'MIGRATION_COMPLETE'; layerId: string; success: boolean; error?: string }
  | { type: 'MIGRATION_PROGRESS'; layerId: string; progress: number }
  | { type: 'STATS_COMPLETE'; layerId: string; stats: LayerStatistics };
```

---

## まとめ

本実装設計書では、migration_plan.md の提案を具体的な実装レベルに落とし込みました。

**重要なポイント:**
1. 既存ユーザーのデータは Chrome Storage に残したまま、段階的に IndexedDB へ移行
2. Repository Pattern により、内部実装を隠蔽し、既存コードへの影響を最小化
3. Web Worker で重い処理を非同期化し、メインスレッドを常に 60fps 維持
4. ロールバック機能により、移行失敗時も安全に復旧可能

次のステップとして、`concerns-and-mitigation.md` で詳細な懸念点と対策を記述します。
