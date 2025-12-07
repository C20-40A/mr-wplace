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
├── db/                         # IndexedDB
│   ├── schema.ts              # Database schema
│   └── layer-repository.ts    # Repository Pattern, LRU cache
├── workers/                    # Web Worker
│   ├── migration.worker.ts    # Tile splitting (OffscreenCanvas)
│   └── messaging.ts           # Worker communication
├── states/                     # State management
│   ├── colorFilterState.ts    # Color filter state
│   └── migrationState.ts      # Migration state
├── handlers/                   # Message handlers
│   ├── overlay-handlers.ts    # Gallery, snapshots, text
│   ├── state-handlers.ts      # Theme, data saver, filter
│   └── request-handlers.ts    # Stats, pixel color
└── tile-draw/                  # Tile rendering
    ├── stats/                 # Statistics computation
    ├── filters/               # GPU/CPU filters
    └── image-processing/      # Image processing
```

## Data Flow

**Gallery Save:** content (Chrome Storage + IndexedDB) → `sendGalleryImagesToInject()` → inject `handleGalleryImages()` → IndexedDB + Worker tile splitting

**Tile Draw:** `fetch-interceptor` → `handleTileRequest()` → `drawOverlayLayersOnTile()` → composite + stats + cache

## Storage Strategy

- **Chrome Storage**: metadata + thumbnail (KB)
- **IndexedDB (mr-wplace-v2)**: full image + optimized tiles (MB+)
  - `layers`: metadata (visible, zIndex, coords, isOptimized)
  - `legacy_blobs`: original image Blob
  - `optimized_tiles`: 1000x1000 split tiles

## Key Messages

**content → inject:**
- `mr-wplace-gallery-images`, `mr-wplace-snapshots`, `mr-wplace-text-layers`, `mr-wplace-theme-update`, `mr-wplace-color-filter`, `wplace-studio-flyto`

**inject → content:**
- `mr-wplace-me`, `mr-wplace-response-stats`, `mr-wplace-stats-updated`

## Technical Constraints

- ✅ Direct DOM/fetch access
- ❌ No Chrome APIs (use postMessage to content)
- ❌ No runtime imports from content (type-only OK: `import type { GalleryItem }`)
- ✅ State in `inject/states/*.ts` (not `window`)

## Initialization Flow

1. Load theme from DOM
2. `setupFetchInterceptor()`: override `window.fetch`
3. `setupMessageHandler()`: register listeners
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
