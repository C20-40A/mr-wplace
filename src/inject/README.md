# Inject Module

inject.js（ページコンテキストで実行）の機能を責任ごとに分割。

## Architecture

```
inject/
├── index.ts              # エントリーポイント・初期化フロー
├── types.ts              # 型定義
├── fetch-interceptor.ts  # fetch傍受（タイル・/me）
├── map-instance.ts       # マップインスタンス取得・イベント設定
├── theme-manager.ts      # テーマ適用処理
└── message-handler.ts    # postMessage受信処理
```

## Modules

### index.ts

- 初期化フロー制御
- 各モジュールのセットアップ
- 状態管理（isInitialized, currentTheme）

### types.ts

- Type definitions for inject context
- Window extensions (wplaceMap, mrWplaceDataSaver, etc.)
- Type-only imports from content (e.g., `GalleryItem`)

### fetch-interceptor.ts

- window.fetch の上書き
- タイル取得傍受（tiles/{x}/{y}.png）
- /me エンドポイント傍受（ユーザーデータ）
- postMessage で content script へ通知

### map-instance.ts

- MutationObserver でマップインスタンス取得
- mousedown/mousemove イベント設定
- ピクセルクリック検出（auto spoit 機能）

### theme-manager.ts

- applyTheme() マップスタイル変更
- ライト/ダークテーマ適用

### message-handler.ts

- Centralized postMessage handler
- Delegates to handlers/ modules
- Handles: gallery, snapshots, text layers, theme, state updates

## Message Flow

```
content.ts → postMessage → inject → handlers/ → state update
inject → postMessage → content.ts → Chrome storage
```

### Key Messages (content → inject)

- `mr-wplace-gallery-images`: Gallery data sync
- `mr-wplace-snapshots`: Snapshot overlays
- `mr-wplace-text-layers`: Text overlays
- `mr-wplace-theme-update`: Theme changes
- `mr-wplace-color-filter`: Color filter state
- `wplace-studio-flyto`: Map navigation

### Key Messages (inject → content)

- `mr-wplace-me`: User data from /me API
- `mr-wplace-response-stats`: Color statistics
- `mr-wplace-stats-updated`: Save stats to storage

## Technical Constraints

- Runs in page context (direct DOM/window access)
- No Chrome APIs (use postMessage to content script)
- No direct module imports from content (type-only imports OK)
- Fetch hijacking: async Promise return required

## Initialization Flow

1. Load theme from DOM attributes
2. `setupFetchInterceptor()`: override window.fetch
3. `setupMessageHandler()`: register event listeners
4. `setupMapObserver()`: start map observation
5. `window.mrWplace` initialization (inject-specific fields)
