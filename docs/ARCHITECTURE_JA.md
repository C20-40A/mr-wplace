# Mr. Wplace アーキテクチャ概要

## 画像データの状態遷移と処理フロー

### データ形式の変化

```
[状態A: アップロード直後]
Chrome Storage: metadata + dataUrl(base64)
IndexedDB: なし

↓ 5秒後（inject側で自動保存）

[状態B: IndexedDB保存完了]
Chrome Storage: metadata + dataUrl(base64) + thumbnail
IndexedDB legacy_blobs: 元画像Blob

↓ 5秒後（Doctor cleanup）

[状態C: Doctor cleanup完了]
Chrome Storage: metadata + thumbnail + stats
IndexedDB legacy_blobs: 元画像Blob

↓ Worker migration完了（バックグラウンド）

[状態D: 最適化完了]
Chrome Storage: metadata + thumbnail + stats
IndexedDB optimized_tiles: 1000x1000分割タイル群
IndexedDB layers: isOptimized=true
```

### データ保存先の詳細

**Chrome Storage（5MB制限）:**
- metadata: key, timestamp, drawPosition, layerOrder, drawEnabled
- thumbnail: 128x128サムネイル（Doctor生成）
- stats: タイルごとの色統計（matched/total）
- ~~dataUrl~~: Doctor cleanupで削除（状態C以降）

**IndexedDB mr-wplace-gallery（無制限）:**
- `layers`: メタデータ（isOptimized, bounds, coords）
- `legacy_blobs`: 元画像Blob（フォールバック用）
- `optimized_tiles`: 1000x1000タイル（複合キー: [layerId, tileKey]）
- `statistics`: タイルごとの色統計（永続化）

**IndexedDB mr-wplace-cache（処理済みタイルキャッシュ）:**
- `tiles`: 描画済みタイル（キー: "tileX,tileY"）
- LRU削除: 100タイル超過時

---

## 各機能の役割

### Gallery（画像管理）

**場所:** `src/states/galleryStorage.ts`, `src/features/gallery/`

**役割:**
- Chrome Storageへの画像保存・取得
- `getAll({ fullImage: true })`: IndexedDBから完全な画像取得
- `getAll()`: サムネイルのみ取得（軽量）

**送信:** `src/core/bridge/gallery-bridge.ts`
- `sendGalleryImagesToInject()`: サムネイルのみ送信（dataUrlは空の可能性）

### Doctor（ストレージ最適化）

**場所:** `src/features/doctor/`

**実行タイミング:** 拡張初期化から5秒後（自動）

**処理:**
1. `gallery_index`の`cleaned !== true`なアイテムを検出
2. サムネイル生成（なければIndexedDBから生成）
3. **dataUrlフィールドのみ削除**（metadata/stats/thumbnailは保持）
4. `cleaned: true`マーク
5. 500ms間隔で1件ずつ処理（Chrome凍結防止）

**重要:** IndexedDBへの保存確認は**しない**（inject側が自動保存する前提）

### Migration（タイル最適化）

**場所:** `src/inject/workers/migration.worker.ts`

**処理フロー:**
```
1. legacy_blobsから元画像取得
2. ImageBitmap化
3. 1000x1000単位で分割（OffscreenCanvas使用）
4. 透明タイル除外（10px未満の可視ピクセル）
5. optimized_tilesに保存
6. layers.isOptimized = true に更新
```

**実行:**
- バックグラウンド（優先度: LOW）
- 新規画像保存時に自動キュー
- 非最適化レイヤー描画時に再キュー

**最適化効果:**
- ストレージ削減: 透明タイルスキップ
- 読み込み高速化: 必要なタイルのみロード
- メモリ削減: 全体をロードせずタイル単位

### Tile Draw（描画処理）

**場所:** `src/inject/tile-draw/tile-overlay-renderer.ts`

**3つのロード戦略:**

**戦略A: dataUrlから直接（状態A〜B）**
- 条件: `img.dataUrl && img.dataUrl !== ""`
- ソース: Chrome Storage
- 処理: メモリ上で1000x1000分割 → 即座にレンダリング

**戦略B: 最適化IndexedDB（状態D）**
- 条件: `isOptimized === true`
- ソース: `optimized_tiles`ストア
- 処理: タイル単位で遅延ロード（bounds判定で必要分のみ）

**戦略C: 非最適化IndexedDB（状態C）**
- 条件: `isOptimized === false`、`dataUrl`空
- ソース: `legacy_blobs`ストア
- 処理: OffscreenCanvasで元画像から該当タイル抽出
- 副作用: Worker migrationを自動キュー

**フォールバックチェーン（修正後）:**
```typescript
if (layerMetadata && !layerMetadata.isOptimized) {
  // IndexedDBから完全画像取得
  bitmap = await loadImageBitmap(await fetchFullImageFromIndexedDB(key));
} else if (img.dataUrl && img.dataUrl !== "") {
  // Chrome Storageから直接
  bitmap = await loadImageBitmap(img.dataUrl);
} else {
  // Doctor cleanup後のフォールバック（NEW）
  bitmap = await loadImageBitmap(await fetchFullImageFromIndexedDB(key));
}
```

### Fetch Interceptor（タイル取得）

**場所:** `src/inject/fetch-interceptor.ts`

**処理:**
```
1. タイル要求検知: GET /tiles/{tileX}/{tileY}.png
2. キャッシュ確認: Memory → IndexedDB
3. オリジナル取得（キャッシュミス時）
4. スナップショット保存（タイムトラベル用）
5. オーバーレイ描画: drawOverlayLayersOnTile()
   ├─ 該当タイルと重なるレイヤー検索
   ├─ 各レイヤーのタイル取得（3戦略）
   ├─ カラーフィルタ適用（GPU/CPU）
   ├─ 統計計算（matched/total）
   ├─ x3スケール + 描画モード適用
   └─ 合成 → PNG Blob
6. キャッシュ保存（Data Saver有効時）
7. ブラウザに返却
```

**キャッシュ戦略（4ケース）:**
- ケース1: Data Saver無効 + キャッシュなし → 処理のみ
- ケース2: Data Saver無効 + キャッシュあり → 取得 → 処理 → 保存
- ケース3: Data Saver有効 + キャッシュなし → 取得 → 処理 → 保存
- ケース4: Data Saver有効 + キャッシュあり → キャッシュ返却（最速）

---

## 既存ユーザーの画像データ処理

### シナリオ1: 初回起動（状態A）

```
1. ページロード
2. content.ts初期化
3. sendGalleryImagesToInject()呼び出し
4. inject: handleGalleryImages()
   ├─ 各画像のdataUrlをImageBitmapに変換
   ├─ メモリ上で1000x1000分割
   ├─ overlayLayersに追加（即座に描画可能）
   └─ saveGalleryToIndexedDB()
      ├─ legacy_blobsに保存
      └─ Worker migrationキュー（バックグラウンド）
5. 5秒経過 → Doctor cleanup
   └─ dataUrl削除、thumbnail生成
6. 次回タイル描画時
   └─ 戦略C（legacy_blobs抽出）で描画
```

### シナリオ2: Doctor cleanup後の起動（状態C）

```
1. ページロード
2. sendGalleryImagesToInject()
   └─ dataUrl=""（空）で送信
3. inject: handleGalleryImages()
   ├─ layerMetadata取得
   ├─ isOptimized=false
   └─ fetchFullImageFromIndexedDB(key) ← フォールバック
      └─ legacy_blobsから取得
4. メモリ分割 → overlayLayers追加
5. タイル描画時
   └─ 戦略C（legacy_blobs抽出）で描画
   └─ Worker migrationキュー（再実行）
```

### シナリオ3: 最適化完了後（状態D）

```
1. ページロード
2. sendGalleryImagesToInject()
3. inject: handleGalleryImages()
   ├─ layerMetadata取得
   ├─ isOptimized=true ← 最適化済み！
   └─ ダミー1x1 ImageBitmap作成（全タイル未ロード）
4. タイル描画時
   └─ 戦略B（optimized_tiles直接ロード）
      └─ 該当タイルのみIndexedDBから取得（最速）
```

---

## データフロー全体図

```
[ユーザー操作: 画像アップロード]
      ↓
[Content Script]
  GalleryStorage.save()
    ├─ Chrome Storage: metadata + dataUrl + thumbnail
    └─ sendGalleryImagesToInject()
      ↓
[Inject Context]
  handleGalleryImages()
    ├─ dataUrl → ImageBitmap変換
    ├─ メモリ分割（1000x1000）
    ├─ overlayLayers追加
    └─ saveGalleryToIndexedDB()
      ├─ IndexedDB: layers + legacy_blobs保存
      └─ Worker: MIGRATE_REQUEST送信
      ↓
[Web Worker]
  migrateLayer()
    ├─ legacy_blob読み込み
    ├─ 1000x1000分割（OffscreenCanvas）
    ├─ optimized_tiles保存
    └─ layers.isOptimized = true
      ↓
[5秒後: Doctor]
  checkAndCleanup()
    ├─ サムネイル生成
    ├─ Chrome Storage: dataUrl削除
    └─ gallery_index.cleaned = true
      ↓
[ユーザー操作: 地図移動]
      ↓
[Fetch Interceptor]
  handleTileRequest()
    ├─ キャッシュ確認
    ├─ オリジナルタイル取得
    └─ drawOverlayLayersOnTile()
      ├─ 該当レイヤー検索
      ├─ getTile(imageKey, tileKey)
      │  ├─ isOptimized=true → optimized_tiles
      │  └─ isOptimized=false → legacy_blobs抽出
      ├─ カラーフィルタ（GPU/CPU）
      ├─ 統計計算
      ├─ x3スケール + 描画モード
      └─ 合成
      ↓
[ブラウザ]
  処理済みタイル表示
```

---

## 重要ファイル一覧

### Content Script（Chrome拡張コンテキスト）

| ファイル | 役割 |
|---------|------|
| `src/content.ts` | 初期化、Doctor起動 |
| `src/core/bridge/gallery-bridge.ts` | sendGalleryImagesToInject() |
| `src/states/galleryStorage.ts` | Chrome Storage管理 |
| `src/features/doctor/` | ストレージ最適化 |

### Inject Script（ページコンテキスト）

| ファイル | 役割 |
|---------|------|
| `src/inject/index.ts` | 初期化（fetch override、IndexedDB）|
| `src/inject/fetch-interceptor.ts` | タイル取得・キャッシュ |
| `src/inject/handlers/overlay-handlers.ts` | Gallery処理、3戦略 |
| `src/inject/tile-draw/tile-overlay-renderer.ts` | 描画パイプライン |
| `src/inject/db/layer-repository.ts` | getTile()（fast/fallback） |
| `src/inject/db/schema.ts` | データ型定義 |
| `src/inject/workers/migration.worker.ts` | バックグラウンド最適化 |

### 状態管理

| ファイル | 役割 |
|---------|------|
| `src/inject/tile-draw/states.ts` | overlayLayers[], perTileColorStats |
| `src/inject/states/migrationState.ts` | LayerRepository, WorkerMessenger |
| `src/inject/states/colorFilterState.ts` | カラーフィルタ設定 |

---

## パフォーマンス最適化

### メモリ管理

- LRUキャッシュ: LayerRepository（100 ImageBitmaps）
- タイルキャッシュ: TileCacheDB（100タイル）
- 明示的解放: `bitmap.close()`（GC促進）
- Worker遅延: 100-500ms（タスク間GC）

### 描画最適化

- bounds判定: 最適化レイヤーで不要タイルスキップ
- 遅延ロード: 必要なタイルのみIndexedDBから取得
- GPU処理: WebGL2カラーフィルタ（最大64色）
- スパースタイル: 透明10px未満スキップ

### ネットワーク最適化

- 4段階キャッシュ: Memory → IndexedDB → 処理 → Network
- Data Saverモード: 処理済みタイル永続化
- キャッシュ無効化: ピクセル描画POST時のみ

---

## トラブルシューティング

### 問題: 描画されない（dataUrl空）

**原因:** Doctor cleanup後、IndexedDBフォールバックなし

**解決:**
```typescript
// overlay-handlers.ts:259-281
} else if (img.dataUrl && img.dataUrl !== "") {
  bitmap = await loadImageBitmap(img.dataUrl);
} else {
  // NEW: Doctor cleanup後のフォールバック
  const fullDataUrl = await fetchFullImageFromIndexedDB(img.key);
  if (fullDataUrl) bitmap = await loadImageBitmap(fullDataUrl);
}
```

### 問題: 最適化されない

**原因:** Worker migrationが実行されていない

**確認:**
1. `migration.worker.ts`ロード確認
2. `handleGalleryImages()`で`requestWorkerMigration()`呼び出し確認
3. IndexedDB `layers`ストアの`isOptimized`フラグ確認

### 問題: 統計が消える

**原因:** Chrome Storageへの保存失敗

**確認:**
1. `mr-wplace-stats-updated`メッセージ送信確認
2. `content.ts`のメッセージリスナー確認
3. Chrome Storage容量（5MB制限）

---

## データ移行パス

### v1.x → v2.x（Doctor導入前 → 後）

**自動移行:**
1. Doctor初回実行でサムネイル生成
2. dataUrl削除（5秒後）
3. IndexedDB保存（inject側自動）
4. Worker migration（バックグラウンド）

**ユーザー影響:** なし（透過的）

### 緊急復旧

**dataUrl完全削除後の復旧:**
```javascript
// IndexedDBから全画像復元
const images = await galleryStorage.getAll({ fullImage: true });
```

**IndexedDB破損時:**
```javascript
// Chrome Storageから再保存
await sendGalleryImagesToInject();
// inject側で自動的にIndexedDB再構築
```

---

## 設計原則

1. **段階的最適化:** 即座に描画可能 → バックグラウンド最適化
2. **多重フォールバック:** dataUrl → optimized → legacy → 失敗
3. **透過的移行:** ユーザー操作不要、自動データ変換
4. **永続性:** IndexedDB + Chrome Storage二重保存
5. **パフォーマンス優先:** メモリキャッシュ → IndexedDB → Network

---

**更新日:** 2025-12-07
**対象バージョン:** v2.x（Doctor/Migration導入後）
