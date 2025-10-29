- 重要: 最小限実装方針を維持し、1 つずつ問題解決すること
- wplace というサイトの chrome 拡張機能を作成する
- wplace は地図上に pixel を設置するサイト(pixel は online で share される)
- code は content がメイン. map instance や fetch へのアクセスは、src/inject.ts
- ProjectName: mr-wplace
- ExtensionName: Mr. Wplace
- try-catch はしない。error は基本的に throw せよ(コードの上層で catch している)
- log 利用時には console.log("🧑‍🎨 : xxxx")と 🧑‍🎨 のアイコンを表示する
- 拡張機能のため、tailwind で使える命令が限定的。btn や flex などの必ずあるであろう命令以外は、inline style で記述
- 関数は function より const & arrow function を優先
- "@/_": ["src/_"]の alias を使う(e.g. `import { di } from "@/core/di";`)
- chrome API は、`import { storage } from "@/utils/browser-api";`して利用(storage.get,storage.set,storage.remove,runtime.getURL,runtime.sendMessage,runtime.onMessage,runtime.lastError,tabs.query,tabs.sendMessage,tabs.reload が利用可能)
- storage.get(),storage.set(),storage.remove()のように使う
- i18n は`import { t } from "@/i18n/manager";`して`const text = t`${"key"}`;`で key 設定

## ファイル構成

```
src/
├── content.ts # エントリー。window.mrWplace初期化
├── inject.ts # fetch傍受、map instance取得
├── core/di.ts # DI Container (循環参照回避)
├── features/ # 機能別ディレクトリ
├── utils/ # router, modal, coordinate等
└── i18n/ # 多言語対応
```

## DI Container

```typescript
// content.ts
di.register("gallery", galleryAPI);
di.register("tileOverlay", tileOverlayAPI);

// 他feature内
const gallery = di.get("gallery");
```

## utils

- src/utils/browser-api.ts : chromeAPI storage.get(),storage.set(),storage.remove()のように使う(storage.get,storage.set,storage.remove,runtime.getURL,runtime.sendMessage,runtime.onMessage,runtime.lastError,tabs.query,tabs.sendMessage,tabs.reload が利用可能)
- src/utils/color-filter-manager.ts : 状態管理メイン
- src/utils/coordinate.ts : llzToTilePixel, tilePixelToLatLng
- src/utils/image-bitmap-compat.ts : firefox compat 用につくった bitmap 変換
- src/utils/image-storage.ts : ギャラリーが利用
- src/utils/map-control.ts : flyToPosition など inject に message post してるだけ。いらんかも
- src/utils/modal.ts : 共通 modal 作成
- src/utils/navigation-mode.ts : (flyTo/jumpTo)切り替え用の state
- src/utils/pixel-converters.ts : blobToPixels
- src/utils/position.ts : gotoPosition, getCurrentPosition
- src/utils/router.ts : routing の base
- src/utils/wplaceLocalStorage.ts : wplace が持つ location と selected-color の state
