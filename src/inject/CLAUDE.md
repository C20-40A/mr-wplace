# Inject Context Architecture

Page-context scripts (`inject/`) handle image processing, tile rendering, and fetch interception. Runs in page context with direct DOM/window access but no Chrome APIs.

## Directory Structure

```
src/inject/
├── index.ts                    # Entry point, initialization
├── types.ts                    # Type definitions, window extensions
├── fetch-interceptor.ts        # Tile & /me API interception
├── map-instance.ts             # Map instance capture, event handling
├── message-handler.ts          # postMessage dispatcher
├── db/                         # IndexedDB v2
│   ├── schema-v2.ts           # Database schema (4 stores)
│   └── gallery-repository.ts  # Repository Pattern, CRUD operations
├── workers/                    # Web Worker
│   ├── migration.worker.ts    # Tile splitting (OffscreenCanvas)
│   └── messaging.ts           # Worker communication
├── states/                     # State management
│   ├── colorFilterState.ts    # Color filter state
│   └── migrationState.ts      # Migration state
├── handlers/                   # Message handlers
│   ├── overlay-handlers.ts    # Gallery v2, snapshots, text layers
│   ├── state-handlers.ts      # Theme, data saver, filter
│   ├── request-handlers.ts    # Stats, pixel color
│   └── gallery-v2-handlers.ts # IndexedDB v2 CRUD bridge
└── tile-draw/                  # Tile rendering
    ├── stats/                 # Statistics computation
    ├── filters/               # GPU/CPU filters
    └── image-processing/      # Image processing
```

## Data Flow

**Gallery Save:** content → `gallery-storage-bridge.ts` → inject `gallery-v2-handlers.ts` → IndexedDB v2

**Gallery Display:** `sendGalleryImagesToInject()` → inject `handleGalleryImagesV2()` → overlay layers

**Tile Draw:** `fetch-interceptor` → `handleTileRequest()` → `drawOverlayLayersOnTile()` → composite + cache

## Storage Strategy (IndexedDB v2)

**Database:** `mr-wplace-gallery-v2` (version 1)

| Store        | Key                | Content                                                  |
| ------------ | ------------------ | -------------------------------------------------------- |
| `images`     | layerId            | Full image Blob                                          |
| `splitTiles` | [layerId, tileKey] | Split tile Blob (1000x1000)                              |
| `metadata`   | layerId            | GalleryMetadata (coords, visible, zIndex, affectedTiles) |
| `thumbnails` | layerId            | Thumbnail Blob (128x128)                                 |

**tileKey format:** `"tx,ty"` (e.g., `"1866,1292"`)

## Key Messages

**content → inject:**

- `mr-wplace-gallery-images-v2`: Gallery metadata with affectedTiles
- `mr-wplace-snapshots`, `mr-wplace-text-layers`
- `mr-wplace-theme-update`, `mr-wplace-color-filter`, `wplace-studio-flyto`
- **Gallery v2 bridge:** `mr-wplace-gallery-v2-save`, `mr-wplace-gallery-v2-delete`, etc.

**inject → content:**

- `mr-wplace-me`, `mr-wplace-response-stats`, `mr-wplace-stats-updated`
- **Gallery v2 response:** `mr-wplace-gallery-v2-save-response`, etc.

## Technical Constraints

- ✅ Direct DOM/fetch access
- ❌ No Chrome APIs (use postMessage to content)
- ❌ No runtime imports from content (type-only OK: `import type { GalleryItem }`)
- ✅ State in `inject/states/*.ts` (not `window`)

## Initialization Flow

1. Load theme from DOM
2. `setupFetchInterceptor()`: override `window.fetch`
3. `setupMessageHandler()`: register listeners + Gallery v2 handlers
4. `setupMapObserver()`: capture map instance
5. Initialize `window.mrWplace` inject fields

## Design Principles

**Context Separation:** Content manages storage/Chrome APIs, inject handles rendering/interception. Communication via `postMessage` only.

**Data Sync:**

```typescript
await storage.save(item);
await sendGalleryImagesToInject(); // Required after content changes
```

**State Management:** Use `inject/states/*.ts` for cross-file state. Type-safe, testable, no window pollution.

**Adding Features:**

1. Add handler in `inject/handlers/*.ts`
2. Register in `inject/message-handler.ts`
3. Add sender in `content.ts` (`sendXxxToInject()`)
4. Add state to `inject/states/*.ts` if needed

## History

- **2025-11-01**: tile-draw → inject (Firefox security)
- **2025-11-27**: IndexedDB + Repository + Worker
- **2025-12-01**: Type unification, hybrid storage, state refactoring
- **2025-12-14**: IndexedDB v2 migration, v1 legacy code removed

# ETag ベースタイルキャッシュ最適化

同じタイル画像が polling で来た場合に、重い描画・統計処理をスキップする
処理フロー

```
fetch tile → ETag 取得
  ↓
状態変化チェック (colorFilter, enhancedMode, showUnplacedOnly, overlayLayers)
  ↓ 変化あり → キャッシュ全破棄 → 処理実行 → キャッシュ保存
  ↓ 変化なし
    ↓
ETag チェック (tileX,tileY → etag の対応表)
  ↓ 対応表にない or ETag が違う → 対応表更新 → 処理実行 → Blob 保存
  ↓ ETag が同じ → メモリから Blob 取得 → そのまま返す (処理スキップ)
```
