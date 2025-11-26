# 懸念点と対策: Unified Layer & Progressive Migration

## 目次

1. [優先順位と評価基準](#1-優先順位と評価基準)
2. [最優先: データの安全性](#2-最優先-データの安全性)
3. [優先2: 起動時のパフォーマンス](#3-優先2-起動時のパフォーマンス)
4. [優先3: 実装の複雑性](#4-優先3-実装の複雑性)
5. [優先4: 動作時のパフォーマンス](#5-優先4-動作時のパフォーマンス)
6. [その他の懸念点](#6-その他の懸念点)
7. [総合リスク評価](#7-総合リスク評価)

---

## 1. 優先順位と評価基準

### 1.1 優先順位（ユーザー指定）

| 優先度 | カテゴリ | 重要度 | 許容されない失敗 |
|--------|----------|--------|------------------|
| 1 | データの安全性 | **最高** | データ消失、データ破損 |
| 2 | 起動時パフォーマンス | **高** | 10秒以上のフリーズ |
| 3 | 実装の複雑性 | **中** | メンテナンス不可能なコード |
| 4 | 動作時パフォーマンス | **中** | タイル描画の遅延 |
| 5 | その他 | **低** | - |

### 1.2 リスクレベルの定義

| レベル | 説明 | 対応方針 |
|--------|------|----------|
| 🔴 **Critical** | ユーザーデータ消失、拡張機能の完全停止 | **実装前に完全に解決必須** |
| 🟠 **High** | 一部機能の停止、重大なパフォーマンス劣化 | **Phase 1 で解決** |
| 🟡 **Medium** | 軽微な不具合、パフォーマンス低下 | **Phase 2-3 で解決** |
| 🟢 **Low** | 影響範囲が限定的、回避策あり | **Phase 4 または次バージョンで対応** |

---

## 2. 最優先: データの安全性

### 2.1 懸念点一覧

#### 🔴 C-001: IndexedDB への移行中にブラウザを閉じた場合のデータ消失

**シナリオ:**
```
1. ユーザーが拡張機能を起動
2. migrateToIndexedDB() が実行開始
3. Gallery 画像 5/10 枚を移行中
4. ユーザーがブラウザを閉じる
→ 結果: 5枚は IndexedDB に、5枚は Chrome Storage のみ
→ 次回起動時にどちらを参照すべきか不明
```

**影響:**
- データの二重管理による不整合
- 一部画像が表示されない
- ユーザーの混乱

**対策:**

**【解決策1】トランザクション方式 + ステータス管理**

```typescript
interface MigrationStatus {
  version: number;
  state: 'idle' | 'in_progress' | 'completed' | 'failed';
  completedLayers: string[];
  failedLayers: string[];
  startedAt: number;
  completedAt?: number;
}

export const migrateToIndexedDB = async () => {
  // 1. 既存のステータス確認
  const status = await getMigrationStatus();

  if (status.state === 'in_progress') {
    console.warn('🧑‍🎨 : Previous migration was interrupted, resuming...');
    // 中断された移行を再開
    await resumeMigration(status);
    return;
  }

  if (status.state === 'completed') {
    console.log('🧑‍🎨 : Migration already completed');
    return;
  }

  // 2. ステータスを "in_progress" に設定
  await setMigrationStatus({ state: 'in_progress', startedAt: Date.now() });

  try {
    // 3. 1件ずつ移行（完了したらステータスに記録）
    const allLayers = await getAllLayersFromChromeStorage();

    for (const layer of allLayers) {
      if (status.completedLayers.includes(layer.id)) {
        console.log(`🧑‍🎨 : Layer ${layer.id} already migrated, skipping`);
        continue;
      }

      try {
        await migrateSingleLayer(layer);

        // 完了リストに追加
        await addCompletedLayer(layer.id);
      } catch (error) {
        console.error(`🧑‍🎨 : Failed to migrate ${layer.id}:`, error);
        await addFailedLayer(layer.id);
      }
    }

    // 4. 全完了 → ステータスを "completed" に
    await setMigrationStatus({
      state: 'completed',
      completedAt: Date.now()
    });

    console.log('🧑‍🎨 : Migration completed successfully');
  } catch (error) {
    // 致命的エラー
    await setMigrationStatus({ state: 'failed' });
    throw error;
  }
};

const resumeMigration = async (status: MigrationStatus) => {
  console.log(`🧑‍🎨 : Resuming migration (${status.completedLayers.length} already done)`);

  // 中断された時点から再開（同じロジックを使用）
  const allLayers = await getAllLayersFromChromeStorage();
  const remaining = allLayers.filter(
    layer => !status.completedLayers.includes(layer.id)
  );

  for (const layer of remaining) {
    // ... 同じ処理 ...
  }
};
```

**【解決策2】Atomic Write（全件移行後に一括コミット）**

```typescript
export const migrateToIndexedDB = async () => {
  // 1. 全データを一時領域に移行
  const tempDb = await openTemporaryDatabase();

  const allLayers = await getAllLayersFromChromeStorage();

  for (const layer of allLayers) {
    await saveTo temporary(tempDb, layer);
  }

  // 2. 全件成功したら本番DBに移動
  await commitTemporaryToProduction(tempDb);

  // 3. 一時領域を削除
  await deleteTemporaryDatabase();
};
```

**推奨:** 解決策1（段階的移行）
- 理由: ブラウザを閉じても再開可能、メモリ効率が良い

**検証方法:**
```typescript
// テストケース
describe('Migration interruption recovery', () => {
  it('should resume migration after browser restart', async () => {
    // 1. 移行を途中で中断
    const layers = createTestLayers(10);
    await startMigration(layers);
    await migrateNLayers(5);  // 5件だけ移行
    await forceClose();        // ブラウザを強制終了

    // 2. 再起動後に再開
    await reopenBrowser();
    await migrateToIndexedDB();

    // 3. 全データが移行されていることを確認
    const allLayersInDB = await getAllLayersFromIndexedDB();
    expect(allLayersInDB.length).toBe(10);
  });
});
```

---

#### 🔴 C-002: IndexedDB の容量超過によるデータ保存失敗

**シナリオ:**
```
1. ユーザーが 100枚の画像を保存
2. IndexedDB の容量上限（ブラウザ依存: 50MB〜数GB）に到達
3. Worker が新しいタイルを保存しようとする
→ QuotaExceededError が発生
→ データが部分的にしか保存されない
```

**影響:**
- 一部の画像が表示されない
- 移行が中断される
- ユーザーが新しい画像を追加できない

**対策:**

**【解決策1】事前に容量を確認**

```typescript
const checkStorageQuota = async (): Promise<{
  available: number;
  used: number;
  percentage: number;
}> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;

    return {
      available: quota - usage,
      used: usage,
      percentage: (usage / quota) * 100
    };
  }

  // フォールバック: 推定値
  return {
    available: 100 * 1024 * 1024,  // 100MB と仮定
    used: 0,
    percentage: 0
  };
};

export const migrateToIndexedDB = async () => {
  // 1. 移行前に容量確認
  const quota = await checkStorageQuota();

  if (quota.percentage > 80) {
    console.warn('🧑‍🎨 : Storage usage is high (${quota.percentage}%), migration may fail');
    // ユーザーに通知
    await showStorageWarning(quota);
  }

  // 2. 移行可能なサイズかチェック
  const estimatedSize = await estimateMigrationSize();

  if (estimatedSize > quota.available) {
    throw new Error(`Not enough storage: need ${estimatedSize}MB, available ${quota.available}MB`);
  }

  // 3. 移行実行
  await performMigration();
};
```

**【解決策2】容量超過時のクリーンアップ**

```typescript
// Worker 内
const saveOptimizedTiles = async (layerId: string, tiles: Record<string, ImageBitmap>) => {
  try {
    for (const [tileKey, bitmap] of Object.entries(tiles)) {
      await saveTile(layerId, tileKey, bitmap);
    }
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn('🧑‍🎨 : Storage quota exceeded, cleaning up old tiles');

      // 古いタイルを削除
      await cleanupOldestTiles(0.1);  // 10% の古いタイルを削除

      // リトライ
      await saveOptimizedTiles(layerId, tiles);
    } else {
      throw error;
    }
  }
};

const cleanupOldestTiles = async (percentage: number) => {
  // optimized_tiles から timestamp が古い順に削除
  const allTiles = await getAllOptimizedTiles();
  allTiles.sort((a, b) => a.timestamp - b.timestamp);

  const deleteCount = Math.floor(allTiles.length * percentage);
  const toDelete = allTiles.slice(0, deleteCount);

  for (const tile of toDelete) {
    await deleteOptimizedTile(tile.layerId, tile.tileKey);

    // 該当レイヤーを isOptimized: false に
    await updateLayerMetadata(tile.layerId, { isOptimized: false });
  }

  console.log(`🧑‍🎨 : Cleaned up ${deleteCount} old tiles`);
};
```

**【解決策3】ユーザーに容量不足を通知**

```typescript
// UI に警告を表示
const showStorageWarning = async (quota: StorageQuota) => {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <div class="modal">
      <h3>Storage Warning</h3>
      <p>Your browser storage is ${quota.percentage.toFixed(1)}% full.</p>
      <p>Please consider deleting old images or snapshots.</p>
      <button id="cleanup-btn">Clean up old data</button>
      <button id="cancel-btn">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);

  // ユーザーの選択を待つ
  const result = await waitForUserChoice(modal);

  if (result === 'cleanup') {
    await cleanupOldestTiles(0.2);  // 20% 削除
  }
};
```

**推奨:** 全て実装
- 解決策1: 事前チェック（移行前）
- 解決策2: 自動クリーンアップ（Worker 内）
- 解決策3: ユーザー通知（UI）

**検証方法:**
```typescript
// テストケース
describe('Storage quota handling', () => {
  it('should warn user when storage is nearly full', async () => {
    // ストレージを 85% まで埋める
    await fillStorage(0.85);

    const quota = await checkStorageQuota();
    expect(quota.percentage).toBeGreaterThan(80);

    // 移行を試みる
    await migrateToIndexedDB();

    // 警告が表示されることを確認
    expect(document.querySelector('.modal')).toBeTruthy();
  });

  it('should cleanup old tiles when quota exceeded', async () => {
    // ストレージを 100% まで埋める
    await fillStorage(1.0);

    // 新しいタイルを保存しようとする
    await expect(saveTile('layer1', 'tile1', bitmap)).rejects.toThrow('QuotaExceededError');

    // クリーンアップが自動実行される
    await cleanupOldestTiles(0.1);

    // 再試行が成功する
    await expect(saveTile('layer1', 'tile1', bitmap)).resolves.toBeUndefined();
  });
});
```

---

#### 🔴 C-003: Chrome Storage と IndexedDB の不整合

**シナリオ:**
```
1. ユーザーが IndexedDB に移行済み
2. ユーザーが画像を編集（content.ts で Chrome Storage を更新）
3. inject 側は IndexedDB を参照
→ 結果: 編集内容が反映されない
```

**影響:**
- データの二重管理による不整合
- 編集した画像が古いまま表示される

**対策:**

**【解決策】移行完了後は IndexedDB のみを使用**

```typescript
// src/features/gallery/storage.ts

export class GalleryStorage {
  private useIndexedDB: boolean = false;

  async init(): Promise<void> {
    // 移行ステータス確認
    const status = await getMigrationStatus();
    this.useIndexedDB = status.state === 'completed';
  }

  async save(item: GalleryItem): Promise<void> {
    if (this.useIndexedDB) {
      // IndexedDB に保存
      await this.saveToIndexedDB(item);

      // inject 側に通知
      window.postMessage({
        source: 'mr-wplace-layer-updated',
        layerId: item.key,
        updates: { /* ... */ }
      }, '*');
    } else {
      // Chrome Storage に保存（レガシーモード）
      await this.saveToChromeStorage(item);
    }
  }

  private async saveToIndexedDB(item: GalleryItem): Promise<void> {
    // dataUrl → Blob 変換
    const blob = await dataUrlToBlob(item.dataUrl);

    // inject 側に保存リクエスト
    window.postMessage({
      source: 'mr-wplace-save-layer',
      data: {
        layer: {
          id: item.key,
          type: 'gallery',
          visible: item.drawEnabled ?? false,
          // ...
        },
        blob
      }
    }, '*');
  }
}
```

**inject 側:**

```typescript
// src/inject/message-handler.ts

if (event.data.source === 'mr-wplace-save-layer') {
  const { layer, blob } = event.data.data;

  // 1. legacy_blobs に保存
  await layerRepository.saveLayer(layer, blob);

  // 2. レイヤーを無効化（再最適化が必要）
  await layerRepository.invalidateLayer(layer.id);

  // 3. Worker に再最適化をリクエスト
  worker.postMessage({
    type: 'MIGRATE_REQUEST',
    data: {
      layerId: layer.id,
      priority: 0  // 高優先度（すぐに反映）
    }
  });
}

if (event.data.source === 'mr-wplace-layer-updated') {
  const { layerId, updates } = event.data;

  // メタデータのみ更新
  await layerRepository.updateLayer(layerId, updates);

  // キャッシュをクリア
  layerRepository.clearCache(layerId);
}
```

**検証方法:**
```typescript
describe('Data consistency', () => {
  it('should update IndexedDB when gallery item is edited', async () => {
    // 1. 画像を保存
    const item = createGalleryItem();
    await galleryStorage.save(item);

    // 2. IndexedDB に保存されることを確認
    const layerInDB = await layerRepository.getLayerMetadata(item.key);
    expect(layerInDB).toBeTruthy();

    // 3. 画像を編集
    item.title = 'Updated Title';
    await galleryStorage.save(item);

    // 4. IndexedDB が更新されることを確認
    const updatedLayer = await layerRepository.getLayerMetadata(item.key);
    expect(updatedLayer.title).toBe('Updated Title');
  });
});
```

---

#### 🟠 C-004: IndexedDB のトランザクションエラーによるデータ破損

**シナリオ:**
```
1. Worker が画像を分割中
2. IndexedDB のトランザクションがタイムアウト
3. 一部のタイルだけ保存される
→ 結果: 画像が部分的にしか表示されない
```

**影響:**
- 画像の一部が欠ける
- 再描画しても復旧しない

**対策:**

**【解決策】トランザクション失敗時のロールバック**

```typescript
// Worker 内
const saveOptimizedTiles = async (
  layerId: string,
  tiles: Record<string, ImageBitmap>
): Promise<void> => {
  const savedTiles: string[] = [];

  try {
    // 1. 全タイルを保存
    for (const [tileKey, bitmap] of Object.entries(tiles)) {
      await saveSingleTile(layerId, tileKey, bitmap);
      savedTiles.push(tileKey);
    }

    // 2. 全成功したら isOptimized: true に
    await updateLayerMetadata(layerId, { isOptimized: true });
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save tiles for ${layerId}:`, error);

    // 3. 保存済みのタイルを全削除（ロールバック）
    for (const tileKey of savedTiles) {
      await deleteSingleTile(layerId, tileKey);
    }

    // 4. isOptimized: false のまま維持
    // （次回タイル描画時に legacy_blobs から取得される）

    throw error;
  }
};
```

**検証方法:**
```typescript
describe('Transaction error handling', () => {
  it('should rollback when tile save fails', async () => {
    const tiles = createTestTiles(10);

    // 5番目のタイルで失敗するようにモック
    mockSaveTileToFailAt(5);

    await expect(saveOptimizedTiles('layer1', tiles)).rejects.toThrow();

    // 保存済みの 4枚も削除されることを確認
    const tilesInDB = await getAllTilesForLayer('layer1');
    expect(tilesInDB.length).toBe(0);

    // isOptimized が false のまま
    const layer = await getLayerMetadata('layer1');
    expect(layer.isOptimized).toBe(false);
  });
});
```

---

### 2.2 データ安全性のまとめ

| 懸念点 | リスク | 対策 | 完了条件 |
|--------|--------|------|----------|
| C-001: 移行中断 | 🔴 Critical | ステータス管理 + 再開機能 | テスト通過 |
| C-002: 容量超過 | 🔴 Critical | 事前チェック + 自動クリーンアップ | テスト通過 |
| C-003: データ不整合 | 🔴 Critical | IndexedDB 一元管理 | テスト通過 |
| C-004: トランザクションエラー | 🟠 High | ロールバック機能 | テスト通過 |

**Phase 1 完了前に全て解決必須**

---

## 3. 優先2: 起動時のパフォーマンス

### 3.1 懸念点一覧

#### 🟠 P-001: 初回移行時のフリーズ

**シナリオ:**
```
1. ユーザーが 50枚の画像を保存済み
2. 初回起動時に migrateToIndexedDB() を実行
3. 全画像を Chrome Storage → IndexedDB に移行
→ 処理時間: 10-30秒
→ UI がフリーズ
```

**影響:**
- ユーザーが拡張機能を使えない
- ブラウザ全体が重くなる
- 悪い第一印象

**対策:**

**【解決策1】バックグラウンドで段階的に移行**

```typescript
export const migrateToIndexedDB = async (options: {
  background?: boolean;
  maxConcurrent?: number;
} = {}) => {
  const { background = true, maxConcurrent = 1 } = options;

  if (background) {
    // 1. 軽量メタデータのみ即座に移行
    await migrateLightweightMetadata();

    // 2. UI を即座に表示可能にする
    console.log('🧑‍🎨 : Lightweight migration complete, UI is ready');

    // 3. 重いデータはバックグラウンドで移行
    setTimeout(async () => {
      await migrateHeavyData({ maxConcurrent });
    }, 1000);  // 1秒後に開始
  } else {
    // 一括移行（テスト用）
    await migrateLightweightMetadata();
    await migrateHeavyData({ maxConcurrent });
  }
};

const migrateLightweightMetadata = async () => {
  // メタデータのみ移行（dataUrl は含まない）
  const allLayers = await getAllLayersFromChromeStorage();

  for (const layer of allLayers) {
    await saveLayerMetadataOnly(layer);
  }

  console.log(`🧑‍🎨 : Migrated ${allLayers.length} layer metadata`);
};

const migrateHeavyData = async (options: { maxConcurrent: number }) => {
  const allLayers = await getAllLayersFromChromeStorage();
  const queue = new ConcurrentQueue(options.maxConcurrent);

  for (const layer of allLayers) {
    queue.enqueue(async () => {
      await migrateLayerBlob(layer);
      console.log(`🧑‍🎨 : Migrated blob for ${layer.id}`);
    });
  }

  await queue.waitAll();
  console.log('🧑‍🎨 : Heavy data migration complete');
};
```

**【解決策2】プログレスバーを表示**

```typescript
const migrateLightweightMetadata = async () => {
  const allLayers = await getAllLayersFromChromeStorage();

  // プログレスバーを表示
  const progressModal = showProgressModal({
    title: 'Migrating data to new storage...',
    total: allLayers.length
  });

  for (let i = 0; i < allLayers.length; i++) {
    await saveLayerMetadataOnly(allLayers[i]);

    // 進捗更新
    progressModal.update({
      current: i + 1,
      message: `Migrating ${allLayers[i].title || 'layer'}...`
    });
  }

  progressModal.close();
};
```

**【解決策3】RequestIdleCallback で CPU 負荷を分散**

```typescript
const migrateHeavyData = async () => {
  const allLayers = await getAllLayersFromChromeStorage();

  for (const layer of allLayers) {
    // CPU がアイドル状態のときだけ実行
    await new Promise<void>((resolve) => {
      requestIdleCallback(async () => {
        await migrateLayerBlob(layer);
        resolve();
      });
    });
  }
};
```

**推奨:** 解決策1 + 解決策2
- バックグラウンド移行でUIをブロックしない
- プログレスバーでユーザーに状況を伝える

**検証方法:**
```typescript
describe('Migration performance', () => {
  it('should not freeze UI during migration', async () => {
    const layers = createTestLayers(50);

    const startTime = performance.now();

    // 移行開始
    migrateToIndexedDB({ background: true });

    // 100ms 以内に軽量移行が完了
    await waitForLightweightMigration();
    const lightweightTime = performance.now() - startTime;
    expect(lightweightTime).toBeLessThan(100);

    // UI が操作可能
    const button = document.querySelector('#gallery-button');
    expect(button).not.toBeDisabled();

    // バックグラウンド移行完了を待つ
    await waitForHeavyMigration();
  });
});
```

---

#### 🟠 P-002: IndexedDB からの読み込みが遅い

**シナリオ:**
```
1. ユーザーが拡張機能を起動
2. IndexedDB から全レイヤーのメタデータを読み込み
3. 100枚のレイヤーがある場合、読み込みに 1-2秒かかる
→ UI の初期化が遅れる
```

**影響:**
- 起動時間が延びる
- ユーザー体験の悪化

**対策:**

**【解決策1】必要最小限のデータのみ読み込み**

```typescript
// 起動時: 可視レイヤーのメタデータのみ読み込み
const loadVisibleLayersOnly = async (): Promise<LayerMetadata[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LAYERS], 'readonly');
    const store = tx.objectStore(STORES.LAYERS);
    const index = store.index('visible');
    const request = index.getAll(IDBKeyRange.only(true));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// ユーザーが非表示レイヤーを開いたときに遅延ロード
const loadInvisibleLayers = async (): Promise<LayerMetadata[]> => {
  // ... 同様の処理 ...
};
```

**【解決策2】IndexedDB のキャッシュを活用**

```typescript
class LayerMetadataCache {
  private cache: Map<string, LayerMetadata> = new Map();
  private allLoaded: boolean = false;

  async getAll(): Promise<LayerMetadata[]> {
    if (this.allLoaded) {
      return Array.from(this.cache.values());
    }

    // IndexedDB から読み込み
    const layers = await loadAllLayersFromIndexedDB();

    // キャッシュに保存
    for (const layer of layers) {
      this.cache.set(layer.id, layer);
    }

    this.allLoaded = true;
    return layers;
  }

  async get(layerId: string): Promise<LayerMetadata | null> {
    if (this.cache.has(layerId)) {
      return this.cache.get(layerId)!;
    }

    // IndexedDB から個別に読み込み
    const layer = await loadSingleLayerFromIndexedDB(layerId);
    if (layer) {
      this.cache.set(layerId, layer);
    }

    return layer;
  }

  invalidate(layerId: string): void {
    this.cache.delete(layerId);
  }
}
```

**推奨:** 解決策1 + 解決策2
- 起動時は可視レイヤーのみ読み込み
- メタデータはメモリキャッシュ

**検証方法:**
```typescript
describe('Startup performance', () => {
  it('should load visible layers quickly', async () => {
    // 100枚のレイヤーを作成（10枚のみ可視）
    await createTestLayers(100, { visibleCount: 10 });

    const startTime = performance.now();

    // 可視レイヤーのみ読み込み
    const visibleLayers = await loadVisibleLayersOnly();

    const loadTime = performance.now() - startTime;

    // 100ms 以内
    expect(loadTime).toBeLessThan(100);
    expect(visibleLayers.length).toBe(10);
  });
});
```

---

#### 🟡 P-003: Worker の初期化オーバーヘッド

**シナリオ:**
```
1. inject.ts が Worker を起動
2. Worker が IndexedDB を開く
3. 初期化に 100-200ms かかる
→ UI の初期化がブロックされる
```

**影響:**
- 起動時間が若干延びる
- ただし、Worker は非同期なので UI はブロックされない

**対策:**

**【解決策】Worker の遅延初期化**

```typescript
// inject/index.ts

let migrationWorker: Worker | null = null;

const initWorker = (): Worker => {
  if (migrationWorker) {
    return migrationWorker;
  }

  migrationWorker = new Worker(
    new URL('./workers/migration.worker.ts', import.meta.url),
    { type: 'module' }
  );

  migrationWorker.addEventListener('message', handleWorkerMessage);

  return migrationWorker;
};

// UI が完全に初期化されてから Worker を起動
window.addEventListener('load', () => {
  setTimeout(() => {
    console.log('🧑‍🎨 : Initializing migration worker');
    initWorker();
  }, 1000);  // 1秒後に起動
});
```

**推奨:** 実装する
- UI 初期化を優先
- Worker は後から起動

---

### 3.2 起動パフォーマンスのまとめ

| 懸念点 | リスク | 対策 | 目標 |
|--------|--------|------|------|
| P-001: 初回移行のフリーズ | 🟠 High | バックグラウンド移行 + プログレスバー | 軽量移行 < 100ms |
| P-002: IndexedDB 読み込み | 🟠 High | 可視レイヤーのみ + キャッシュ | 起動 < 1秒 |
| P-003: Worker 初期化 | 🟡 Medium | 遅延初期化 | - |

**Phase 1-2 で解決**

---

## 4. 優先3: 実装の複雑性

### 4.1 懸念点一覧

#### 🟡 I-001: Repository Pattern の学習コスト

**シナリオ:**
```
新しい開発者がコードを理解しようとする
→ Repository、Worker、IndexedDB の3つの層を理解する必要がある
→ 学習コストが高い
```

**影響:**
- メンテナンスが難しくなる
- バグ修正に時間がかかる

**対策:**

**【解決策1】詳細なドキュメント作成**

```markdown
# LayerRepository の使い方

## 基本的な使い方

```typescript
// タイルを取得
const bitmap = await layerRepository.getTile('layer1', '0123,0456,123,456');

// レイヤーを保存
await layerRepository.saveLayer(layerMetadata, blob);

// レイヤーを無効化（編集時）
await layerRepository.invalidateLayer('layer1');
```

## 内部動作

1. `getTile()` が呼ばれる
2. メモリキャッシュを確認
3. キャッシュになければ IndexedDB から取得
4. isOptimized が true なら optimized_tiles から、false なら legacy_blobs から取得
5. Worker に最適化をリクエスト（必要に応じて）

## トラブルシューティング

- タイルが表示されない → `clearCache()` を試す
- 編集が反映されない → `invalidateLayer()` を呼んだか確認
```

**【解決策2】型定義とコメントを充実**

```typescript
/**
 * LayerRepository - レイヤーデータの取得・保存を抽象化
 *
 * 内部状態（isOptimized）を隠蔽し、高速パス/フォールバックを自動切り替え。
 * Worker への最適化リクエストも自動送信。
 *
 * @example
 * ```typescript
 * const repo = new LayerRepository(db);
 * const bitmap = await repo.getTile('layer1', '0123,0456,123,456');
 * ```
 */
export class LayerRepository {
  /**
   * タイルを取得
   *
   * @param layerId - レイヤーID
   * @param tileKey - タイルキー (TLX,TLY,PxX,PxY)
   * @returns ImageBitmap or null
   *
   * 内部動作:
   * 1. キャッシュ確認
   * 2. isOptimized が true なら optimized_tiles から取得（高速パス）
   * 3. false なら legacy_blobs から切り出し（フォールバック）
   * 4. Worker に最適化をリクエスト（未最適化の場合）
   */
  async getTile(layerId: string, tileKey: string): Promise<ImageBitmap | null> {
    // ...
  }
}
```

**【解決策3】段階的な実装**

```
Phase 1: Worker のみ実装（既存コードはそのまま）
Phase 2: Repository を追加（既存コードと並行稼働）
Phase 3: 既存コードを Repository に置き換え
Phase 4: 古いコードを削除
```

**推奨:** 全て実装
- ドキュメントは必須
- コメントを充実させる
- 段階的に実装して影響を最小化

---

#### 🟡 I-002: Worker と Main thread の通信の複雑性

**シナリオ:**
```
Main thread と Worker 間で複雑なメッセージングが必要
→ デバッグが難しい
→ タイミング問題が発生しやすい
```

**影響:**
- バグの原因特定が困難
- テストが複雑になる

**対策:**

**【解決策1】型安全な通信ヘルパー作成**

```typescript
// src/inject/workers/messaging.ts

export type WorkerRequest =
  | { type: 'MIGRATE_REQUEST'; data: MigrateRequestData }
  | { type: 'CANCEL_MIGRATION'; data: { layerId: string } };

export type WorkerResponse =
  | { type: 'MIGRATION_COMPLETE'; layerId: string; success: boolean }
  | { type: 'MIGRATION_PROGRESS'; layerId: string; progress: number };

export class WorkerMessenger {
  private worker: Worker;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Worker にリクエストを送信
   */
  send(request: WorkerRequest): void {
    this.worker.postMessage(request);
    console.log('🧑‍🎨 : [Worker →] ', request.type, request.data);
  }

  /**
   * Worker からのレスポンスを待つ
   */
  async waitFor(type: WorkerResponse['type'], timeout = 10000): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeout);

      const handler = (data: WorkerResponse) => {
        if (data.type === type) {
          clearTimeout(timer);
          this.off(type, handler);
          resolve(data);
        }
      };

      this.on(type, handler);
    });
  }

  private handleMessage(event: MessageEvent) {
    const response: WorkerResponse = event.data;
    console.log('🧑‍🎨 : [Worker ←] ', response.type, response);

    const listeners = this.listeners.get(response.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(response);
      }
    }
  }

  private on(type: string, handler: (data: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  private off(type: string, handler: (data: any) => void): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(handler);
    }
  }
}

// 使い方
const messenger = new WorkerMessenger(worker);

messenger.send({
  type: 'MIGRATE_REQUEST',
  data: { layerId: 'layer1', priority: 0 }
});

const response = await messenger.waitFor('MIGRATION_COMPLETE');
console.log('Migration result:', response);
```

**【解決策2】ロギングを充実**

```typescript
// 全てのメッセージをログ出力
const logWorkerMessage = (direction: '→' | '←', message: any) => {
  console.log(
    `🧑‍🎨 : [Worker ${direction}]`,
    message.type,
    JSON.stringify(message.data).slice(0, 100)
  );
};
```

**推奨:** 解決策1 + 解決策2
- 型安全な通信ヘルパー
- 詳細なロギング

---

### 4.2 実装複雑性のまとめ

| 懸念点 | リスク | 対策 | 完了条件 |
|--------|--------|------|----------|
| I-001: Repository の学習コスト | 🟡 Medium | ドキュメント + コメント | ドキュメント作成 |
| I-002: Worker 通信の複雑性 | 🟡 Medium | 型安全ヘルパー + ロギング | ヘルパー実装 |

**Phase 1-2 で対策実装**

---

## 5. 優先4: 動作時のパフォーマンス

### 5.1 懸念点一覧

#### 🟡 P-004: タイル描画時の Repository オーバーヘッド

**シナリオ:**
```
1. ユーザーがマップを移動
2. 100枚のタイルが fetch される
3. 各タイルで layerRepository.getTile() が呼ばれる
→ IndexedDB へのクエリが大量発生
→ タイル描画が遅れる
```

**影響:**
- マップ移動時の体感速度低下
- スクロールがカクつく

**対策:**

**【解決策1】メモリキャッシュの活用**

```typescript
class LayerRepository {
  private tileCache: Map<string, ImageBitmap>;
  private maxCacheSize: number = 100;  // 最大100枚キャッシュ

  async getTile(layerId: string, tileKey: string): Promise<ImageBitmap | null> {
    const cacheKey = `${layerId}:${tileKey}`;

    // キャッシュヒット
    if (this.tileCache.has(cacheKey)) {
      return this.tileCache.get(cacheKey)!;
    }

    // IndexedDB から取得
    const bitmap = await this.fetchTileFromDB(layerId, tileKey);

    if (bitmap) {
      // キャッシュに追加
      this.addToCache(cacheKey, bitmap);
    }

    return bitmap;
  }

  private addToCache(key: string, bitmap: ImageBitmap): void {
    // キャッシュサイズ超過時は古いものを削除
    if (this.tileCache.size >= this.maxCacheSize) {
      const oldestKey = this.tileCache.keys().next().value;
      const oldBitmap = this.tileCache.get(oldestKey)!;
      oldBitmap.close();  // メモリ解放
      this.tileCache.delete(oldestKey);
    }

    this.tileCache.set(key, bitmap);
  }
}
```

**【解決策2】先読みキャッシュ**

```typescript
const prefetchTilesForViewport = async (viewport: Viewport) => {
  // 可視範囲 + 周辺のタイルを先読み
  const tilesToPrefetch = calculateTilesInViewport(viewport, { margin: 1 });

  for (const tileKey of tilesToPrefetch) {
    for (const layerId of visibleLayers) {
      // 非同期で先読み（ブロックしない）
      layerRepository.getTile(layerId, tileKey).catch(() => {
        // エラーは無視（先読みなので）
      });
    }
  }
};
```

**推奨:** 解決策1 + 解決策2
- メモリキャッシュは必須
- 先読みは optional（効果を測定してから判断）

---

#### 🟢 P-005: Worker の処理待ち時間

**シナリオ:**
```
1. ユーザーが画像を配置
2. Worker が分割処理を開始
3. 処理が完了するまで数秒かかる
→ ユーザーは待たされる
```

**影響:**
- 画像配置時の体感速度低下
- ただし、UI はブロックされない

**対策:**

**【解決策】優先度付きキュー**

```typescript
// Worker 内
class PriorityQueue {
  private queue: Array<{ task: MigrationTask; priority: number }> = [];

  enqueue(task: MigrationTask, priority: number): void {
    this.queue.push({ task, priority });
    this.queue.sort((a, b) => a.priority - b.priority);  // 昇順ソート
  }

  dequeue(): MigrationTask | null {
    const item = this.queue.shift();
    return item ? item.task : null;
  }
}

// 使い方
// 優先度 0 = ユーザーが今見ている画像（即座に処理）
// 優先度 1 = バックグラウンド処理（暇なときに処理）
queue.enqueue(task, priority);
```

**推奨:** 実装する
- ユーザー操作を優先
- バックグラウンド処理は後回し

---

### 5.2 動作パフォーマンスのまとめ

| 懸念点 | リスク | 対策 | 目標 |
|--------|--------|------|------|
| P-004: Repository オーバーヘッド | 🟡 Medium | メモリキャッシュ + 先読み | タイル取得 < 16ms |
| P-005: Worker 処理待ち | 🟢 Low | 優先度付きキュー | - |

**Phase 2-3 で対策実装**

---

## 6. その他の懸念点

### 6.1 ブラウザ互換性

#### 🟡 B-001: Firefox の IndexedDB 制限

**シナリオ:**
```
Firefox の Private Browsing モードでは IndexedDB が無効
→ 拡張機能が動作しない
```

**影響:**
- 一部のユーザーが拡張機能を使えない

**対策:**

**【解決策】Chrome Storage へのフォールバック**

```typescript
const initStorage = async (): Promise<IStorage> => {
  try {
    // IndexedDB が使えるか確認
    const db = await openDatabase();
    db.close();

    return new IndexedDBStorage();
  } catch (error) {
    console.warn('🧑‍🎨 : IndexedDB not available, fallback to Chrome Storage');

    // Chrome Storage を使用
    return new ChromeStorage();
  }
};
```

**推奨:** 実装する
- ユーザー体験を損なわないため

---

#### 🟢 B-002: Safari の制限

**シナリオ:**
```
Safari は Web Worker の module import をサポートしていない
→ Worker が起動しない
```

**影響:**
- Safari ユーザーが拡張機能を使えない
- ただし、Safari ユーザーは少数

**対策:**

**【解決策】Worker なしモード**

```typescript
const initWorker = (): Worker | null => {
  try {
    return new Worker(
      new URL('./workers/migration.worker.ts', import.meta.url),
      { type: 'module' }
    );
  } catch (error) {
    console.warn('🧑‍🎨 : Worker not supported, using fallback mode');
    return null;
  }
};

// Worker が使えない場合は Main thread で処理
if (!worker) {
  await migrateLayerInMainThread(layerId);
}
```

**推奨:** Phase 4 で実装
- Safari サポートは optional

---

### 6.2 メモリ管理

#### 🟠 M-001: ImageBitmap のメモリリーク

**シナリオ:**
```
1. Worker が画像を分割
2. ImageBitmap を大量生成
3. close() を忘れる
→ メモリリーク
```

**影響:**
- ブラウザがクラッシュ
- パフォーマンス低下

**対策:**

**【解決策1】明示的な close() 呼び出し**

```typescript
// Worker 内
const migrateLayer = async (layerId: string) => {
  const bitmap = await createImageBitmap(blob);

  try {
    const tiles = await splitImageOnTiles(bitmap, layerId);

    await saveOptimizedTiles(layerId, tiles);

    // タイルも close()
    for (const tile of Object.values(tiles)) {
      tile.close();
    }
  } finally {
    // 必ず close()
    bitmap.close();
  }
};
```

**【解決策2】WeakMap でトラッキング**

```typescript
class ImageBitmapTracker {
  private bitmaps = new WeakMap<ImageBitmap, { id: string; createdAt: number }>();

  track(bitmap: ImageBitmap, id: string): void {
    this.bitmaps.set(bitmap, { id, createdAt: Date.now() });
  }

  closeAll(): void {
    // WeakMap なので自動的にガベージコレクションされる
    // ただし、明示的に close() したほうが良い
  }
}
```

**推奨:** 解決策1
- finally ブロックで確実に close()

**検証方法:**
```typescript
describe('Memory management', () => {
  it('should close all ImageBitmaps', async () => {
    const initialMemory = performance.memory.usedJSHeapSize;

    // 大量の画像を処理
    for (let i = 0; i < 100; i++) {
      await migrateLayer(`layer${i}`);
    }

    // メモリが増加していないことを確認
    const finalMemory = performance.memory.usedJSHeapSize;
    const increase = finalMemory - initialMemory;

    expect(increase).toBeLessThan(10 * 1024 * 1024);  // 10MB 以下
  });
});
```

---

## 7. 総合リスク評価

### 7.1 Critical リスク（Phase 1 完了前に解決必須）

| ID | 懸念点 | 対策 | 完了 |
|----|--------|------|------|
| C-001 | 移行中断によるデータ消失 | ステータス管理 + 再開機能 | ⬜ |
| C-002 | IndexedDB 容量超過 | 事前チェック + 自動クリーンアップ | ⬜ |
| C-003 | データ不整合 | IndexedDB 一元管理 | ⬜ |
| C-004 | トランザクションエラー | ロールバック機能 | ⬜ |

### 7.2 High リスク（Phase 1-2 で解決）

| ID | 懸念点 | 対策 | 完了 |
|----|--------|------|------|
| P-001 | 初回移行のフリーズ | バックグラウンド移行 | ⬜ |
| P-002 | IndexedDB 読み込み遅延 | 可視レイヤーのみ読み込み | ⬜ |
| M-001 | ImageBitmap メモリリーク | finally で close() | ⬜ |

### 7.3 Medium リスク（Phase 2-3 で解決）

| ID | 懸念点 | 対策 | 完了 |
|----|--------|------|------|
| I-001 | Repository の学習コスト | ドキュメント作成 | ⬜ |
| I-002 | Worker 通信の複雑性 | 型安全ヘルパー | ⬜ |
| P-004 | Repository オーバーヘッド | メモリキャッシュ | ⬜ |
| B-001 | Firefox Private モード | Chrome Storage フォールバック | ⬜ |

### 7.4 Low リスク（Phase 4 または次バージョン）

| ID | 懸念点 | 対策 | 完了 |
|----|--------|------|------|
| P-003 | Worker 初期化オーバーヘッド | 遅延初期化 | ⬜ |
| P-005 | Worker 処理待ち時間 | 優先度付きキュー | ⬜ |
| B-002 | Safari 非対応 | Worker なしモード | ⬜ |

### 7.5 実装優先順位

**Phase 1 完了条件:**
- [ ] C-001 〜 C-004 の全 Critical リスクを解決
- [ ] Worker Infrastructure の実装
- [ ] 移行ロジックの実装
- [ ] テスト通過率 100%

**Phase 2 完了条件:**
- [ ] P-001, P-002, M-001 の High リスクを解決
- [ ] Repository Pattern の実装
- [ ] IndexedDB スキーマの実装
- [ ] ドキュメント作成

**Phase 3 完了条件:**
- [ ] I-001 〜 B-001 の Medium リスクを解決
- [ ] 既存コードの統合
- [ ] パフォーマンス測定

**Phase 4 完了条件:**
- [ ] Low リスクの対策実装（optional）
- [ ] 古いコードの削除
- [ ] 最終テスト

---

## まとめ

本ドキュメントでは、migration_plan.md の実装における懸念点を、ユーザー指定の優先順位に沿って詳細に分析しました。

**最重要ポイント:**
1. **データの安全性**: 移行中断、容量超過、データ不整合への対策は Phase 1 完了前に必須
2. **起動パフォーマンス**: バックグラウンド移行とプログレスバーで体感速度を維持
3. **実装の複雑性**: ドキュメントと型安全ヘルパーで学習コストを削減
4. **メモリ管理**: ImageBitmap の明示的な close() でリークを防止

次のステップとして、`testing-strategy.md` でテスト方針を記述します。
