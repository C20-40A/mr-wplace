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

**Key message sources:**

- `mr-wplace-processed`: Processed tile blob from content → inject
- `wplace-studio-flyto`: Position navigation request
- `mr-wplace-theme-update`: Theme change notification
- `mr-wplace-data-saver-update`: Data saver toggle
- `wplace-studio-snapshot`: Tile snapshot storage
- `mr-wplace-me`: User data from intercepted API
- `wplace-studio-pixel-click`: Pixel color detection (auto-spoit)

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
├── inject/                 # Page-context scripts
│   ├── index.ts           # Initialization & coordination
│   ├── fetch-interceptor.ts  # Intercepts tile & user API calls
│   ├── map-instance.ts    # Captures WPlace map instance
│   ├── message-handler.ts # Handles postMessage events
│   └── theme-manager.ts   # Applies theme to map
├── core/
│   └── di.ts              # DI container & API types
├── features/              # Feature modules (gallery, drawing, etc.)
├── utils/                 # Shared utilities
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
- `utils/image-bitmap-compat.ts`: Firefox-compatible bitmap conversion
