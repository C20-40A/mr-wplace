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
  - `states-inject.ts`: WASM不使用の状態管理
  - `utils/splitImageOnTiles-inject.ts`: Canvas API のみで画像分割
  - その他: content 側からコピーして import パス修正
- `src/inject/fetch-interceptor.ts`: tile-draw を使用
- `src/inject/message-handler.ts`: gallery/compute-device/color-filter/snapshots の受信
- `src/inject/types.ts`: 型定義追加 (SnapshotImage 等)

**content 側 (削除・簡略化):**
- `src/features/tile-draw/` 削除 ❌
- `src/inject/tile-processor.ts` 削除 ❌
- `src/features/tile-overlay/index.ts` 簡略化 (96行 → 75行)
- `src/utils/inject-bridge.ts` (NEW): content ↔ inject 通信関数群
- `src/content.ts`: データ送信関数追加
  - `sendGalleryImagesToInject()`
  - `sendComputeDeviceToInject()`
  - `sendColorFilterToInject()`
  - `sendSnapshotsToInject()`

### メリット
✅ Firefox の extension context セキュリティ制約を完全回避
✅ WASM エラーを根本解決
✅ content.js が 345KB → 332KB に削減 (約13KB削減)
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
✅ データ変更時は必ず send*ToInject() を呼ぶ
✅ async/await で適切に待機

### 統計の事前計算機能 (2025-11-01)

#### 背景

タイルレンダリング時にのみ統計が計算される仕組みでは、以下の問題がありました：
- 画像配置直後に統計を見ようとしても、タイルがまだレンダリングされていない
- カラーフィルター画面で統計が表示されない
- paint-stats が表示されない

#### 解決策

**画像追加時とカラーフィルター変更時に統計を事前計算**

1. **画像追加時** (`states-inject.ts`):
   - `addImageToOverlayLayers()` で画像が追加されたとき
   - `computeStatsInBackground()` をバックグラウンドで実行
   - 各タイルの背景を fetch して統計を計算
   - `perTileColorStats` に保存

2. **カラーフィルター変更時** (`message-handler.ts`):
   - `handleColorFilterUpdate()` でフィルターが変更されたとき
   - `recomputeAllStats()` で全画像の統計を再計算

3. **統計計算ロジック** (`computeStatsForImage.ts`):
   - 各タイルの背景を `https://backend.wplace.live/tiles/${tileX}/${tileY}.png` から fetch
   - 画像ピクセルと背景ピクセルを比較
   - カラーフィルターを適用（必要な場合）
   - `matched` と `total` カウントを計算

#### 利点

- ✅ 画像配置直後に統計が利用可能
- ✅ ユーザーがタイルを訪問する前に統計が見られる
- ✅ カラーフィルター変更時に自動で統計が更新される
- ✅ バックグラウンドで非同期に実行されるため、UI がブロックされない

#### 制限事項

- 背景タイルを fetch するため、ネットワークリクエストが発生
- 大きな画像の場合、多くのタイルの fetch が必要
- 統計計算は非同期で行われるため、即座には利用できない場合がある（通常1-2秒）

#### エラー対策とパフォーマンス改善 (2025-11-01)

**問題1**: 統計計算がタイル描画と競合し、`InvalidStateError: The source image could not be decoded` エラーが発生

**解決策**:
1. **遅延実行**: 画像追加後、2秒待ってから統計計算を開始（タイル描画を優先）
2. **順次処理**: タイルを10個ごとに100ms待機して順次処理（並列fetch数を制限）
3. **タイムアウト**: fetch に5秒のタイムアウトを設定（ハング防止）
4. **エラーハンドリング強化**:
   - fetch 失敗時は null を返す（エラーをthrowしない）
   - デコード失敗時はそのタイルをスキップ
   - エラーログは警告レベルに下げる（大量のログを防ぐ）
5. **画像ごとに順次処理**: 複数画像の統計再計算も順次実行（並列実行を避ける）

**問題2**: data saver ON のときに統計計算がエラーになる

**原因**: data saver ON のときは、タイルがキャッシュされるまで fetch できない

**解決策**:
- **data saver ON 時はスキップ**: 統計の事前計算をスキップ
- タイルレンダリング時の統計計算は引き続き動作するため、タイルを訪問すれば統計は計算される

#### 実装ファイル

- `src/inject/tile-draw/utils/computeStatsForImage.ts` - 統計計算ロジック
- `src/inject/tile-draw/states-inject.ts` - 画像追加時の統計計算
- `src/inject/message-handler.ts` - カラーフィルター変更時の統計再計算

### 完了日: 2025-11-01

全ての描画関連機能 (gallery, snapshots, text-draw, auto-spoit, paint-stats) が inject 側で動作確認済み。
統計の事前計算機能が追加され、画像配置直後に統計が利用可能になった。
