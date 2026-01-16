# Inject Context

ページコンテキストで動作するスクリプト群。Chrome API は使えないが、DOM/window/fetch に直接アクセス可能。
主な役割: タイル描画、fetch 傍受、IndexedDB 管理。

## 構造概要

- `fetch-interceptor.ts` - タイルと/me API の傍受
- `tile-draw/` - タイル描画・統計・フィルタ処理
- `handlers/` - postMessage のディスパッチ先
- `db/` - IndexedDB v2 (gallery 画像の永続化)
- `states/` - inject 内の状態管理

## タイルキャッシュ

`tile-draw/last-modified-cache.ts` に 2 種類のメモリキャッシュ：

- **processedBlobCache** - overlay 適用後（polling 最適化用）
- **originalBlobCache** - 元タイル（背景ピクセル判定用）

LRU 24 タイル上限、状態変化時クリア、永続化なし。

## IndexedDB v2

DB 名: `mr-wplace-gallery-v2`

| Store      | Key                | 内容                          |
| ---------- | ------------------ | ----------------------------- |
| images     | layerId            | 元画像 Blob                   |
| splitTiles | [layerId, tileKey] | 分割タイル(1000x1000)         |
| metadata   | layerId            | 座標・表示状態・affectedTiles |
| thumbnails | layerId            | サムネイル(128x128)           |

tileKey 形式: `"tx,ty"` (例: `"1866,1292"`)

## データフロー

**Gallery 保存:** content → `gallery-storage-bridge.ts` → inject `gallery-v2-handlers.ts` → IndexedDB

**タイル描画:** `fetch-interceptor` → `handleTileRequest()` → `drawOverlayLayersOnTile()` → composite

**データ同期:** content 側で storage 変更後は必ず `sendGalleryImagesToInject()` を呼ぶ

## 制約

- Chrome API は使用不可（content に委譲）
- content からの runtime import は不可（type-only は OK）
- 状態は`inject/states/*.ts`で管理

# Last Modified ベースタイルキャッシュ最適化

同じタイル画像が polling で来た場合に、重い描画・統計処理をスキップする
処理フロー

```
fetch tile → LastModified 取得
  ↓
状態変化チェック (colorFilter, enhancedMode, showUnplacedOnly, overlayLayers)
  ↓ 変化あり → キャッシュ全破棄 → 処理実行 → キャッシュ保存
  ↓ 変化なし
    ↓
LastModified  チェック (tileX,tileY → etag の対応表)
  ↓ 対応表にない or LastModified  が違う → 対応表更新 → 処理実行 → Blob 保存
  ↓ LastModified  が同じ → メモリから Blob 取得 → そのまま返す (処理スキップ)
```

## Key Messages

**content → inject:**

- `mr-wplace-gallery-images-v2`: Gallery metadata with affectedTiles
- `mr-wplace-snapshots`, `mr-wplace-text-layers`
- `mr-wplace-theme-update`, `mr-wplace-color-filter`, `mr-wplace-map-flyto`
- **Gallery v2 bridge:** `mr-wplace-gallery-v2-save`, `mr-wplace-gallery-v2-delete`, etc.

**inject → content:**

- `mr-wplace-me`, `mr-wplace-response-stats`, `mr-wplace-stats-updated`
- **Gallery v2 response:** `mr-wplace-gallery-v2-save-response`, etc.
