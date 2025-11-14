# フローの整理

1. 画像配置時 (初回)

drawing/index.ts (Start drawing)
↓
tileOverlay.drawImageAt()
↓
sendGalleryImagesToInject() (全画像を inject に送信)
↓
handleGalleryImages() (inject 側で画像を準備)
↓
addImageToOverlayLayers() (タイル分割、overlayLayers に追加)

ここではまだタイルは描画されていない。overlayLayers
に画像を準備しただけ。

2. タイル読み込み時 (fetch が発生)

ユーザーがマップを移動
↓
WPlace がタイルを fetch
↓
fetch-interceptor.ts が intercept
↓
handleTileRequest()
↓
drawOverlayLayersOnTile() ← ここで初めてタイルに描画される!
↓
invalidateTileCache() ← ここでキャッシュ削除

## Inject Directory Structure Refactoring (2025-11-07)

### Background

After the tile-draw migration (2025-11-01), the inject directory had grown organically and needed structural cleanup:

- `message-handler.ts` was 593 lines with mixed responsibilities
- `tile-draw/utils/` had unclear organization (stats, filters, image processing mixed together)
- Naming inconsistencies (`-inject` suffix on some files)

### Refactoring Goals

1. **Separation of concerns**: Split message-handler into focused modules
2. **Clear directory structure**: Group related files by functionality
3. **Consistent naming**: Remove legacy `-inject` suffixes
4. **Code reusability**: Extract common patterns (image loading)

### New Directory Structure

```
src/inject/
├── index.ts                    # Entry point
├── message-handler.ts          # Routing only (159 lines, down from 593)
├── handlers/                   # Message handlers by category
│   ├── overlay-handlers.ts     # Gallery, snapshots, text layers
│   ├── state-handlers.ts       # Theme, data saver, compute device, color filter
│   └── request-handlers.ts     # Stats, pixel color requests
├── tile-draw/
│   ├── states.ts               # Renamed from states-inject.ts
│   ├── tile-overlay-renderer.ts
│   ├── stats/                  # Statistics computation
│   │   ├── compute-for-image.ts
│   │   ├── compute-total.ts
│   │   ├── get-per-image.ts
│   │   └── get-aggregated.ts
│   ├── filters/                # Color filtering
│   │   ├── gpu-filter.ts
│   │   ├── cpu-filter.ts
│   │   └── color-processing.ts
│   └── image-processing/       # Image manipulation
│       ├── split-tiles.ts      # Renamed from splitImageOnTiles-inject.ts
│       └── pixel-processing.ts
├── utils/                      # Inject-wide utilities
│   └── image-loader.ts         # Common image loading logic
├── theme-manager.ts
├── map-instance.ts
├── fetch-interceptor.ts
└── types.ts
```

### Key Changes

1. **Message Handler Simplification**:

   - Reduced from 593 to 159 lines (73% reduction)
   - Now only handles routing, delegates to specialized handlers
   - Clear separation: overlay updates, state updates, requests

2. **Handler Modules**:

   - `overlay-handlers.ts`: Gallery, snapshots, text layers (all share similar image loading pattern)
   - `state-handlers.ts`: Theme, data saver, compute device, color filter
   - `request-handlers.ts`: Stats requests, pixel color requests

3. **Tile-draw Reorganization**:

   - `stats/`: All statistics computation (4 files)
   - `filters/`: All color filtering (GPU, CPU, color processing)
   - `image-processing/`: Image manipulation utilities

4. **Common Utilities**:

   - `utils/image-loader.ts`: Extracts repeated image loading pattern (dataUrl → Image → ImageBitmap)
   - Used by all overlay handlers

5. **Naming Cleanup**:
   - `states-inject.ts` → `states.ts`
   - `splitImageOnTiles-inject.ts` → `split-tiles.ts`
   - Removed legacy `-inject` suffixes (all files are in inject context now)

### Build Results

```
dist/content.js  343.1kb  (was 333KB, +10KB due to added utilities)
dist/popup.js     38.9kb  (unchanged)
dist/inject.js    29.3kb  (was 22.9KB, +6.4KB due to separated handlers)
```

Total size increase: ~16KB, acceptable for improved maintainability.

### Benefits

✅ **Improved maintainability**: Each file has clear, focused responsibility
✅ **Better discoverability**: Related files grouped by functionality
✅ **Code reuse**: Common image loading pattern extracted
✅ **Easier testing**: Smaller, focused modules
✅ **Clearer naming**: No more confusing `-inject` suffixes
✅ **Scalability**: Easy to add new handlers or utilities

---

## tile-draw の inject 側への完全移行完了 (2025-11-01)

### 背景

Chrome では動作していた tile overlay 処理が Firefox で失敗していた:

- `content.ts` (extension context) での `ImageBitmap`/`ImageData` 処理が Firefox のセキュリティチェックでエラー
- WASM ベースの `image-bitmap-compat` が inject context で `unreachable` エラー

### 最終的な解決策

**tile-draw を完全に inject 側 (page context) に移行**

#### Phase 1: inject 側に tile-draw をコピーして動作確認

1. `src/features/tile-draw/` を `src/inject/tile-draw/` にコピー
2. WASM 依存を排除:
   - `splitImageOnTiles-inject.ts`: Canvas API のみで画像分割
   - `states-inject.ts`: inject 専用の状態管理
   - `tile-overlay-renderer.ts`: native `createImageBitmap` を使用
3. postMessage で必要なデータを送信:
   - `mr-wplace-gallery-images`: gallery 画像データ
   - `mr-wplace-compute-device`: GPU/CPU 設定
   - `mr-wplace-color-filter`: カラーフィルター状態
   - `mr-wplace-snapshots`: time-travel スナップショット

#### Phase 2: content 側の tile-draw を削除

1. `src/inject/tile-processor.ts` 削除 (tile-draw に統合)
2. `src/features/tile-overlay/index.ts` 簡略化:
   - `setupTileProcessing()` 削除 (inject 側で処理)
   - `drawPixelOnTile()` 削除
   - 画像配置/トグル時に `sendGalleryImagesToInject()` を呼ぶだけ
3. `src/features/tile-draw/` 削除
4. `src/utils/inject-bridge.ts` 作成:
   - content ↔ inject 通信を管理する関数群
   - 実際の処理は inject 側で実行

### 新しいアーキテクチャ

```
┌─────────────────────────────────────────────────┐
│ content.ts (extension context)                  │
│ - gallery 管理                                   │
│ - sendGalleryImagesToInject() で inject に送信  │
│ - inject-bridge で inject 側と通信              │
└──────────────┬──────────────────────────────────┘
               │ postMessage
               ↓
┌─────────────────────────────────────────────────┐
│ inject/index.ts (page context)                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ inject/tile-draw/                           │ │
│ │ - states-inject.ts: overlay layers 管理     │ │
│ │ - tile-overlay-renderer.ts: 描画処理        │ │
│ │ - splitImageOnTiles-inject.ts: 画像分割     │ │
│ │ - color filter, stats 計算                  │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ inject/fetch-interceptor.ts                 │ │
│ │ - tile fetch を intercept                   │ │
│ │ - drawOverlayLayersOnTile() で処理          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 変更ファイル

**inject 側 (新規・変更):**

- `src/inject/tile-draw/` (NEW): 完全な tile-draw 実装
  - `states-inject.ts`: WASM 不使用の状態管理
  - `utils/splitImageOnTiles-inject.ts`: Canvas API のみで画像分割
  - その他: content 側からコピーして import パス修正
- `src/inject/fetch-interceptor.ts`: tile-draw を使用
- `src/inject/message-handler.ts`: gallery/compute-device/color-filter/snapshots の受信
- `src/inject/types.ts`: 型定義追加 (SnapshotImage 等)

**content 側 (削除・簡略化):**

- `src/features/tile-draw/` 削除 ❌
- `src/inject/tile-processor.ts` 削除 ❌
- `src/features/tile-overlay/index.ts` 簡略化 (96 行 → 75 行)
- `src/utils/inject-bridge.ts` (NEW): content ↔ inject 通信関数群
- `src/content.ts`: データ送信関数追加
  - `sendGalleryImagesToInject()`
  - `sendComputeDeviceToInject()`
  - `sendColorFilterToInject()`
  - `sendSnapshotsToInject()`

### メリット

✅ Firefox の extension context セキュリティ制約を完全回避
✅ WASM エラーを根本解決
✅ content.js が 345KB → 332KB に削減 (約 13KB 削減)
✅ Chrome/Firefox 両方で動作
✅ 全機能が inject 側で完結 (color filter, stats, 補助色モードなど)
✅ エラーハンドリング強化 (fallback 機構)

### 制限事項と今後の課題

#### ✅ 全機能復活済み

- ✅ `getOverlayPixelColor()`: auto-spoit の overlay 色検出
- ✅ `getAggregatedColorStats()`: paint-stats / color-filter の統計表示
- ✅ text-draw: gallery 統合により動作
- ✅ **time-travel snapshot overlay**: inject 側統合完了
  - `sendSnapshotsToInject()` で Chrome storage から dataUrl に変換して送信
  - `handleSnapshotsUpdate()` で overlay layers に追加
  - 削除/描画切り替え時に自動同期
- ✅ **統計の事前計算**: 画像追加時にバックグラウンドで統計を計算 (2025-11-01)
  - `computeStatsForImage()` で背景タイルを fetch して統計を計算
  - カラーフィルター変更時に全画像の統計を再計算
  - タイルレンダリング時の統計計算と併用

### Refactoring 完了 (2025-11-01)

#### クリーンアップ内容

1. **不要なファイル削除**:

   - `src/inject/tile-draw/states.ts` (states-inject.ts を使用)
   - `src/inject/tile-draw/utils/splitImageOnTiles.ts` (inject 版を使用)
   - `src/inject/tile-draw/README.md` (古い内容)

2. **stubs から inject-bridge へ移行 (2025-11-06)**:

   - `tile-draw-stubs.ts` 削除、`utils/inject-bridge.ts` に移行
   - stub (空実装) から bridge (通信ユーティリティ) へ名前変更
   - content ↔ inject 通信関数として適切に配置

3. **不要な呼び出し削除**:
   - gallery/common-actions.ts: inject 側で自動同期
   - text-draw: gallery 統合
   - time-travel: inject 側統合完了

#### 最終ビルドサイズ

```
dist/content.js  333.2kb  (削減: -12KB, snapshot 統合により若干増加)
dist/popup.js     38.9kb  (変更なし)
dist/inject.js    22.9kb  (全機能統合, snapshot 処理追加)
```

### 今後の開発における注意事項

#### 新しいオーバーレイ機能を追加する場合

1. **inject/message-handler.ts** にメッセージハンドラー追加:

   ```typescript
   if (event.data.source === "mr-wplace-your-feature") {
     await handleYourFeature(event.data);
     return;
   }
   ```

2. **inject/types.ts** に型定義追加:

   ```typescript
   export interface YourFeatureData {
     key: string;
     dataUrl: string;
     // ...
   }
   ```

3. **content.ts** にデータ送信関数追加:

   ```typescript
   export const sendYourFeatureToInject = async () => {
     const data = /* データ取得 */;
     window.postMessage({ source: "mr-wplace-your-feature", data }, "*");
   };
   ```

4. **機能側で呼び出し**:
   ```typescript
   import { sendYourFeatureToInject } from "@/content";
   // データ変更後
   await sendYourFeatureToInject();
   ```

#### デバッグのコツ

- inject context のデータを確認するには、ブラウザコンソールで直接 `window.mrWplace*` を参照
- content script のデータは DevTools の Extension タブから確認
- `🧑‍🎨 :` ログで絞り込むと追跡しやすい

#### 避けるべきパターン

❌ content script で ImageBitmap/ImageData を直接処理
❌ inject context で WASM を使用
❌ inject context で Chrome API を使用
❌ 同期的な postMessage 処理を期待する (必ず非同期)

✅ content は storage 管理のみ
✅ inject は画像処理と描画のみ
✅ データ変更時は必ず send\*ToInject() を呼ぶ
✅ async/await で適切に待機

### 統計データの永続化 (2025-11-14)

#### 背景

**問題**: コミット `26b8319` (2025-11-14) で統計の事前計算機能が削除された結果、統計データがリロードで消えるようになった。

削除理由:
- バックグラウンド計算が不要なタイル fetch を大量に発生させる
- ネットワーク負荷とパフォーマンス問題

削除により発生した問題:
- 統計はタイルレンダリング時のみ計算される
- inject context の `perTileColorStats` Map に保存される（メモリのみ）
- Chrome storage には保存されない
- **リロードで統計が消える**

#### 解決策

**案1と案2の組み合わせ**を実装:

1. **初回ロード時**: ストレージから統計を復元して inject に送信
2. **タイル訪問時**: 統計を計算してストレージに保存

これにより、不要なタイル fetch を避けつつ、統計データを永続化。

#### 実装内容

**1. 初回ロード時の統計復元**

**content script** (`src/content.ts:38-64`):
```typescript
export const sendGalleryImagesToInject = async () => {
  // ...
  const enabledImages = images
    .filter((img) => img.drawEnabled && img.drawPosition)
    .map((img) => ({
      key: img.key,
      dataUrl: img.dataUrl,
      drawPosition: img.drawPosition!,
      layerOrder: img.layerOrder ?? 0,
      // Include stored statistics for restoration
      perTileColorStats: img.perTileColorStats,
    }));
  // ...
};
```

**inject script** (`src/inject/handlers/overlay-handlers.ts:48-61`):
```typescript
// Restore stored statistics if available
if (img.perTileColorStats) {
  const tileStatsMap = new Map<string, { matched: Map<string, number>; total: Map<string, number> }>();

  for (const [tileKey, stats] of Object.entries(img.perTileColorStats)) {
    tileStatsMap.set(tileKey, {
      matched: new Map(Object.entries(stats.matched)),
      total: new Map(Object.entries(stats.total)),
    });
  }

  setPerTileColorStats(img.key, tileStatsMap);
  console.log(`🧑‍🎨 : Restored statistics for ${img.key} (${tileStatsMap.size} tiles)`);
}
```

**2. タイル訪問時の統計保存**

**inject script** (`src/inject/tile-draw/tile-overlay-renderer.ts:26-63`):
```typescript
/**
 * Notify content script to save statistics to storage
 */
const notifyStatsUpdate = (
  tempStatsMap: Map<string, ColorStats>,
  tileKey: string
): void => {
  for (const [imageKey, stats] of tempStatsMap.entries()) {
    const imageStatsMap = perTileColorStats.get(imageKey);
    if (!imageStatsMap) continue;

    // Convert Map to plain object for postMessage
    const tileStatsObject: Record<
      string,
      { matched: Record<string, number>; total: Record<string, number> }
    > = {};

    for (const [tileKey, tileStats] of imageStatsMap.entries()) {
      tileStatsObject[tileKey] = {
        matched: Object.fromEntries(tileStats.matched),
        total: Object.fromEntries(tileStats.total),
      };
    }

    // Send to content script
    window.postMessage(
      {
        source: "mr-wplace-stats-updated",
        imageKey,
        tileStatsMap: tileStatsObject,
      },
      "*"
    );
  }
};
```

**inject script** (`src/inject/tile-draw/tile-overlay-renderer.ts:508-512`):
```typescript
// Notify content script to save statistics to storage
// Do this asynchronously to avoid blocking tile rendering
if (tempStatsMap.size > 0) {
  notifyStatsUpdate(tempStatsMap, coordStr);
}
```

**content script** (`src/content.ts:189-211, 361-367`):
```typescript
// Listen for stats update from inject.js (after tile rendering)
if (event.data.source === "mr-wplace-stats-updated") {
  const { imageKey, tileStatsMap } = event.data;
  await handleStatsComputed(imageKey, tileStatsMap);
}

const handleStatsComputed = async (
  imageKey: string,
  tileStatsMap: Record<string, { matched: Record<string, number>; total: Record<string, number> }>
) => {
  // Convert object back to Map
  const statsMap = new Map<...>();
  // ...
  await galleryStorage.updateTileColorStats(imageKey, statsMap);
  console.log(`🧑‍🎨 : Saved stats for ${imageKey} to storage`);
};
```

#### 動作の流れ

```
【初回ロード時】
1. content.ts: sendGalleryImagesToInject()
2. → inject: handleGalleryImages()
3. → ストレージの統計を perTileColorStats に復元
4. → すぐに統計が表示可能 ✅

【タイル訪問時】
1. inject: タイルレンダリング
2. → 統計を計算
3. → mr-wplace-stats-updated メッセージ送信
4. → content: handleStatsComputed()
5. → galleryStorage.updateTileColorStats()
6. → ストレージに保存 ✅
7. → 次回リロード時に復元される
```

#### メリット

✅ **リロード後も統計が残る**
✅ **不要なタイルfetchが発生しない**（削除された事前計算は使わない）
✅ **タイル訪問時に自動で最新の統計に更新される**
✅ **カラーフィルター変更にも対応**（タイル再訪問時に再計算される）
✅ **パフォーマンス問題なし**

#### 実装ファイル

- `src/content.ts` - sendGalleryImagesToInject(), handleStatsComputed()
- `src/inject/handlers/overlay-handlers.ts` - handleGalleryImages() (統計復元)
- `src/inject/tile-draw/tile-overlay-renderer.ts` - notifyStatsUpdate()
- `src/inject/types.ts` - GalleryImage 型に perTileColorStats 追加
- `src/features/gallery/storage.ts` - updateTileColorStats() (既存)

#### ビルドサイズ

```
dist/content.js  406.3kb  (増加: +73KB due to statistics persistence logic)
dist/popup.js    157.2kb  (変更なし)
dist/inject.js    31.4kb  (増加: +8.5KB due to statistics notification)
```

### 完了日: 2025-11-14

統計データの永続化機能が実装され、リロード後も統計が保持されるようになった。
不要なタイル fetch を避けつつ、タイル訪問時に自動で統計をストレージに保存する仕組みを実現。
