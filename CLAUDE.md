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
  components/   # shared UI parts (e.g. loading-indicator)
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

### ts-morph Context Compression (for AI)

Use `ts-morph` scripts to avoid sending large source trees directly to AI.

- Build full structure index:
  - `bun run analyze:ts`
- Update index incrementally from git diff:
  - `bun run analyze:ts:changed`
- Build token-budgeted AI context markdown:
  - `bun run context:ts --task friends-book CSV import bug --budget 3200 --max-files 18`

Outputs:

- `.cache/ts-morph-index.json`: machine index (`imports/exports/declarations/dependsOn/usedBy`)
- `.cache/llm-context.md`: compressed context for LLM input

Recommended flow:

1. `bun run analyze:ts` once initially.
2. `bun run analyze:ts:changed` while developing.
3. `bun run context:ts --task <your task> --budget <token budget>` before asking AI.

Notes:

- `--budget` is approximate (char-based estimation), not exact model tokens.
- If file selection is weak, add clearer keywords in `--task` (feature name, file/module names).
- If the index is missing or stale, regenerate with `bun run analyze:ts`.

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
- モバイルモードになった時 overflow-y: auto　これを消す(mobileだとこれがあるとdragできなくなる)
- 実装後、コードをチェックし、パフォーマンスやバグになりそうな注意点を確認・報告する
- 実装後、候補になる commit message を1つ表示する
- 実装後、リファクタの余地をcode内で見つけた部分があれば、報告する
- コーディング前の方針を決める際は、自然言語で抽象的に設計する
- できるだけ自身のtokenを節約しつつ進める
- contextを消費しないように、コマンドなどを駆使する
- ファイル種別での分割ではなく、機能単位で分割する

- 検索はrgを利用
- ts-morph利用可能

# 注意点

- inject,content のそれぞれの機能は限定的
- inject: window の context が直で使える
- inject: chrome.storage が使えないので、多くの storage 設定は content で管理
- inject: indexedDb をメインで利用。特に重い画像データは chrome.storage では避ける
- content: window の context が使えないので、messaging で inject に委任
- content: indexedDb も使えるが、面倒なので、inject に委任することが多い
- content: メイン機能はすべてここに入れているが、描画などの処理は inject で担当させている
- content: browserAPI が使えるが、crossplatform のために、src/utils/browser-api.ts を利用する必要がある
- UI: uiは固定色は非推奨(docs/theme.mdを確認し、themeにあった色を利用)

# contexts

.prompts/context/responsive-breakpoints.md : responsiveUIを作成するときREAD

@.prompts/context/utils-components-api.md

- utils/components.これらを編集追加したら、`bun run context:api`を実行して更新すること
