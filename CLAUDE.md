# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

**Mr. Wplace** is a Chrome/Edge Manifest V3 extension for WPlace.

- Project name: `mr-wplace`
- Build tool: `esbuild + Bun`
- Main goal: drawing/gallery/map customization on collaborative pixel tiles

## Architecture

### Entry Points

esbuild bundles these 3 entry points:

1. `src/content.ts` - content script, feature initialization, storage management
2. `src/inject.ts` - page-context script entry (`src/inject/index.ts`)
3. `src/popup.ts` - extension popup UI

### Content ↔ Inject Boundary (Single Source)

The extension runs in two isolated contexts:

- **Content (`src/content.ts`)**
  - Can use extension APIs via `@/utils/browser-api`
  - Owns storage/state sync decisions
- **Inject (`src/inject/index.ts`)**
  - Can access page `window`, map instance, `fetch`
  - Owns tile rendering/image processing/fetch interception

Communication:

```text
popup -> content (tabs.sendMessage)
content <-> inject (window.postMessage / message listener)
```

### Dependency Injection

Location: `src/core/di.ts`

- Register feature APIs in `content.ts`
- Access cross-feature APIs via `di.get(...)`
- Types are defined in `FeatureRegistry`

### Directory Guide

```text
src/
  content.ts
  popup.ts
  inject.ts
  inject/       # page-context logic
  core/         # DI, initializer, bridges
  features/     # feature modules
  states/       # content-side states
  utils/        # browser-api, inject-bridge, helpers
  i18n/
```

## Coding Standards

### Core Rules

- Keep implementation minimal and focused on one problem at a time.
- Prefer early return and `const` arrow functions.
- Keep code simple; avoid boilerplate and repeated patterns.
- If implementation gets complex, consider a simpler alternative first.
- Feature-internal errors can be thrown; boundary isolation is handled by `core/initializer.ts`.
- Use `@/` path aliases.
- Avoid toast usage by default.
- If API knowledge is insufficient, report it and ask for help.

### Logging

Use a simple unified format:

```ts
console.log("🧑‍🎨 : sample log");
```

### Chrome APIs

Never import `chrome` directly. Use `@/utils/browser-api`.

```ts
import { storage, runtime, tabs } from "@/utils/browser-api";
```

- `storage.get(null)` is not supported.
- Use `storage.getKeys()` to discover keys, then fetch only needed keys.

### i18n

- Do not read locale files directly (`src/i18n/locales/*.ts`).
- Use `bun scripts/i18n.ts` for add/update/remove/search/list/missing.
- Follow `.claude/skills/i18n/SKILL.md`.
- Reuse existing translation keys before creating new keys.
- Prefer UI designs that reduce new text when possible (and therefore reduce i18n surface).

### Tutorial Additions

For tutorial item additions, follow `.claude/skills/add-tutorial/SKILL.md`.

## Critical Implementation Notes

### Tile Overlay

- Overlay rendering is handled in **inject context only**.
- Do not process overlay images in content script.
- Do not use WASM in inject context for this feature.
- Content manages persistence; inject handles rendering/compositing.
- After overlay-related data changes in content, sync to inject:
  - `sendGalleryImagesToInject()`
  - `sendSnapshotsToInject()`
  - `sendColorFilterToInject()`

For detailed inject-side architecture, see `src/inject/CLAUDE.md`.

### Request/Response Bridge

When content needs computed data from inject (stats/pixel color), use helpers in:

- `src/utils/inject-bridge.ts`

## Wplace Spec (Short)

- Shared pixel art on a world map
- `1 tile = WebMercator z11 tile = 1000x1000 PNG = 1 fetch unit`
- Wplace updates tiles by polling
- Overlay is implemented by fetch interception + compositing
- Map engine: `maplibregl`
- Theme reference: `docs/theme.md`
