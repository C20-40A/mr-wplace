# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mr. Wplace** is a Chrome extension for WPlace, an online collaborative pixel placement map. The extension provides advanced drawing, gallery management, and map customization features.

- **Project Name**: mr-wplace
- **Extension Name**: Mr. Wplace
- **Target**: Chrome/Edge Manifest V3 extension
- **Build Tool**: esbuild with Bun runtime

## Architecture

### Entry Points

The extension has 3 main entry points that esbuild bundles:

1. **`src/content.ts`** - Main content script, initializes all features and DI container
2. **`src/inject.ts`** - Injected into page context for fetch interception and map instance access
3. **`src/popup.ts`** - Extension popup UI

### Content ↔ Inject Communication

**Critical:** The extension operates in two isolated contexts:

- **Content Script** (`content.ts`): Chrome extension context with access to Chrome APIs
- **Injected Script** (`inject/index.ts`): Page context with access to WPlace's map instance and fetch API

Communication flow:

```
content.ts → inject script tag → inject/index.ts
     ↓                                    ↓
  postMessage ←→ window.addEventListener("message")
```

**Key message sources (content → inject):**

- `mr-wplace-gallery-images`: Gallery images data with draw positions
- `mr-wplace-snapshots`: Time-travel snapshot overlay data
- `mr-wplace-compute-device`: GPU/CPU rendering preference
- `mr-wplace-color-filter`: Color filter state and enhanced mode
- `mr-wplace-theme-update`: Theme change notification
- `mr-wplace-data-saver-update`: Data saver toggle
- `wplace-studio-flyto`: Position navigation request
- `wplace-studio-snapshot`: Tile snapshot storage (legacy)
- `wplace-studio-pixel-click`: Pixel color detection (auto-spoit)

**Key message sources (inject → content):**

- `mr-wplace-request-stats`: Request aggregated color statistics
- `mr-wplace-response-stats`: Color statistics response
- `mr-wplace-request-pixel-color`: Request overlay pixel color at lat/lng
- `mr-wplace-response-pixel-color`: Pixel color response
- `mr-wplace-request-tile-stats`: Request per-tile color statistics
- `mr-wplace-response-tile-stats`: Tile statistics response
- `mr-wplace-me`: User data from intercepted API
- `mr-wplace-processed`: Processed tile blob (legacy)

### Dependency Injection (DI Container)

**Location**: `src/core/di.ts`

Features register their APIs in the DI container to avoid circular dependencies:

```typescript
// Registration (in content.ts)
di.register("gallery", galleryAPI);
di.register("tileOverlay", tileOverlayAPI);

// Usage (in any feature)
const gallery = di.get("gallery");
```

All feature APIs are typed in `src/core/di.ts` under `FeatureRegistry`.

### File Structure

```
src/
├── content.ts              # Main entry, DI registration, message listeners
├── inject/                 # Page-context scripts (see inject/CLAUDE.md for details)
│   ├── index.ts           # Initialization & coordination
│   ├── message-handler.ts # Message routing (159 lines, refactored 2025-11-07)
│   ├── handlers/          # Message handlers by category
│   │   ├── overlay-handlers.ts   # Gallery, snapshots, text
│   │   ├── state-handlers.ts     # Theme, filters, settings
│   │   └── request-handlers.ts   # Stats, pixel color requests
│   ├── tile-draw/         # Tile overlay rendering (moved from features 2025-11-01)
│   │   ├── states.ts      # Overlay layers state management
│   │   ├── tile-overlay-renderer.ts  # GPU/CPU rendering
│   │   ├── stats/         # Statistics computation
│   │   ├── filters/       # Color filtering (GPU/CPU)
│   │   └── image-processing/  # Image manipulation
│   ├── utils/             # Inject-wide utilities
│   │   └── image-loader.ts    # Common image loading
│   ├── fetch-interceptor.ts   # Intercepts tile & user API calls
│   ├── map-instance.ts    # Captures WPlace map instance
│   └── theme-manager.ts   # Applies theme to map
├── core/
│   └── di.ts              # DI container & API types
├── features/              # Feature modules (gallery, drawing, etc.)
├── utils/                 # Shared utilities
│   └── inject-bridge.ts   # Content ↔ Inject communication functions
└── i18n/                  # Internationalization
```

### Key Features

Each feature is self-contained in `src/features/`:

- **gallery**: Image upload, storage, editing
- **tile-overlay**: Drawing images on map tiles
- **drawing**: Manual pixel drawing
- **time-travel**: Tile snapshot & restoration
- **color-filter**: Color filters & drawing modes
- **bookmark**: Saved locations
- **map-filter**: Dark theme, high contrast, data saver
- **auto-spoit**: Color picker from map
- **text-draw**: Text rendering on map
- **position-info**: Current coordinate display
- **paint-stats**: User painting statistics

## Coding Standards

### Core Rules

1. **Minimal implementation principle** - Solve one problem at a time
2. **No try-catch** - Throw errors, let upper layers catch
3. **Arrow functions** - Prefer `const fn = () => {}` over `function fn() {}`
4. **Path alias** - Use `@/` instead of relative paths: `import { di } from "@/core/di"`

### Logging

Always use the 🧑‍🎨 icon for extension logs:

```typescript
console.log("🧑‍🎨 : your message");
```

### Styling

Chrome extensions have limited CSS. Use inline styles when Tailwind classes are uncertain:

```typescript
button.className = "btn btn-sm"; // Safe Tailwind classes
button.style.cssText = `position: fixed; z-index: 800;`; // Custom styles
```

**Mobile scrolling fix**: Always include `-webkit-overflow-scrolling: touch; overscroll-behavior: contain;` for overflow scroll elements to ensure Android compatibility.

### Chrome APIs

**Never import `chrome` directly.** Use the browser-api wrapper:

```typescript
import { storage, runtime, tabs } from "@/utils/browser-api";

await storage.get("key");
await storage.set({ key: "value" });
await storage.remove("key");

const url = runtime.getURL("dist/inject.js");
runtime.sendMessage({ type: "reload" });
runtime.onMessage.addListener(callback);

const currentTab = await tabs.query({ active: true });
tabs.sendMessage(tabId, message);
tabs.reload(tabId);
```

### Internationalization

```typescript
import { t } from "@/i18n/manager";

const text = t`feature.gallery.title`; // Template literal syntax
```

## Important Utilities

- `utils/router.ts`: Base Router class with history & i18n header management
- `utils/modal.ts`: Common modal creation helper
- `utils/coordinate.ts`: `llzToTilePixel`, `tilePixelToLatLng` conversions
- `utils/position.ts`: `gotoPosition`, `getCurrentPosition`
- `utils/color-filter-manager.ts`: Main state management for filters
- `utils/pixel-converters.ts`: `blobToPixels` for image processing
- `utils/image-storage.ts`: Gallery image persistence
- ~~`utils/image-bitmap-compat.ts`~~: ❌ Deprecated - Use native `createImageBitmap` in inject context

## Critical Implementation Notes

### Tile Overlay Architecture (2025-11-01)

**IMPORTANT:** All tile overlay rendering now happens in **inject context (page context)**, not content script context.

#### Background

Firefox has stricter security constraints than Chrome for extension contexts. Operations involving `ImageBitmap`, `ImageData`, and WASM in content scripts fail with security errors in Firefox, even though they work in Chrome.

#### Solution

Move all image processing to `src/inject/tile-draw/`:

1. **Content script role** (`src/content.ts`):

   - Manages data (gallery, snapshots, settings)
   - Sends data to inject via `postMessage`
   - Uses stubs for legacy function calls

2. **Inject script role** (`src/inject/tile-draw/`):
   - Receives data via `message` event listeners
   - Performs all image processing (split, filter, render)
   - Uses native Canvas API (no WASM)
   - Intercepts tile fetch and applies overlays

#### Data Sync Functions

Always call these after modifying overlay-related data:

```typescript
import { sendGalleryImagesToInject } from "@/content";
import { sendSnapshotsToInject } from "@/content";
import { sendColorFilterToInject } from "@/content";
import { sendComputeDeviceToInject } from "@/content";

// After gallery changes (add, delete, toggle, reorder)
await sendGalleryImagesToInject();

// After snapshot changes (draw, remove, delete)
await sendSnapshotsToInject();

// After color filter changes
await sendColorFilterToInject();

// After compute device changes (GPU/CPU)
await sendComputeDeviceToInject();
```

#### Async Request/Response Pattern

For features that need data FROM inject (stats, pixel color):

```typescript
// In utils/inject-bridge.ts
export const getAggregatedColorStats = async (
  imageKeys: string[]
): Promise<ColorStats> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-stats" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);
    window.postMessage(
      { source: "mr-wplace-request-stats", imageKeys, requestId },
      "*"
    );
  });
};
```

#### Key Constraints

- ❌ **Never use WASM in inject context** - causes `unreachable` errors
- ❌ **Never use `image-bitmap-compat` in inject** - use native `createImageBitmap`
- ✅ **Always use Canvas API for image processing in inject**
- ✅ **Content script only manages storage and UI**
- ✅ **Inject script handles all rendering and filtering**

#### Files to Modify When Adding Overlay Features

1. `src/inject/message-handler.ts`: Add new message listener
2. `src/inject/types.ts`: Add type definitions if needed
3. `src/content.ts`: Add data sync function
4. Feature code: Call sync function after data changes

See `src/inject/CLAUDE.md` for detailed migration history.

### Known Limitations and Potential Issues

#### Performance Considerations

1. **Large gallery images**: Images are split into tiles and cached. Very large images (>10MB) may cause initial lag.
2. **Many overlays**: Having 10+ active overlays may impact rendering performance on lower-end devices.
3. **Snapshot storage**: Snapshots are stored as PNG in Chrome storage. Each snapshot is ~50-200KB. Chrome has a 10MB limit per extension.

#### Browser Compatibility

- ✅ **Chrome/Edge**: Fully supported
- ✅ **Firefox**: Fully supported (as of 2025-11-01 refactor)
- ❌ **Safari**: Not tested, likely requires Manifest V2 backport

#### Edge Cases to Watch

1. **Tile cache invalidation**: When overlay data changes, `window.mrWplaceDataSaver.tileCache.clear()` is called. If tiles don't update, check this call.

2. **Message ordering**: `postMessage` is async. If overlays don't appear, check that:

   - `sendGalleryImagesToInject()` is awaited
   - Message handler completed before next operation

3. **ImageBitmap lifecycle**: ImageBitmaps are kept in memory in `overlayLayers`. Memory leaks possible if images aren't removed from layers when deleted from gallery.

4. **Snapshot sync timing**: Snapshots are loaded from storage and converted to dataUrl on each sync. If snapshot list is long (>50), this may take 1-2 seconds.

#### Debugging Tips

```typescript
// Check overlay layers state in inject context
console.log("🧑‍🎨 : overlayLayers", window.overlayLayers);

// Check gallery images in inject context
console.log("🧑‍🎨 : galleryImages", window.mrWplaceGalleryImages);

// Check snapshots in inject context
console.log("🧑‍🎨 : snapshots", window.mrWplaceSnapshots);

// Check tile cache
console.log("🧑‍🎨 : cache size", window.mrWplaceDataSaver?.tileCache.size);

// Force tile re-render
if (window.mrWplaceDataSaver?.tileCache) {
  window.mrWplaceDataSaver.tileCache.clear();
  console.log("🧑‍🎨 : Cleared tile cache");
}
```

#### Potential Future Improvements

1. **Incremental sync**: Instead of sending all gallery images on every change, send only diffs.
2. **Web Worker**: Move image processing to Web Worker for better performance.
3. **IndexedDB for snapshots**: Use IndexedDB instead of Chrome storage for larger snapshot capacity.
4. **Lazy loading**: Only load snapshots for currently visible tiles.
5. **Compression**: Use WebP instead of PNG for snapshots to reduce storage usage.

あなたはシンプルかつ最も効果的で単純明瞭なコードを書く
早期リターン/const arrow を利用.if の内容が 1 行ならかっこでくくらないこともある
