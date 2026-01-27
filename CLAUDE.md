# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mr. Wplace** is a Chrome extension for WPlace, an online collaborative pixel placement map. The extension provides advanced drawing, gallery management, and map customization features.

- Project Name: mr-wplace
- Target: Chrome/Edge Manifest V3 extension
- Build Tool: esbuild + Bun

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

- `mr-wplace-gallery-images-v2`: Gallery images metadata with affectedTiles (IndexedDB v2)
- `mr-wplace-snapshots`: Time-travel snapshot overlays
- `mr-wplace-color-filter`: Color filter state
- `mr-wplace-theme-update`: Theme changes
- `mr-wplace-map-flyto`: Position navigation

**Popup → Content → Inject:**

Popup cannot directly postMessage to inject (different context). Use `tabs.sendMessage`:

```typescript
// popup.ts
chrome.tabs.sendMessage(tabId, { type: "GALLERY_SAVE_ITEM", ... });

// content.ts handles and forwards to inject via postMessage
```

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
├── popup.ts                # Extension popup UI
├── inject.ts               # Inject entry point (bundles inject/index.ts)
├── inject/                 # Page-context scripts (see inject/CLAUDE.md)
│   ├── index.ts           # Initialization flow
│   ├── types.ts           # Type definitions, window extensions
│   ├── fetch-interceptor.ts   # Tile & /me API interception
│   ├── map-instance.ts    # Map instance capture, event handling
│   ├── message-handler.ts # postMessage dispatcher
│   ├── db/                # IndexedDB (Repository Pattern, LRU cache)
│   ├── workers/           # Web Worker (tile splitting)
│   ├── handlers/          # Message handlers (overlay, state, request)
│   ├── states/            # State management (colorFilter, migration)
│   └── tile-draw/         # Tile rendering (stats, filters, processing)
├── core/di.ts             # DI container & API types
├── features/              # Feature modules (gallery, drawing, etc.)
├── states/                # Content script state (GalleryStorage, etc.)
├── utils/
│   ├── inject-bridge.ts   # Content ↔ Inject communication
│   ├── browser-api.ts     # Chrome API wrapper
│   └── ...                # Router, modal, coordinate, position, etc.
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

const text = t`${"feature_gallery_title"}`; // Template literal syntax
// don't use like this: t`feature.gallery.title`
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

2. **Inject script** (`src/inject`):
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

See [src/inject/CLAUDE.md](src/inject/CLAUDE.md) for detailed inject architecture.

### Statistics Persistence

**Statistics are automatically saved and restored:**

1. **On load**: Statistics are restored from Chrome storage to inject context
2. **On tile visit**: Statistics are computed and saved to storage
3. **On reload**: Statistics persist across browser restarts

No manual intervention needed. Statistics persist across browser restarts.

### Common Issues

**Overlays don't update after data change:**

- Ensure `sendGalleryImagesToInject()` is awaited
- Check tile cache is cleared: `window.mrWplaceDataSaver?.tileCache.clear()`

**Statistics not showing:**

- Visit tiles first to compute statistics
- Statistics are computed incrementally as you navigate

**Scroll not working on card/item elements:**

- Card/item elements can block wheel events from reaching parent scroll containers
- Use `attachCardScrollPassthrough()` helper (cards) or `attachWheelPassthrough()` (gallery items)
- These helpers manually propagate wheel/touch events to the nearest scrollable ancestor
- Example: `attachCardScrollPassthrough(gridContainer)` after rendering cards

**Debugging:**

```typescript
// Check inject state in browser console
console.log("🧑‍🎨 : overlayLayers", window.overlayLayers);
console.log("🧑‍🎨 : cache size", window.mrWplaceDataSaver?.tileCache.size);
```

### GalleryItem

you can use GalleryStorage & Types

```ts
import { GalleryStorage, GalleryItem } from "@/states/galleryStorage";
```

```ts
export interface GalleryItem {
  key: string;
  timestamp: number;
  // Legacy: dataUrl is deprecated, will be removed in future versions
  // New images use thumbnail + IndexedDB blob storage instead
  dataUrl?: string;
  // Thumbnail (128x128) for UI display, generated on save
  thumbnail?: string;
  title?: string;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  layerOrder?: number;
  matchedColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
  perTileColorStats?: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  >;
}
```

---

**Coding Style:**

- シンプルかつ最も効果的で単純明瞭なコードを書く
- 早期リターン/const arrow を利用
- if の内容が 1 行ならかっこでくくらないこともある
- トーストは基本的に利用しない
- 抽象化を意識した設計
- パフォーマンスを意識
- 実装のためにコードが複雑になりそうなら、別方法の検討もする
- ボイラープレートや繰り返しを避ける
- できるだけ短く最小限の変更が好ましい
- 実装 API の知識が足りなければ、必ず報告し、ユーザの協力を要請
- 必ずしもキリよく終わらせる必要はない
- 不明点、実装上の問題点があれば、報告すること
- 実装後、コードをチェックし、パフォーマンスやバグになりそうな注意点を確認・報告する
- 実装後、候補になる commit message を表示する
- コーディング前の方針を決める際は、自然言語で抽象的に設計する

## wplace 仕様

- 世界地図の上に、pixel art を描くサービス
- pixel art は共有キャンバス
- 1tile = web メルカトル zoomlevel 11 の単位 = 1000x1000px の png = 1fetch 単位
- wplace はタイルを polling して更新している
- polling に fetch intercept をして、画像サイズを大きくして、新しい pixel を描くことで、疑似的に overlay を実現
- maplibreglを利用
- themeはdocs/theme.mdを参照

# 注意点

- inject,content のそれぞれの機能は限定的
- inject: window の context が直で使える
- inject: chrome.storage が使えないので、多くの storage 設定は content で管理
- inject: indexedDb をメインで利用。特に重い画像データは chrome.storage では避ける
- content: window の context が使えないので、messaging で inject に委任
- content: indexedDb も使えるが、面倒なので、inject に委任することが多い
- content: メイン機能はすべてここに入れているが、描画などの処理は inject で担当させている
- content: browserAPI が使えるが、crossplatform のために、src/utils/browser-api.ts を利用する必要がある
