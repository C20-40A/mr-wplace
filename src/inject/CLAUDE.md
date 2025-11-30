# Inject Context Architecture

## Data Flow

### 1. Gallery Save Flow
```
content: save to Chrome Storage (metadata + thumbnail) + IndexedDB (full image)
  → sendGalleryImagesToInject() sends GalleryItem[]
  → inject: handleGalleryImages()
    → IndexedDB check (full image) → fallback to dataUrl
    → addImageToOverlayLayers() + saveGalleryToIndexedDB()
    → Worker MIGRATE_REQUEST (background tile splitting)
```

### 2. Tile Draw Flow
```
fetch-interceptor intercepts tiles/{x}/{y}.png
  → handleTileRequest()
  → drawOverlayLayersOnTile() composite overlay
  → compute stats + cache save
```

## Storage & Types

**Hybrid Storage Strategy:**
- Chrome Storage: metadata + thumbnail (lightweight, KB)
- IndexedDB: full image + optimized tiles (heavy, MB+)

**Type System:**
- `GalleryItem` (src/states/galleryStorage.ts): unified type for content & inject
- inject uses `import type { GalleryItem }` (type-only import, no runtime code)
- Message via postMessage: `GalleryItem[]` sent from content to inject

**Global State:**
- `window.mrWplace`: shared between content & inject contexts
- content fields: `tileOverlay`, `tileSnapshot`
- inject fields: `layerRepository`, `workerMessenger` (optional)

## Migration Architecture

**IndexedDB (mr-wplace-v2):**
- `layers`: metadata (visible, zIndex, coords, isOptimized)
- `legacy_blobs`: original image (Blob)
- `optimized_tiles`: split tiles (1000x1000 Blob)

**Repository Pattern (db/layer-repository.ts):**
- `getTile()`: optimized path / legacy fallback
- `saveLayer()`: save layer metadata + blob
- LRU cache (max 100 tiles)

**Worker (workers/migration.worker.ts):**
- Background tile splitting (OffscreenCanvas)
- Sparse optimization (skip transparent tiles)
- Priority queue (0=high, 1=low)

## Directory Structure

```
src/inject/
├── db/                         # IndexedDB (2025-11-27)
│   ├── schema.ts              # Database schema
│   └── layer-repository.ts    # Repository Pattern
├── workers/                    # Web Worker (2025-11-27)
│   ├── migration.worker.ts    # タイル分割処理
│   └── messaging.ts           # Worker 通信
├── states/                     # State management (2025-12-01)
│   ├── README.md              # State pattern documentation
│   └── colorFilterState.ts    # Color filter state
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

## Design Principles

**Context Separation:**
- Content: storage management, Chrome APIs
- Inject: image processing, rendering, fetch interception
- Communication: `postMessage` only (no direct module imports between contexts)

**Data Sync Pattern:**
```typescript
// After data change in content
await storage.save(item);
await sendGalleryImagesToInject(); // Sync to inject
```

**Type Import (inject only):**
```typescript
import type { GalleryItem } from "../../states/galleryStorage"; // OK (type-only)
// import { GalleryStorage } from "..."; // NG (runtime import not allowed)
```

**State Management (inject):**
- Store states in `src/inject/states/*.ts` instead of `window` object
- Each state module exports: type, getter(s), setter(s)
- Example: `colorFilterState.ts` replaces `window.mrWplace.colorFilterManager`
- Benefits: type safety, testability, no window pollution

**Adding New Features:**
1. Add handler in `inject/handlers/*.ts`
2. Register in `inject/message-handler.ts`
3. Add sender in `content.ts` (e.g., `sendXxxToInject()`)
4. If state needed across inject files, add to `inject/states/*.ts`

## History

- **2025-11-01**: tile-draw moved to inject (Firefox security constraints)
- **2025-11-07**: handlers directory refactoring
- **2025-11-14**: statistics persistence (tile-based caching)
- **2025-11-27**: Migration Architecture (IndexedDB + Repository + Worker)
- **2025-12-01**: Type unification (`GalleryItem`), Hybrid Storage (thumbnail + full image)
- **2025-12-01**: State management refactoring (`inject/states/` replaces `window.mrWplace.*`)
