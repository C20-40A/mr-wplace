# WPlace Studio

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)
![Manifest](https://img.shields.io/badge/Manifest-V3-orange.svg)

WPlaceサイト専用の多機能Chrome拡張機能です。クリエイターの作品保護と作業効率向上をサポートします。

## 🚀 主な機能

### 🛡️ 保護機能
- **画像保護**: 作品の右クリック保存やドラッグを防止
- **右クリック防止**: サイト全体の右クリックメニューを無効化
- **透かし追加** (開発予定): 自動的に透かしを追加
- **スクリーンショット検知** (開発予定): 不正な画面キャプチャを検知

### 🎨 機能拡張
- **UI改善**: より使いやすいインターフェース
- **自動化ツール**: 繰り返し作業の自動化
- **カスタムテーマ** (開発予定): お好みの見た目にカスタマイズ
- **ショートカットキー** (開発予定): 素早い操作を実現

## 📦 インストール方法

### 開発版をインストール

1. このリポジトリをクローンまたはダウンロード
2. Chromeで `chrome://extensions/` を開く
3. 右上の「デベロッパーモード」を有効にする
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. `wplace-studio` フォルダを選択

### Chrome Web Store (今後リリース予定)
近日中にChrome Web Storeでの公開を予定しています。

## 🛠️ 使用方法

1. WPlaceサイトにアクセス
2. ブラウザのツールバーにある「🎨 WPlace Studio」アイコンをクリック
3. 必要な機能をオン/オフで切り替え
4. 設定は自動的に保存されます

## 📁 ファイル構成

```
wplace-studio/
├── manifest.json          # 拡張機能の設定ファイル
├── popup.html             # ポップアップUI
├── popup.js               # ポップアップの制御スクリプト
├── content.js             # WPlaceサイトに注入されるスクリプト
├── background.js          # バックグラウンド処理
├── styles/
│   ├── popup.css          # ポップアップのスタイル
│   └── content.css        # コンテンツページのスタイル
└── icons/                 # アイコンファイル (別途追加必要)
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## 🔧 技術仕様

- **Manifest Version**: 3 (最新仕様)
- **対象サイト**: `*.wplace.jp/*`
- **必要な権限**: 
  - `storage`: 設定の保存
  - `activeTab`: アクティブタブへのアクセス
  - `scripting`: スクリプト注入

## 🎯 今後の開発予定

### v1.1.0
- [ ] アイコン作成・追加
- [ ] 透かし機能の実装
- [ ] カスタムテーマ機能

### v1.2.0
- [ ] ショートカットキー対応
- [ ] スクリーンショット検知機能
- [ ] 詳細な設定画面

### v2.0.0
- [ ] 統計・分析機能
- [ ] エクスポート機能
- [ ] 多言語対応

## 🐛 既知の問題

現在報告されている問題はありません。

## 🤝 コントリビューション

バグ報告や機能提案は Issues でお知らせください。
プルリクエストも歓迎します。

## 📄 ライセンス

MIT License - 自由に使用、改変、配布していただけます。

## 🔗 関連リンク

- [WPlace公式サイト](https://wplace.jp/)
- [Chrome拡張機能開発ガイド](https://developer.chrome.com/docs/extensions/)

## 📝 更新履歴

### v1.0.0 (2025-08-26)
- 初回リリース
- 基本的な保護機能を実装
- UI改善機能を追加
- Manifest V3に対応

---

**WPlace Studio** - クリエイターのための、クリエイターによる拡張機能 🎨