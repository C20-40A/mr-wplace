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
- TileProcessingCallback型
- WplaceMap インターフェース
- Window拡張定義

### fetch-interceptor.ts
- window.fetchの上書き
- タイル取得傍受（tiles/{x}/{y}.png）
- /meエンドポイント傍受（ユーザーデータ）
- postMessageでcontent scriptへ通知

### map-instance.ts
- MutationObserverでマップインスタンス取得
- mousedown/mousemoveイベント設定
- ピクセルクリック検出（auto spoit機能）

### theme-manager.ts
- applyTheme() マップスタイル変更
- ライト/ダークテーマ適用

### message-handler.ts
- mr-wplace-processed: 処理済みblob受信
- wplace-studio-flyto: 地図移動リクエスト
- mr-wplace-theme-update: テーマ変更通知

## Message Flow
```
inject.js → postMessage → content.ts → postMessage → inject.js
```

### Outgoing Messages (inject → content)
- `wplace-studio-tile`: タイル処理リクエスト
- `wplace-studio-snapshot-tmp`: スナップショット保存
- `wplace-studio-pixel-click`: ピクセルクリック座標
- `mr-wplace-me`: ユーザーデータ

### Incoming Messages (content → inject)
- `mr-wplace-processed`: 処理済みタイルblob
- `wplace-studio-flyto`: 地図移動
- `mr-wplace-theme-update`: テーマ更新

## Technical Constraints
- ページコンテキスト実行（DOM・window直接アクセス可）
- content scriptとはpostMessage経由通信のみ
- fetchハイジャック: Promise返却で非同期処理
- マップインスタンス: DOM要素.__click[3].v から取得

## Initialization Flow
```typescript
1. DOM属性からテーマ読み込み
2. setupFetchInterceptor() fetch上書き
3. setupMessageHandler() イベントリスナー設定
4. setupMapObserver() マップ監視開始
5. isInitialized = true
```
