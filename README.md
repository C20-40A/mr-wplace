# Mr. Wplace

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange.svg)

WPlace サイト専用の多機能 Chrome 拡張機能。地図タイル上への画像描画・管理機能を提供します。

## 🚀 主な機能

### ✅ 実装済み機能

- **画像描画システム**: 地図上の任意座標に画像を描画
- **全タイル対応**: fetch 傍受により任意タイル処理
- **ギャラリー管理**: 画像一覧・編集・詳細表示の 3 ルート
- **座標変換**: Web Mercator（EPSG:3857）変換
- **お気に入り機能**: 位置・画像の管理
- **多言語対応**: 日本語・英語切替（i18n）
- **Toast 通知**: 統一された通知システム

### 📋 構想中機能

- お気に入りモーダル整理機能
- タイルスナップショット保存・変更検知

## 🏗️ アーキテクチャ

```
fetchハイジャック → TileOverlay → TemplateManager → 画像描画
     ↓
UI Button → Gallery → 座標指定 → Template作成 → 全タイル処理
```

**コアパターン**: 全タイル傍受 + Template 描画（Blue Marble 移植版）

## 📁 ファイル構成

```
src/
├── content.ts              # main entry: WPlaceStudio class
├── features/
│   ├── tile-overlay/       # TileOverlay (TemplateManager wrapper)
│   ├── favorite/           # お気に入り機能
│   ├── gallery/            # ギャラリー3ルートシステム
│   ├── template/        # Template + TemplateManager
│   └── fetch-interceptor/  # fetch傍受機能
├── components/
│   ├── button-observer.ts  # 統一ボタン管理
│   └── toast.ts           # 通知システム
├── i18n/                  # 多言語対応
└── utils/coordinate.ts    # 座標変換

inject.js                  # 全タイル fetch傍受スクリプト
```

## 🔧 技術仕様

### 座標変換

- **投影法**: Web Mercator（EPSG:3857）
- **ズームレベル**: 11 固定
- **タイルサイズ**: 1000×1000px

### Fetch 傍受

```javascript
// 正規表現: tiles\/(\d+)\/(\d+)\.png
// 全タイル処理 → TemplateManager → 描画済みblob返却
```

### 必要な権限

- `storage`: 設定・データ保存
- `activeTab`: サイトアクセス
- `scripting`: スクリプト注入
- `host_permissions`: `*://wplace.jp/*`

## 📦 インストール

### 開発版

1. リポジトリクローン
2. `bun install` (依存関係インストール)
3. `bun run build` (ビルド)
4. Chrome Extensions → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」
5. `dist` フォルダを選択

## 🎯 使用方法

1. **WPlace サイト**を開く
2. 拡張機能ボタンから**Gallery**を選択
3. 画像をアップロード・選択
4. 地図上の描画位置をクリック
5. 自動的に複数タイルに画像描画

## 🔍 開発状況

**機能完成度**: 画像選択 → 座標指定 → 複数タイル描画 完全実装  
**技術的実現**: inject.js 全タイル傍受により任意座標・任意サイズ画像の完全描画  
**核心技術**: Web Mercator 座標変換 + TemplateManager 描画

### 制約

- Single Template: 1 つのテンプレート同時処理
- Chrome Extension 専用
- Blue Marble 依存（内部実装詳細抽象化不足）

## 🤝 開発方針

- **最小限実装**: 1 つずつ問題解決
- **モジュラー設計**: feature 分離
- **統一管理**: ButtonObserver/Toast/i18n 共通化

## 📄 ライセンス

Mozilla Public License 2.0

## 🔗 関連リンク

- [WPlace 公式サイト](https://wplace.jp/)
- [Chrome 拡張機能開発ガイド](https://developer.chrome.com/docs/extensions/)
