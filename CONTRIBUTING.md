# Contributing to Mr. Wplace

Thank you for your interest in contributing to Mr. Wplace! This document provides guidelines for setting up your development environment and contributing to the project.

## Prerequisites

- [Bun](https://bun.sh/) (JavaScript runtime & package manager)
- Git
- Chrome, Edge, or Firefox browser

## Development Setup

### 1. Clone the Repository

```bash
git clone git@github.com:C20-40A/mr-wplace.git
cd mr-wplace
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Build the Extension

```bash
bun run build
```

This compiles `src/content.ts` → `dist/content.js`

### 4. Load Extension in Browser

#### Chrome/Edge

- Open `chrome://extensions/` (or `edge://extensions/`)
- Enable "Developer mode" (toggle in top right)
- Click "Load unpacked"
- Select the project root folder

#### Firefox

- Open `about:debugging#/runtime/this-firefox`
- Click "Load Temporary Add-on"
- Select `manifest.json` from the project root

### 5. Start Development Mode

```bash
bun run dev
```

This watches for file changes and auto-rebuilds the extension.

## Available Commands

| Command                 | Description                                  |
| ----------------------- | -------------------------------------------- |
| `bun run build`         | Build extension for development              |
| `bun run dev`           | Build + watch mode (auto-rebuild on changes) |
| `bun run build:release` | Create production-ready zip package          |
| `bun run bump:patch`    | Bump patch version (x.x.X)                   |
| `bun run bump:minor`    | Bump minor version (x.X.0)                   |
| `bun run bump:major`    | Bump major version (X.0.0)                   |

## Coding Guidelines

### Code Style

- Keep implementation minimal and focused on one problem at a time
- Prefer early return and `const` arrow functions
- Use simple, straightforward code; avoid boilerplate and repetition
- Use `@/` path aliases for imports
- Never import `chrome` directly; use `@/utils/browser-api` instead

### Logging

Use a simple unified format:

```ts
console.log("🧑‍🎨 : sample log");
```

### Chrome APIs

Always use the browser API wrapper:

```ts
import { storage, runtime, tabs } from "@/utils/browser-api";
```

**Note**: `storage.get(null)` is not supported. Use `storage.getKeys()` to discover keys, then fetch only needed keys.

### Internationalization (i18n)

- **Do not** edit locale files (`src/i18n/locales/*.ts`) directly
- Use the i18n script for all translation operations:

```bash
# Add a new translation key
bun scripts/i18n.ts add

# Update an existing translation
bun scripts/i18n.ts update

# Remove a translation key
bun scripts/i18n.ts remove

# Search for translation keys
bun scripts/i18n.ts search

# List all translation keys
bun scripts/i18n.ts list

# Check for missing translations
bun scripts/i18n.ts missing
```

- Reuse existing translation keys before creating new ones
- Prefer UI designs that minimize new text (reducing i18n surface area)

## Architecture Overview

### Entry Points

The extension has three main entry points compiled by esbuild:

1. **`src/content.ts`** - Content script (extension context)
   - Can use Chrome extension APIs
   - Manages storage and state synchronization

2. **`src/inject.ts`** - Page context script
   - Can access page `window`, map instance, `fetch`
   - Handles tile rendering, image processing, fetch interception

3. **`src/popup.ts`** - Extension popup UI

### Content ↔ Inject Communication

The extension operates in two isolated contexts that communicate via `window.postMessage`:

```text
popup -> content (tabs.sendMessage)
content <-> inject (window.postMessage / message listener)
```

### Dependency Injection

Location: `src/core/di.ts`

- Register feature APIs in `content.ts`
- Access cross-feature APIs via `di.get(...)`
- Types are defined in `FeatureRegistry`

### Directory Structure

```text
src/
  content.ts    # Content script entry
  popup.ts      # Popup UI entry
  inject.ts     # Inject script entry
  inject/       # Page-context logic
  core/         # DI, initializer, bridges
  features/     # Feature modules
  states/       # Content-side states
  utils/        # browser-api, inject-bridge, helpers
  i18n/         # Internationalization
```

## Version Management & Release

### Bumping Version

Before building a release, update the version number:

```bash
# Patch version (1.6.5 → 1.6.6) - for bug fixes
bun run bump:patch

# Minor version (1.6.5 → 1.7.0) - for new features
bun run bump:minor

# Major version (1.6.5 → 2.0.0) - for breaking changes
bun run bump:major
```

These commands automatically update version numbers in both `package.json` and `manifest.json`.

### Create Distribution Package

```bash
bun run build:release
```

This generates a `.zip` file (e.g., `mr-wplace-v1.6.5.zip`) ready for Chrome Web Store or Edge Add-ons submission.

## Questions or Issues?

If you have questions or encounter issues:

- Open an [issue on GitHub](https://github.com/C20-40A/mr-wplace/issues)
- Include your browser version, extension version, and steps to reproduce

## License

By contributing to Mr. Wplace, you agree that your contributions will be licensed under the [Mozilla Public License 2.0](LICENSE.txt).
