# Responsive Breakpoints Context

## Goal
Unify viewport-based UI判定 so that Wplace behavior is consistent across features.

## Shared Source of Truth
Use `src/constants/breakpoints.ts` only.

- `VIEWPORT_BREAKPOINTS.sm = 640`
- `VIEWPORT_BREAKPOINTS.md = 768`
- `VIEWPORT_BREAKPOINTS.lg = 1024`

Helpers:

- `isMobileViewport()` -> `< 640` (phone)
- `isTabletOrBelowViewport()` -> `<= 768` (phone + small tablet)
- `isDesktopViewport()` -> `>= 1024` (desktop/tablet-landscape layout split)
- `VIEWPORT_MEDIA_QUERIES.smUp` / `lgUp` for `matchMedia`

## Why This Shape
- Wplace基準のモバイル判定は `640` を維持。
- `1024` は image-editor などの2カラム/desktopレイアウト切替用として維持。
- `sm/md/lg` を共通名にしたので、将来 `xl/xs` が必要でも同じ場所に拡張できる。

## Migration Rule
- 新規実装で `window.innerWidth` の直書き禁止。
- 新規実装で `matchMedia("(min-width: ...)")` の直書き禁止。
- 判定は `@/constants/breakpoints` から import して利用。

## Updated Files (this change)
- `src/features/paint-mode-style/index.ts`
- `src/components/responsive-button.ts`
- `src/features/time-travel/routes/snapshot-detail.ts`
- `src/features/color-filter/routes/list/ui.ts`
- `src/components/color-palette/index.ts`
- `src/features/gallery/routes/image-editor/ui.ts`
- `src/features/gallery/routes/image-editor/controller.ts`
