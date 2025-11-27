# フローの整理

## 1. 画像配置時 (初回)

content.ts: Gallery 保存
  → Chrome Storage + IndexedDB (legacy_blobs) に保存
  → sendGalleryImagesToInject() で inject に通知
  → handleGalleryImages() で overlayLayers に追加
  → Worker に MIGRATE_REQUEST 送信（バックグラウンド最適化）

## 2. タイル描画時 (fetch 発生)

fetch-interceptor が intercept
  → handleTileRequest()
  → drawOverlayLayersOnTile() でオーバーレイ合成
  → 統計計算、キャッシュ保存

## 3. Migration Architecture (2025-11-27)

**IndexedDB (mr-wplace-v2):**
- `layers` - メタデータ (visible, zIndex, coords, isOptimized)
- `legacy_blobs` - 元画像 (Blob)
- `optimized_tiles` - 分割済みタイル (1000x1000 Blob)

**Repository Pattern (db/layer-repository.ts):**
- `getTile()` - 高速パス (optimized) / フォールバック (legacy)
- `saveLayer()` - レイヤー保存
- LRU cache (最大100枚)

**Worker (workers/migration.worker.ts):**
- 別スレッドで画像をタイル分割
- OffscreenCanvas で処理
- 透明タイルはスキップ (Sparse Optimization)

## Directory Structure

```
src/inject/
├── db/                         # IndexedDB (2025-11-27)
│   ├── schema.ts              # Database schema
│   └── layer-repository.ts    # Repository Pattern
├── workers/                    # Web Worker (2025-11-27)
│   ├── migration.worker.ts    # タイル分割処理
│   └── messaging.ts           # Worker 通信
├── handlers/                   # Message handlers
│   ├── overlay-handlers.ts    # Gallery, snapshots, text
│   ├── state-handlers.ts      # Theme, data saver, filter
│   └── request-handlers.ts    # Stats, pixel color
├── tile-draw/
│   ├── stats/                 # 統計計算
│   ├── filters/               # GPU/CPU フィルター
│   └── image-processing/      # 画像処理
├── fetch-interceptor.ts       # タイル fetch intercept
└── types.ts
```

---

## 重要な制約

❌ **避けるべきパターン:**
- content script で ImageBitmap/ImageData を直接処理
- inject context で WASM を使用
- inject context で Chrome API を使用

✅ **推奨パターン:**
- content は storage 管理のみ
- inject は画像処理と描画のみ
- データ変更時は必ず send*ToInject() を呼ぶ

## 新機能追加時のガイド

**1. inject/message-handler.ts にハンドラー追加:**
```typescript
if (event.data.source === "mr-wplace-your-feature") {
  await handleYourFeature(event.data);
}
```

**2. content.ts に送信関数追加:**
```typescript
export const sendYourFeatureToInject = async () => {
  window.postMessage({ source: "mr-wplace-your-feature", data }, "*");
};
```

## 歴史

**tile-draw inject 移行 (2025-11-01)**: Firefox セキュリティ制約回避のため全画像処理を inject 側に移行

**Directory Refactoring (2025-11-07)**: message-handler 分割、tile-draw 整理

**統計永続化 (2025-11-14)**: タイル訪問時に統計計算・保存、リロード後も統計保持

**Migration Architecture (2025-11-27)**: IndexedDB + Repository + Worker 導入、バックグラウンド最適化
