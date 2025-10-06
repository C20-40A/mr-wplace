# PixelHover機能 引継ぎ

## 状況
ホバー位置の色自動取得→失敗

## 試したこと
1. WebGL `readPixels()` → `{r:0, g:0, b:0, a:0}`
2. Canvas2D `drawImage()` + `getImageData()` → `{r:0, g:0, b:0, a:0}`
3. `requestAnimationFrame`タイミング → 試行中

## 原因
MapLibre GL: `preserveDrawingBuffer: false`（デフォルト）
→描画直後にバッファクリア→content script contextから読み取り不可

## 解決策提案

### 案A: inject.js経由（確実だが複雑）
```
content.ts: mousemove → postMessage
  ↓
inject.js: page context
  ↓ canvas.getContext('webgl2') 取得可能
  ↓ gl.readPixels(x, y, 1, 1, ...)
  ↓
content.ts: postMessage受信 → selectColor()
```

実装箇所：
- `inject.js`: message listener追加 + readPixels処理
- `src/features/pixel-hover/index.ts`: postMessage送受信

### 案B: 機能変更（シンプル）
ホバー自動取得諦め→クリックで色選択

UI例：
```
[FAB] → 色一覧モーダル表示
  ↓
色クリック → document.getElementById(`color-${id}`).click()
```

既存DOM活用：`extractPalette()` + `selectColor()`

### 案C: MapLibreフック（不確実）
MapLibre描画イベント傍受
- `map.on('render')` 
- タイミング厳しい

## 推奨
**案B（機能変更）** = シンプル・確実

理由：
- 実装10行
- バグなし
- UX変わるが実用的

案Aは確実だがinject.js肥大化。

## 現在のコード
- `src/features/pixel-hover/index.ts`: Canvas2D版実装済み
- `src/content.ts`: FAB右中央配置済み
- throttle: 500ms

## 削除推奨
`src/features/pixel-hover/`全削除 → 案B実装

## テスト環境
- Chrome拡張
- wplace.jp
- MapLibre GL v2.x

## 次の実装者へ
Canvas読み取り不可=仕様。inject.js経由 or 機能変更のみ。
