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

**Key messages (content → inject):**
- `mr-wplace-gallery-images`: Gallery images with draw positions
- `mr-wplace-snapshots`: Time-travel snapshot overlays
- `mr-wplace-color-filter`: Color filter state
- `mr-wplace-theme-update`: Theme changes
- `wplace-studio-flyto`: Position navigation

**Key messages (inject → content):**
- `mr-wplace-request-stats` / `response-stats`: Color statistics
- `mr-wplace-request-pixel-color` / `response-pixel-color`: Overlay pixel color
- `mr-wplace-stats-updated`: Save statistics to storage
- `mr-wplace-me`: User data from API

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
├── content.ts              # Main entry, DI registration
├── inject/                 # Page-context scripts (see inject/CLAUDE.md)
│   ├── handlers/          # Message handlers (overlay, state, request)
│   ├── tile-draw/         # Tile overlay rendering
│   │   ├── stats/         # Statistics computation
│   │   ├── filters/       # Color filtering (GPU/CPU)
│   │   └── image-processing/  # Image manipulation
│   ├── user-status/       # User status management
│   ├── fetch-interceptor.ts   # Intercepts tile & user API
│   └── map-instance.ts    # Captures WPlace map instance
├── core/di.ts             # DI container & API types
├── features/              # Feature modules (gallery, drawing, etc.)
├── utils/
│   └── inject-bridge.ts   # Content ↔ Inject communication
└── i18n/                  # Internationalization
```

### Key Features

Each feature is self-contained in `src/features/`:

- **gallery**: Image upload, storage, editing
- **tile-overlay**: Drawing images on map tiles
- **drawing**: Manual pixel drawing
- **time-travel**: Tile snapshot & restoration
- **color-filter**: Color filters & drawing modes
- **color-isolate**: Color isolation mode
- **bookmark**: Saved locations
- **map-filter**: Dark theme, high contrast
- **data-saver**: Data saving mode
- **text-draw**: Text rendering on map
- **position-info**: Current coordinate display
- **paint-stats**: User painting statistics
- **show-unplaced-only**: Show unplaced pixels only
- **friends-book**: Friends management

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

- `utils/router.ts`: Base Router class with history & i18n header
- `utils/modal.ts`: Common modal creation helper
- `utils/coordinate.ts`: Coordinate conversions (`llzToTilePixel`, `tilePixelToLatLng`)
- `utils/position.ts`: Position navigation (`gotoPosition`, `getCurrentPosition`)
- `utils/color-filter-manager.ts`: Color filter state management
- `utils/image-storage.ts`: Gallery image persistence
- `utils/inject-bridge.ts`: Content ↔ Inject communication helpers

## Critical Implementation Notes

### Tile Overlay Architecture

**IMPORTANT:** All tile overlay rendering happens in **inject context (page context)**, not content script context.

**Reason:** Firefox's security constraints prevent `ImageBitmap`/`ImageData` operations in extension context.

#### Content vs Inject Roles

1. **Content script** (`src/content.ts`):
   - Manages storage (gallery, snapshots, settings)
   - Sends data to inject via `postMessage`

2. **Inject script** (`src/inject/tile-draw/`):
   - Receives data via message listeners
   - Performs image processing (split, filter, render)
   - Intercepts tile fetch and applies overlays

#### Data Sync Functions

Always call these after modifying overlay-related data:

```typescript
import { sendGalleryImagesToInject } from "@/content";
import { sendSnapshotsToInject } from "@/content";
import { sendColorFilterToInject } from "@/content";

// After gallery changes
await sendGalleryImagesToInject();

// After snapshot changes
await sendSnapshotsToInject();

// After color filter changes
await sendColorFilterToInject();
```

#### Async Request/Response Pattern

For features that need data FROM inject (stats, pixel color), use the helpers in `utils/inject-bridge.ts`:

```typescript
import { getAggregatedColorStats } from "@/utils/inject-bridge";

const stats = await getAggregatedColorStats(imageKeys);
```

#### Key Constraints

- ❌ **Never use WASM in inject context**
- ❌ **Never process images in content script**
- ✅ **Use Canvas API for image processing in inject**
- ✅ **Content manages storage, inject handles rendering**

See `src/inject/CLAUDE.md` for detailed architecture and migration history.

### Statistics Persistence

**Statistics are automatically saved and restored:**

1. **On load**: Statistics are restored from Chrome storage to inject context
2. **On tile visit**: Statistics are computed and saved to storage
3. **On reload**: Statistics persist across browser restarts

No manual intervention needed. See `src/inject/CLAUDE.md` for implementation details.

### Common Issues

**Overlays don't update after data change:**
- Ensure `sendGalleryImagesToInject()` is awaited
- Check tile cache is cleared: `window.mrWplaceDataSaver?.tileCache.clear()`

**Statistics not showing:**
- Visit tiles first to compute statistics
- Statistics are computed incrementally as you navigate

**Debugging:**
```typescript
// Check inject state in browser console
console.log("🧑‍🎨 : overlayLayers", window.overlayLayers);
console.log("🧑‍🎨 : cache size", window.mrWplaceDataSaver?.tileCache.size);
```

---

**Coding Style:**
- シンプルかつ最も効果的で単純明瞭なコードを書く
- 早期リターン/const arrow を利用
- if の内容が1行ならかっこでくくらないこともある
- トーストは基本的に利用しない
