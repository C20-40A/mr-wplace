# Mr. Wplace

![Version](https://img.shields.io/badge/version-1.4.2-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange.svg)
![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)

WPlace サイト専用の多機能 Chrome 拡張機能。地図タイル上への画像描画・管理機能を提供します。

## 🚀 主な機能

### ✅ 実装済み機能

- **🎨 画像描画システム**: 地図上の任意座標に画像を描画・ON/OFF 切替
- **🗺️ 全タイル対応**: fetch 傍受により任意タイル処理（正規表現: `tiles\/(\d+)\/(\d+)\.png`）
- **📷 ギャラリー管理**: 画像一覧・編集・詳細表示の 3 ルートシステム
- **🧭 座標変換**: Web Mercator（EPSG:3857）投影・zoom=11 固定
- **⭐ ブックマーク機能**: 位置・画像の管理・インポート/エクスポート
- **⏰ Time Travel 機能**: タイルスナップショット保存・変更検知・履歴管理
- **🌐 多言語対応**: 日本語・英語切替（i18n タグ付きテンプレートリテラル）
- **🔔 Toast 通知**: DaisyUI ベース統一通知システム
- **🔗 Router 統一化**: Router<T> + HeaderManager 内蔵システム
- **📋 Modal 統一化**: createModal() 共通化

## 🏗️ アーキテクチャ

```
fetchハイジャック(inject.js) → TileOverlay → TileDrawManager → 画像描画
        ↓
UI Button → Gallery → 座標指定 → Template作成 → 全タイル処理
        ↓
Router<T> + HeaderManager → i18nキーマッピング → 自動ヘッダー更新
```

**コアパターン**: 全タイル傍受 + TemplateInstance 管理 + Router 統一化

## 📁 ファイル構成

```
src/
├── content.ts                    # main entry: mrWplace class
├── features/
│   ├── tile-overlay/             # TileOverlay (TileDrawManager wrapper)
│   ├── gallery/                  # ギャラリー3ルートシステム
│   │   ├── router.ts             # GalleryRouter拡張
│   │   ├── routes/
│   │   │   ├── list/             # 画像一覧+選択モード
│   │   │   ├── image-editor/     # アップロード・リサイズ・色変更
│   │   │   ├── image-detail/     # 画像表示
│   │   │   └── image-selector/   # 画像選択モーダル
│   │   └── storage.ts            # Gallery専用ストレージ
│   ├── template/                 # Template + TileDrawManager + functions
│   ├── bookmark/                 # ブックマーク管理・インポート/エクスポート
│   ├── time-travel/              # タイムトラベル機能
│   │   ├── router.ts             # TimeTravelRouter拡張
│   │   ├── routes/               # current-position/tile-list/tile-snapshots
│   │   └── utils/tile-snapshot.ts # スナップショット管理
│   ├── drawing/                  # 描画機能
│   ├── drawing-loader/           # 描画ローダー
│   └── fetch-interceptor/        # fetch傍受機能
├── components/
│   ├── button-observer.ts        # 統一ボタン管理（4ボタン対応）
│   ├── toast.ts                  # DaisyUI Toast通知システム
│   └── image-inspector.ts        # 画像検査コンポーネント
├── utils/
│   ├── router.ts                 # Router<T> + HeaderManager基盤クラス
│   ├── modal.ts                  # createModal()統一化
│   ├── coordinate.ts             # Web Mercator座標変換
│   ├── image-storage.ts          # Chrome Storage抽象化（index最適化）
│   ├── position.ts               # localStorage位置管理
│   └── wplaceLocalStorage.ts     # WPlace専用ストレージ
├── i18n/                         # 多言語対応
│   ├── index.ts                  # コア機能(t関数、Storage連携)
│   ├── translations.ts           # 日英翻訳辞書
│   └── manager.ts                # 管理クラス(初期化・切替)
└── constants/colors.ts           # 色定数

inject.js                         # 全タイル fetch傍受スクリプト
```

## 🔧 技術仕様

### 座標変換システム

- **投影法**: Web Mercator 投影（EPSG:3857）
- **ズームレベル**: 11 固定（tileSize: 1000px）
- **計算式**: `scale = 1000 * 2^11 = 2,048,000`
- **変換フロー**: `緯度経度 → ワールドピクセル → タイル番号(TLX,TLY) + タイル内ピクセル(PxX,PxY)`

### TemplateInstance 管理

```typescript
interface TemplateInstance {
  template: Template;
  imageKey: string;
  drawEnabled: boolean; // 描画ON/OFF制御
}
```

### Fetch 傍受仕様

```javascript
// inject.js: 正規表現 tiles\/(\d+)\/(\d+)\.png
const tileX = parseInt(tileMatch[1]);
const tileY = parseInt(tileMatch[2]);
// 全タイル処理 → TileOverlay → TileDrawManager → 描画済みblob返却
```

### i18n システム

- **パターン**: タグ付きテンプレートリテラル `t`${'key'}`
- **Chrome Storage 連携**: popup 変更 →content script 通知 → 自動保存復元
- **制約**: 語幹変化・複数形・コンテキスト未対応（別キー必要）

### Router 統一化

- **基盤**: `Router<T extends string>` + HeaderManager 内蔵
- **機能**: i18n キーマッピング → 自動ヘッダー更新
- **拡張**: TimeTravelRouter/GalleryRouter

## 📦 セットアップ

### 開発環境

1. `git clone https://github.com/username/wplace-studio.git`
2. `bun install`
3. `bun run build` (src/content.ts → dist/content.js 生成)
4. Chrome Extensions → デベロッパーモード → 「パッケージ化されていない拡張機能を読み込む」
5. プロジェクトルートフォルダを選択

### 配布用パッケージ作成

1. `bun run build:release` で配布パッケージ作成
2. `mr-wplace-v1.0.0.zip` が生成される
3. zip ファイルを Chrome Web Store にアップロードまたは開発者向け配布

### 必要な権限

- `storage`: 設定・データ保存
- `activeTab`: サイトアクセス

## 🎯 使用方法

### 基本フロー

1. **WPlace サイト**を開く
2. 拡張機能ボタンから機能選択
3. **Gallery**: 画像アップロード・編集・選択
4. **Drawing**: 地図上の描画位置クリック
5. 自動的に複数タイルに画像描画・ON/OFF 切替可能

### 主要機能

- **Gallery**: 3 ルート（list/image-editor/image-detail）
- **Bookmark**: 位置管理・インポート/エクスポート
- **Time Travel**: タイルスナップショット・変更検知
- **多言語**: popup 経由でリアルタイム切替

## 🔍 実装状況

### ✅ 完全実装

- 全タイル対応描画（任意座標・任意サイズ）
- TemplateInstance 管理（描画 ON/OFF）
- Router 統一化（i18n + HeaderManager）
- Modal 統一化（createModal()）
- Chrome Storage 最適化（インデックス分離）

### 🎯 技術的実現

- **コア**: Web Mercator 座標変換 + inject.js 全タイル傍受
- **描画**: TileDrawManager（Blue Marble 移植）+ TemplateInstance 抽象化
- **UI**: Router<T>基盤クラス + ButtonObserver 統一管理
- **ストレージ**: ImageStorage 抽象化 + インデックス最適化

### 制約・技術負債

- **Single Template**: 1 つのテンプレート同時処理のみ
- **Blue Marble 依存**: TileDrawManager 内部実装詳細抽象化不足
- **Chrome Extension 専用**: manifest.json + chrome.storage 依存

## 🤝 開発方針

- **モジュラー設計**: feature 分離・責任明確化
- **統一管理**: Router/Modal/Toast/ButtonObserver 共通化
- **型安全**: TypeScript + Generic 制約
- **早期リターン**: エラーハンドリング上層集約

## 📄 ライセンス

Mozilla Public License 2.0

## 🔗 関連リンク

- [WPlace 公式サイト](https://wplace.jp/)
- [Chrome 拡張機能開発ガイド](https://developer.chrome.com/docs/extensions/)
- [Web Mercator 投影](https://epsg.io/3857)
- [DaisyUI](https://daisyui.com/)
