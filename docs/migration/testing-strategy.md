# テスト戦略: Unified Layer & Progressive Migration

## 目次

1. [テスト方針](#1-テスト方針)
2. [Phase 1: Worker Infrastructure のテスト](#2-phase-1-worker-infrastructure-のテスト)
3. [Phase 2: Repository & Data Layer のテスト](#3-phase-2-repository--data-layer-のテスト)
4. [Phase 3: Integration のテスト](#4-phase-3-integration-のテスト)
5. [Phase 4: Migration & Cleanup のテスト](#5-phase-4-migration--cleanup-のテスト)
6. [パフォーマンステスト](#6-パフォーマンステスト)
7. [E2E テスト](#7-e2e-テスト)

---

## 1. テスト方針

### 1.1 テストレベルの定義

| レベル | 対象 | 実行タイミング | ツール |
|--------|------|----------------|--------|
| **Unit Test** | 個別の関数・クラス | 実装直後 | Bun Test |
| **Integration Test** | 複数のモジュール間の連携 | Phase 完了時 | Bun Test |
| **E2E Test** | ユーザーシナリオ全体 | リリース前 | Playwright |
| **Performance Test** | パフォーマンス測定 | 各 Phase 完了時 | Performance API |

### 1.2 カバレッジ目標

| Phase | Unit Test | Integration Test | E2E Test |
|-------|-----------|------------------|----------|
| Phase 1 | 90%+ | 80%+ | - |
| Phase 2 | 90%+ | 85%+ | - |
| Phase 3 | 85%+ | 90%+ | 基本シナリオ |
| Phase 4 | 80%+ | 90%+ | 全シナリオ |

### 1.3 テスト環境

**ブラウザ:**
- Chrome 88+ (primary)
- Firefox 91+ (secondary)
- Edge 88+ (optional)

**テストデータ:**
```typescript
// test/fixtures/
export const createTestLayers = (count: number, options?: {
  visibleCount?: number;
  optimizedCount?: number;
}) => {
  // テスト用レイヤー生成
};

export const createTestImage = (width: number, height: number) => {
  // テスト用画像生成
};
```

---

## 2. Phase 1: Worker Infrastructure のテスト

### 2.1 Worker の基本機能テスト

**ファイル:** `src/inject/workers/migration.worker.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('MigrationWorker', () => {
  let worker: Worker;

  beforeEach(() => {
    worker = new Worker(
      new URL('./migration.worker.ts', import.meta.url),
      { type: 'module' }
    );
  });

  afterEach(() => {
    worker.terminate();
  });

  describe('Task Queue', () => {
    it('should process tasks sequentially', async () => {
      const tasks = ['layer1', 'layer2', 'layer3'];
      const results: string[] = [];

      worker.addEventListener('message', (event) => {
        if (event.data.type === 'MIGRATION_COMPLETE') {
          results.push(event.data.layerId);
        }
      });

      // 3つのタスクを送信
      for (const layerId of tasks) {
        worker.postMessage({
          type: 'MIGRATE_REQUEST',
          data: { layerId, priority: 1 }
        });
      }

      // 全完了を待つ
      await waitForAllComplete(worker, 3);

      // 順序が保たれていることを確認
      expect(results).toEqual(['layer1', 'layer2', 'layer3']);
    });

    it('should respect priority', async () => {
      const results: string[] = [];

      worker.addEventListener('message', (event) => {
        if (event.data.type === 'MIGRATION_COMPLETE') {
          results.push(event.data.layerId);
        }
      });

      // 低優先度タスクを送信
      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: { layerId: 'layer1', priority: 1 }
      });

      // 少し待ってから高優先度タスクを送信
      await new Promise(resolve => setTimeout(resolve, 100));

      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: { layerId: 'layer2', priority: 0 }
      });

      await waitForAllComplete(worker, 2);

      // 高優先度が先に処理される
      expect(results[1]).toBe('layer2');
    });

    it('should limit concurrent tasks to 1', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      worker.addEventListener('message', (event) => {
        if (event.data.type === 'MIGRATION_PROGRESS') {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        }
        if (event.data.type === 'MIGRATION_COMPLETE') {
          concurrentCount--;
        }
      });

      // 10個のタスクを一度に送信
      for (let i = 0; i < 10; i++) {
        worker.postMessage({
          type: 'MIGRATE_REQUEST',
          data: { layerId: `layer${i}`, priority: 1 }
        });
      }

      await waitForAllComplete(worker, 10);

      // 最大同時実行数が 1
      expect(maxConcurrent).toBe(1);
    });
  });

  describe('Image Processing', () => {
    it('should split image into tiles', async () => {
      const testImage = await createTestImageBlob(2500, 1800);

      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: {
          layerId: 'layer1',
          priority: 0,
          coords: { TLX: 0, TLY: 0, PxX: 0, PxY: 0 },
          bounds: { top: 0, left: 0, right: 2, bottom: 1 }
        }
      });

      const result = await waitForComplete(worker, 'layer1');

      expect(result.success).toBe(true);
      expect(result.stats.tileCount).toBe(6);  // 3x2 grid
    });

    it('should handle empty tiles (sparse optimization)', async () => {
      // 透明ピクセルのみの画像
      const transparentImage = await createTransparentImageBlob(1000, 1000);

      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: {
          layerId: 'layer1',
          priority: 0,
          coords: { TLX: 0, TLY: 0, PxX: 0, PxY: 0 },
          bounds: { top: 0, left: 0, right: 0, bottom: 0 }
        }
      });

      const result = await waitForComplete(worker, 'layer1');

      expect(result.success).toBe(true);
      expect(result.stats.tileCount).toBe(0);  // 透明タイルは保存しない
    });
  });

  describe('Memory Management', () => {
    it('should close ImageBitmaps after processing', async () => {
      const initialMemory = await getWorkerMemoryUsage(worker);

      // 大きな画像を処理
      for (let i = 0; i < 10; i++) {
        worker.postMessage({
          type: 'MIGRATE_REQUEST',
          data: {
            layerId: `layer${i}`,
            priority: 1
          }
        });
      }

      await waitForAllComplete(worker, 10);

      const finalMemory = await getWorkerMemoryUsage(worker);
      const increase = finalMemory - initialMemory;

      // メモリ増加が 10MB 以下
      expect(increase).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid image data', async () => {
      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: {
          layerId: 'invalid-layer',
          priority: 0
        }
      });

      const result = await waitForComplete(worker, 'invalid-layer');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should continue processing other tasks after error', async () => {
      const results: string[] = [];

      worker.addEventListener('message', (event) => {
        if (event.data.type === 'MIGRATION_COMPLETE') {
          results.push(event.data.layerId);
        }
      });

      // 正常 → エラー → 正常
      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: { layerId: 'layer1', priority: 1 }
      });

      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: { layerId: 'invalid-layer', priority: 1 }
      });

      worker.postMessage({
        type: 'MIGRATE_REQUEST',
        data: { layerId: 'layer2', priority: 1 }
      });

      await waitForAllComplete(worker, 3);

      // 全て処理される
      expect(results.length).toBe(3);
      expect(results).toContain('layer1');
      expect(results).toContain('layer2');
    });
  });
});
```

### 2.2 Worker 通信のテスト

**ファイル:** `src/inject/workers/messaging.test.ts`

```typescript
describe('WorkerMessenger', () => {
  let worker: Worker;
  let messenger: WorkerMessenger;

  beforeEach(() => {
    worker = new Worker(/* ... */);
    messenger = new WorkerMessenger(worker);
  });

  it('should send typed messages', () => {
    const spy = jest.spyOn(worker, 'postMessage');

    messenger.send({
      type: 'MIGRATE_REQUEST',
      data: { layerId: 'layer1', priority: 0 }
    });

    expect(spy).toHaveBeenCalledWith({
      type: 'MIGRATE_REQUEST',
      data: { layerId: 'layer1', priority: 0 }
    });
  });

  it('should wait for specific response', async () => {
    // Worker からのレスポンスをシミュレート
    setTimeout(() => {
      worker.dispatchEvent(new MessageEvent('message', {
        data: {
          type: 'MIGRATION_COMPLETE',
          layerId: 'layer1',
          success: true
        }
      }));
    }, 100);

    const response = await messenger.waitFor('MIGRATION_COMPLETE');

    expect(response.layerId).toBe('layer1');
    expect(response.success).toBe(true);
  });

  it('should timeout if no response', async () => {
    await expect(
      messenger.waitFor('MIGRATION_COMPLETE', 100)
    ).rejects.toThrow('Timeout');
  });
});
```

### 2.3 Phase 1 完了条件

- [ ] 全 Unit Test が通過（カバレッジ 90%+）
- [ ] Worker がタスクを直列処理できる
- [ ] 画像分割が正しく動作する
- [ ] ImageBitmap が正しく close() される
- [ ] エラー時も処理が継続する

---

## 3. Phase 2: Repository & Data Layer のテスト

### 3.1 IndexedDB スキーマのテスト

**ファイル:** `src/inject/db/schema.test.ts`

```typescript
describe('IndexedDB Schema', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    // テスト用DBを開く
    db = await openDatabase();
  });

  afterEach(async () => {
    // DBを削除
    db.close();
    await indexedDB.deleteDatabase(DB_NAME);
  });

  it('should create all object stores', () => {
    expect(db.objectStoreNames.contains(STORES.LAYERS)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.LEGACY_BLOBS)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.OPTIMIZED_TILES)).toBe(true);
    expect(db.objectStoreNames.contains(STORES.STATISTICS)).toBe(true);
  });

  it('should create indexes', () => {
    const tx = db.transaction([STORES.LAYERS], 'readonly');
    const store = tx.objectStore(STORES.LAYERS);

    expect(store.indexNames.contains('type')).toBe(true);
    expect(store.indexNames.contains('visible')).toBe(true);
  });

  it('should handle version upgrades', async () => {
    db.close();

    // バージョンを上げて開く
    const db2 = await openDatabase({ version: 2 });

    expect(db2.version).toBe(2);

    db2.close();
  });
});
```

### 3.2 LayerRepository のテスト

**ファイル:** `src/inject/db/layer-repository.test.ts`

```typescript
describe('LayerRepository', () => {
  let db: IDBDatabase;
  let repository: LayerRepository;

  beforeEach(async () => {
    db = await openDatabase();
    repository = new LayerRepository(db);
  });

  afterEach(async () => {
    db.close();
    await indexedDB.deleteDatabase(DB_NAME);
  });

  describe('getTile()', () => {
    it('should return tile from optimized_tiles (fast path)', async () => {
      // テストデータを準備
      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      const tile = await createTestTileBitmap();
      await saveOptimizedTile(db, layer.id, '0123,0456,123,456', tile);

      // タイルを取得
      const bitmap = await repository.getTile(layer.id, '0123,0456,123,456');

      expect(bitmap).toBeTruthy();
      expect(bitmap!.width).toBeGreaterThan(0);
    });

    it('should extract tile from legacy_blobs (fallback path)', async () => {
      // 未最適化レイヤーを準備
      const layer = createTestLayer({ isOptimized: false });
      const blob = await createTestImageBlob(2000, 2000);
      await repository.saveLayer(layer, blob);

      // タイルを取得
      const bitmap = await repository.getTile(layer.id, '0000,0000,000,000');

      expect(bitmap).toBeTruthy();
      expect(bitmap!.width).toBe(1000);  // 1000x1000 に切り出される
    });

    it('should cache tiles in memory', async () => {
      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      const tile = await createTestTileBitmap();
      await saveOptimizedTile(db, layer.id, '0123,0456,123,456', tile);

      // 1回目: DB から取得
      const bitmap1 = await repository.getTile(layer.id, '0123,0456,123,456');

      // 2回目: キャッシュから取得（DB クエリなし）
      const spy = jest.spyOn(db, 'transaction');
      const bitmap2 = await repository.getTile(layer.id, '0123,0456,123,456');

      expect(spy).not.toHaveBeenCalled();
      expect(bitmap1).toBe(bitmap2);  // 同じインスタンス
    });

    it('should request migration for unoptimized layers', async () => {
      const worker = new Worker(/* ... */);
      repository.setWorker(worker);

      const spy = jest.spyOn(worker, 'postMessage');

      const layer = createTestLayer({ isOptimized: false });
      await repository.saveLayer(layer, createTestBlob());

      await repository.getTile(layer.id, '0000,0000,000,000');

      // Worker に MIGRATE_REQUEST が送信される
      expect(spy).toHaveBeenCalledWith({
        type: 'MIGRATE_REQUEST',
        data: expect.objectContaining({ layerId: layer.id })
      });
    });
  });

  describe('invalidateLayer()', () => {
    it('should set isOptimized to false', async () => {
      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      await repository.invalidateLayer(layer.id);

      const updated = await repository.getLayerMetadata(layer.id);
      expect(updated!.isOptimized).toBe(false);
    });

    it('should delete optimized tiles', async () => {
      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      const tile = await createTestTileBitmap();
      await saveOptimizedTile(db, layer.id, '0123,0456,123,456', tile);

      await repository.invalidateLayer(layer.id);

      // optimized_tiles が削除される
      const tiles = await getAllOptimizedTilesForLayer(db, layer.id);
      expect(tiles.length).toBe(0);
    });

    it('should clear memory cache', async () => {
      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      const tile = await createTestTileBitmap();
      await saveOptimizedTile(db, layer.id, '0123,0456,123,456', tile);

      // キャッシュに保存
      await repository.getTile(layer.id, '0123,0456,123,456');

      // 無効化
      await repository.invalidateLayer(layer.id);

      // 次回取得時は DB から再取得される
      const spy = jest.spyOn(db, 'transaction');
      await repository.getTile(layer.id, '0123,0456,123,456');

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Cache Management', () => {
    it('should limit cache size', async () => {
      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      // 150枚のタイルを取得（キャッシュは最大100枚）
      for (let i = 0; i < 150; i++) {
        const tileKey = `0${i.toString().padStart(3, '0')},0000,000,000`;
        const tile = await createTestTileBitmap();
        await saveOptimizedTile(db, layer.id, tileKey, tile);

        await repository.getTile(layer.id, tileKey);
      }

      // キャッシュサイズが 100 に制限される
      const cacheSize = repository.getCacheSize();
      expect(cacheSize).toBe(100);
    });

    it('should close old bitmaps when evicting cache', async () => {
      const closeSpy = jest.spyOn(ImageBitmap.prototype, 'close');

      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      // 110枚のタイルを取得
      for (let i = 0; i < 110; i++) {
        const tileKey = `0${i.toString().padStart(3, '0')},0000,000,000`;
        const tile = await createTestTileBitmap();
        await saveOptimizedTile(db, layer.id, tileKey, tile);

        await repository.getTile(layer.id, tileKey);
      }

      // 10枚が close() される
      expect(closeSpy).toHaveBeenCalledTimes(10);
    });
  });
});
```

### 3.3 Migration のテスト

**ファイル:** `src/content.test.ts`

```typescript
describe('migrateToIndexedDB()', () => {
  beforeEach(async () => {
    // Chrome Storage にテストデータを準備
    await prepareChromeStorageTestData();
  });

  afterEach(async () => {
    await indexedDB.deleteDatabase(DB_NAME);
    await clearChromeStorage();
  });

  it('should migrate all layers from Chrome Storage', async () => {
    const galleryItems = await createTestGalleryItems(10);
    const textItems = await createTestTextItems(5);

    await migrateToIndexedDB();

    // IndexedDB に保存されることを確認
    const db = await openDatabase();
    const layers = await getAllLayersFromIndexedDB(db);

    expect(layers.length).toBe(15);
    db.close();
  });

  it('should resume migration after interruption', async () => {
    const items = await createTestGalleryItems(10);

    // 5件だけ移行
    await migratePartially(5);

    // 移行を再実行
    await migrateToIndexedDB();

    // 全件移行されることを確認
    const db = await openDatabase();
    const layers = await getAllLayersFromIndexedDB(db);

    expect(layers.length).toBe(10);
    db.close();
  });

  it('should handle migration failure gracefully', async () => {
    // 容量超過をシミュレート
    jest.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    await expect(migrateToIndexedDB()).rejects.toThrow();

    // Chrome Storage のデータは保持される
    const items = await GalleryStorage.getAll();
    expect(items.length).toBeGreaterThan(0);
  });

  it('should convert dataUrl to Blob', async () => {
    const item = await createTestGalleryItem();
    await GalleryStorage.save(item);

    await migrateToIndexedDB();

    // Blob として保存されることを確認
    const db = await openDatabase();
    const legacyData = await getLegacyBlob(db, item.key);

    expect(legacyData.blob instanceof Blob).toBe(true);
    expect(legacyData.blob.type).toContain('image/');

    db.close();
  });
});
```

### 3.4 Phase 2 完了条件

- [ ] IndexedDB スキーマが正しく作成される
- [ ] LayerRepository が高速パス/フォールバックを切り替える
- [ ] キャッシュが正しく動作する
- [ ] 移行処理が正しく動作する
- [ ] 移行中断から復旧できる

---

## 4. Phase 3: Integration のテスト

### 4.1 content ↔ inject 統合テスト

**ファイル:** `test/integration/content-inject.test.ts`

```typescript
describe('content ↔ inject integration', () => {
  it('should save layer from content to IndexedDB', async () => {
    // content 側で画像を保存
    const item = createTestGalleryItem();
    await GalleryStorage.save(item);

    // inject 側で受信
    await waitForInjectMessage('mr-wplace-save-layer');

    // IndexedDB に保存されることを確認
    const db = await openDatabase();
    const layer = await getLayerMetadata(db, item.key);

    expect(layer).toBeTruthy();
    expect(layer!.type).toBe('gallery');

    db.close();
  });

  it('should update inject when layer is edited', async () => {
    const item = createTestGalleryItem();
    await GalleryStorage.save(item);

    // inject に送信されることを確認
    await waitForInjectMessage('mr-wplace-layer-updated');

    // 編集
    item.title = 'Updated';
    await GalleryStorage.save(item);

    // 再度送信される
    const message = await waitForInjectMessage('mr-wplace-layer-updated');
    expect(message.layerId).toBe(item.key);
  });

  it('should invalidate layer when edited', async () => {
    const item = createTestGalleryItem();
    await GalleryStorage.save(item);

    // Worker で最適化
    await waitForOptimization(item.key);

    // 編集
    item.drawPosition!.PxX = 100;
    await GalleryStorage.save(item);

    // isOptimized が false になることを確認
    const db = await openDatabase();
    const layer = await getLayerMetadata(db, item.key);

    expect(layer!.isOptimized).toBe(false);

    db.close();
  });
});
```

### 4.2 fetch-interceptor 統合テスト

**ファイル:** `test/integration/fetch-interceptor.test.ts`

```typescript
describe('fetch-interceptor integration', () => {
  it('should draw overlay from optimized tiles', async () => {
    // レイヤーを準備
    const layer = createTestLayer({ isOptimized: true });
    const db = await openDatabase();
    await saveLayerToIndexedDB(db, layer, createTestBlob());

    const tile = await createTestTileBitmap();
    await saveOptimizedTile(db, layer.id, '0000,0000,000,000', tile);

    // タイルを fetch
    const response = await fetch('https://backend.wplace.live/s0/tile/0/0');
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // オーバーレイが描画されることを確認
    expect(bitmap.width).toBe(1000);
    expect(bitmap.height).toBe(1000);

    db.close();
  });

  it('should use fallback when optimized tile not found', async () => {
    // 未最適化レイヤーを準備
    const layer = createTestLayer({ isOptimized: false });
    const db = await openDatabase();
    const blob = await createTestImageBlob(2000, 2000);
    await saveLayerToIndexedDB(db, layer, blob);

    // タイルを fetch
    const response = await fetch('https://backend.wplace.live/s0/tile/0/0');
    const resultBlob = await response.blob();
    const bitmap = await createImageBitmap(resultBlob);

    // オーバーレイが描画される（legacy_blobs から取得）
    expect(bitmap.width).toBe(1000);
    expect(bitmap.height).toBe(1000);

    db.close();
  });
});
```

### 4.3 Phase 3 完了条件

- [ ] content ↔ inject の通信が正しく動作する
- [ ] fetch-interceptor が Repository 経由でタイルを取得する
- [ ] 編集時に正しく無効化される
- [ ] フォールバックパスが正しく動作する

---

## 5. Phase 4: Migration & Cleanup のテスト

### 5.1 レガシーコードの削除テスト

**ファイル:** `test/migration/cleanup.test.ts`

```typescript
describe('Legacy code cleanup', () => {
  it('should not use Chrome Storage for image data', async () => {
    const spy = jest.spyOn(chrome.storage.local, 'set');

    const item = createTestGalleryItem();
    await GalleryStorage.save(item);

    // dataUrl は Chrome Storage に保存されない
    const calls = spy.mock.calls.filter(call => {
      const data = call[0];
      return Object.keys(data).some(key => key.includes('gallery_'));
    });

    for (const call of calls) {
      const data = call[0];
      expect(data).not.toHaveProperty('dataUrl');
    }
  });

  it('should use IndexedDB for all image data', async () => {
    const item = createTestGalleryItem();
    await GalleryStorage.save(item);

    // IndexedDB に保存されることを確認
    const db = await openDatabase();
    const legacyData = await getLegacyBlob(db, item.key);

    expect(legacyData).toBeTruthy();
    expect(legacyData.blob instanceof Blob).toBe(true);

    db.close();
  });
});
```

### 5.2 Phase 4 完了条件

- [ ] Chrome Storage の使用量が大幅に削減される
- [ ] 全ての画像データが IndexedDB に保存される
- [ ] 古いコードが削除される

---

## 6. パフォーマンステスト

### 6.1 起動時間の測定

**ファイル:** `test/performance/startup.test.ts`

```typescript
describe('Startup Performance', () => {
  it('should load UI within 1 second', async () => {
    const startTime = performance.now();

    // 拡張機能を起動
    await initializeExtension();

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Startup time: ${duration.toFixed(2)}ms`);

    // 1秒以内
    expect(duration).toBeLessThan(1000);
  });

  it('should complete lightweight migration within 100ms', async () => {
    const layers = createTestLayers(50);

    const startTime = performance.now();

    await migrateLightweightMetadata(layers);

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Lightweight migration: ${duration.toFixed(2)}ms`);

    // 100ms 以内
    expect(duration).toBeLessThan(100);
  });

  it('should not freeze UI during heavy migration', async () => {
    const layers = createTestLayers(100);

    const startTime = performance.now();
    let maxBlockingTime = 0;

    // マイクロタスクの実行時間を測定
    const interval = setInterval(() => {
      const taskStartTime = performance.now();

      // 空のタスクを実行
      Promise.resolve().then(() => {
        const blockingTime = performance.now() - taskStartTime;
        maxBlockingTime = Math.max(maxBlockingTime, blockingTime);
      });
    }, 16);  // 60fps

    await migrateHeavyData(layers);

    clearInterval(interval);

    console.log(`Max blocking time: ${maxBlockingTime.toFixed(2)}ms`);

    // 16ms 以下（60fps 維持）
    expect(maxBlockingTime).toBeLessThan(16);
  });
});
```

### 6.2 タイル描画速度の測定

**ファイル:** `test/performance/tile-rendering.test.ts`

```typescript
describe('Tile Rendering Performance', () => {
  it('should get tile from cache within 1ms', async () => {
    const repository = new LayerRepository(db);
    const layer = createTestLayer({ isOptimized: true });
    await repository.saveLayer(layer, createTestBlob());

    const tile = await createTestTileBitmap();
    await saveOptimizedTile(db, layer.id, '0000,0000,000,000', tile);

    // 1回目: DB から取得（キャッシュに保存）
    await repository.getTile(layer.id, '0000,0000,000,000');

    // 2回目: キャッシュから取得
    const startTime = performance.now();
    await repository.getTile(layer.id, '0000,0000,000,000');
    const duration = performance.now() - startTime;

    console.log(`Cache hit time: ${duration.toFixed(2)}ms`);

    // 1ms 以内
    expect(duration).toBeLessThan(1);
  });

  it('should get optimized tile within 16ms', async () => {
    const repository = new LayerRepository(db);
    const layer = createTestLayer({ isOptimized: true });
    await repository.saveLayer(layer, createTestBlob());

    const tile = await createTestTileBitmap();
    await saveOptimizedTile(db, layer.id, '0000,0000,000,000', tile);

    const startTime = performance.now();
    await repository.getTile(layer.id, '0000,0000,000,000');
    const duration = performance.now() - startTime;

    console.log(`Optimized tile get time: ${duration.toFixed(2)}ms`);

    // 16ms 以内
    expect(duration).toBeLessThan(16);
  });

  it('should extract tile from legacy blob within 50ms', async () => {
    const repository = new LayerRepository(db);
    const layer = createTestLayer({ isOptimized: false });
    const blob = await createTestImageBlob(2000, 2000);
    await repository.saveLayer(layer, blob);

    const startTime = performance.now();
    await repository.getTile(layer.id, '0000,0000,000,000');
    const duration = performance.now() - startTime;

    console.log(`Legacy blob extraction time: ${duration.toFixed(2)}ms`);

    // 50ms 以内
    expect(duration).toBeLessThan(50);
  });
});
```

### 6.3 メモリ使用量の測定

**ファイル:** `test/performance/memory.test.ts`

```typescript
describe('Memory Usage', () => {
  it('should limit memory usage to 100MB', async () => {
    const repository = new LayerRepository(db);

    // 50枚の画像を読み込み
    for (let i = 0; i < 50; i++) {
      const layer = createTestLayer({ isOptimized: true });
      await repository.saveLayer(layer, createTestBlob());

      for (let j = 0; j < 6; j++) {
        const tileKey = `0${j.toString().padStart(3, '0')},0000,000,000`;
        const tile = await createTestTileBitmap();
        await saveOptimizedTile(db, layer.id, tileKey, tile);

        await repository.getTile(layer.id, tileKey);
      }
    }

    const memoryUsage = performance.memory.usedJSHeapSize;
    const memoryMB = memoryUsage / 1024 / 1024;

    console.log(`Memory usage: ${memoryMB.toFixed(2)}MB`);

    // 100MB 以下
    expect(memoryMB).toBeLessThan(100);
  });

  it('should close bitmaps when clearing cache', async () => {
    const repository = new LayerRepository(db);
    const layer = createTestLayer({ isOptimized: true });
    await repository.saveLayer(layer, createTestBlob());

    // キャッシュに保存
    for (let i = 0; i < 50; i++) {
      const tileKey = `0${i.toString().padStart(3, '0')},0000,000,000`;
      const tile = await createTestTileBitmap();
      await saveOptimizedTile(db, layer.id, tileKey, tile);

      await repository.getTile(layer.id, tileKey);
    }

    const beforeClear = performance.memory.usedJSHeapSize;

    // キャッシュをクリア
    repository.clearCache();

    // GC を待つ
    await new Promise(resolve => setTimeout(resolve, 100));

    const afterClear = performance.memory.usedJSHeapSize;

    // メモリが解放される
    expect(afterClear).toBeLessThan(beforeClear);
  });
});
```

---

## 7. E2E テスト

### 7.1 基本シナリオ

**ファイル:** `test/e2e/basic-scenarios.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Migration E2E', () => {
  test('should migrate existing user data', async ({ page, extensionId }) => {
    // 1. 既存データを準備
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.evaluate(async () => {
      // Chrome Storage に既存データを保存
      const galleryItem = {
        key: 'gallery_1234567890',
        dataUrl: 'data:image/png;base64,...',
        drawPosition: { TLX: 0, TLY: 0, PxX: 0, PxY: 0 },
        drawEnabled: true,
        timestamp: 1234567890
      };

      await chrome.storage.local.set({ [galleryItem.key]: galleryItem });
    });

    // 2. 拡張機能を再起動（移行をトリガー）
    await page.reload();

    // 3. 移行完了を待つ
    await page.waitForSelector('[data-testid="migration-complete"]', { timeout: 10000 });

    // 4. IndexedDB にデータが移行されることを確認
    const migrated = await page.evaluate(async () => {
      const db = await indexedDB.open('mr-wplace-v2', 1);
      const tx = db.transaction(['layers'], 'readonly');
      const store = tx.objectStore('layers');
      const layers = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });

      return layers.length > 0;
    });

    expect(migrated).toBe(true);
  });

  test('should display progress during migration', async ({ page, extensionId }) => {
    // 大量のデータを準備
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.evaluate(async () => {
      for (let i = 0; i < 50; i++) {
        const item = {
          key: `gallery_${Date.now() + i}`,
          dataUrl: 'data:image/png;base64,...',
          drawPosition: { TLX: 0, TLY: 0, PxX: 0, PxY: 0 },
          drawEnabled: true,
          timestamp: Date.now() + i
        };

        await chrome.storage.local.set({ [item.key]: item });
      }
    });

    // 再起動
    await page.reload();

    // プログレスバーが表示されることを確認
    await expect(page.locator('[data-testid="migration-progress"]')).toBeVisible();

    // 完了まで待つ
    await page.waitForSelector('[data-testid="migration-complete"]', { timeout: 30000 });
  });

  test('should handle migration interruption', async ({ page, extensionId, context }) => {
    // 1. 移行を開始
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // 2. 移行中にブラウザを閉じる
    await page.waitForTimeout(2000);
    await context.close();

    // 3. ブラウザを再起動
    const newContext = await context.browser()!.newContext();
    const newPage = await newContext.newPage();
    await newPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // 4. 移行が再開されることを確認
    await expect(newPage.locator('[data-testid="migration-resuming"]')).toBeVisible();

    // 5. 完了まで待つ
    await newPage.waitForSelector('[data-testid="migration-complete"]', { timeout: 30000 });

    // 6. 全データが移行されることを確認
    const allMigrated = await newPage.evaluate(async () => {
      const db = await indexedDB.open('mr-wplace-v2', 1);
      const tx = db.transaction(['layers'], 'readonly');
      const store = tx.objectStore('layers');
      const layers = await new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
      });

      return layers;
    });

    expect(allMigrated.length).toBeGreaterThan(0);
  });
});
```

### 7.2 ユーザーシナリオ

```typescript
test.describe('User Scenarios', () => {
  test('should add and display image', async ({ page, extensionId }) => {
    await page.goto('https://wplace.live/');

    // 1. 画像を追加
    const fileInput = await page.locator('input[type="file"]');
    await fileInput.setInputFiles('test/fixtures/test-image.png');

    // 2. 画像が保存されることを確認
    await page.waitForSelector('[data-testid="image-saved"]');

    // 3. マップに描画されることを確認
    const canvas = await page.locator('canvas.maplibregl-canvas');
    expect(canvas).toBeVisible();

    // 4. Worker で最適化されることを確認
    await page.waitForSelector('[data-testid="image-optimized"]', { timeout: 10000 });
  });

  test('should edit image position', async ({ page }) => {
    await page.goto('https://wplace.live/');

    // 1. 画像を追加
    await addTestImage(page);

    // 2. 画像の位置を変更
    await page.click('[data-testid="edit-position"]');
    await page.fill('[data-testid="position-x"]', '100');
    await page.fill('[data-testid="position-y"]', '200');
    await page.click('[data-testid="save-position"]');

    // 3. レイヤーが無効化されることを確認
    const isOptimized = await page.evaluate(async () => {
      const db = await indexedDB.open('mr-wplace-v2', 1);
      const tx = db.transaction(['layers'], 'readonly');
      const store = tx.objectStore('layers');
      const layer = await new Promise((resolve) => {
        const request = store.get('gallery_1234567890');
        request.onsuccess = () => resolve(request.result);
      });

      return layer.isOptimized;
    });

    expect(isOptimized).toBe(false);

    // 4. 再最適化されることを確認
    await page.waitForSelector('[data-testid="image-optimized"]', { timeout: 10000 });
  });
});
```

---

## まとめ

本ドキュメントでは、migration_plan.md の実装における詳細なテスト戦略を記述しました。

**テストの優先順位:**
1. **Phase 1**: Worker の基本機能、メモリ管理
2. **Phase 2**: Repository、IndexedDB、移行処理
3. **Phase 3**: 統合テスト、fetch-interceptor
4. **Phase 4**: レガシーコードの削除、E2E テスト

**パフォーマンス目標:**
- 起動時間: < 1秒
- タイル取得（キャッシュヒット）: < 1ms
- タイル取得（最適化済み）: < 16ms
- タイル取得（フォールバック）: < 50ms
- メモリ使用量: < 100MB

次のステップとして、`migration_plan.md` を更新し、Phase 1-4 の具体的なタスクに分解します。
