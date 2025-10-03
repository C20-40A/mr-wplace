# Enhanced Mode Architecture - 技術仕様書

## 概要

色変更系 enhance（red-cross 等）の背景比較処理アーキテクチャ

## Enhanced Mode 8 種類

```typescript
type EnhancedMode =
  | "dot" // 1ドット（デフォルト、旧OFF相当）
  | "cross" // 同色十字
  | "red-cross" // 赤十字
  | "cyan-cross" // シアン十字
  | "dark-cross" // 暗色十字
  | "complement-cross" // 補色十字
  | "fill" // 全塗り
  | "red-border"; // 赤枠
```

## 処理分類

### グループ 1: 単純処理（背景比較不要）

- **dot**: 中央ピクセルのみ
- **cross**: 同色十字
- **fill**: 全塗り

### グループ 2: 色変更系（背景比較必要）

- **red-cross**: 赤[255,0,0]
- **cyan-cross**: シアン[0,255,255]
- **dark-cross**: 暗色（中央色-40）
- **complement-cross**: 補色（255-中央色）
- **red-border**: 赤枠

## アーキテクチャ決定

### 採用方式: 描画時背景比較（最適化版）

**理由**:

1. 実装シンプル（状態管理不要）
2. パフォーマンス許容（100x100 画像で N=100 回描画時、約 1.6ms）
3. 背景タイル fetch 不要
4. タイル/フィルター/モード変更自動対応

### 処理フロー

```
【PreparedOverlayImage作成】
addImageToOverlayLayers()
  ↓
drawImageOnTiles()
  ↓
processPixels()
  - ColorFilter適用
  - dot/cross/fill処理
  - 色変更系は「中央ピクセルのみ」保存、十字部分透明化
  ↓
PreparedOverlayImage保存（tiles: Record<string, ImageBitmap>）

【描画】
drawOverlayLayersOnTile(tileBlob, tileCoords)
  ↓
const tileBitmap = createImageBitmap(tileBlob) // 背景取得
  ↓
for (layer of overlayLayers) {
  if (色変更系enhance) {
    enhancedBitmap = applyColorEnhanceWithBackground(
      layer.bitmap,    // PreparedOverlayImage
      tileBitmap,      // 背景
      enhanceMode
    )
  }
  context.drawImage(enhancedBitmap, ...)
}
```

## パフォーマンス最適化

### 最適化ポイント

```typescript
applyColorEnhanceWithBackground() {
  // 全ピクセル走査しない
  // 3x3グリッドの中央ピクセルのみ走査
  for (let gy = 1; gy < height; gy += 3) {
    for (let gx = 1; gx < width; gx += 3) {
      const centerColor = getPixel(gx, gy);

      // 十字4ピクセルのみ処理
      const positions = [[gx,gy-1], [gx,gy+1], [gx-1,gy], [gx+1,gy]];
      for (const [x, y] of positions) {
        const bgColor = getBackgroundPixel(x, y);
        if (centerColor !== bgColor) {
          setPixel(x, y, enhanceColor); // 背景と違う→enhance適用
        }
      }
    }
  }
}
```

### ループ回数削減

- 全ピクセル: 300x300 = 90,000 回
- 最適化版: 100x100/9 x 4 ≈ 4,444 回（1/20 削減）

## 実装ファイル

### 新規作成

- `src/features/tile-draw/enhance-processor.ts`
  - `applyColorEnhanceWithBackground()`
  - `getEnhancePositions()`
  - `getEnhanceColor()`

### 変更ファイル

- `src/features/tile-draw/tile-draw.ts`
  - `processPixels()`: 色変更系 enhance 時、十字部分透明化
- `src/features/tile-draw/tileDrawManager.ts`
  - `drawOverlayLayersOnTile()`: 描画時 enhance 適用

### 既存完了

- `src/utils/color-filter-manager.ts`: EnhancedConfig["mode"]対応
- `src/components/color-palette.ts`: セレクトボックス UI
- `src/features/color-filter/routes/list/ui.ts`: callback 更新

## 技術制約

- **pixelScale 固定**: 3（変更不可）
- **3x3 グリッド前提**: enhance 処理の基盤
- **描画時処理**: 毎回ループ実行（キャッシュなし）
- **Chrome Extension**: OffscreenCanvas 使用

## 命名規則

- **PreparedOverlayImage**: 作成済み画像データ
- **ColorEnhance**: 色変更系 enhance 処理の総称
- **BackgroundComparison**: 背景比較ロジック

## パフォーマンス指標

```
画像サイズ: 100x100px
描画頻度: N回

作成時: 90,000回ループ（1回のみ）
描画時: 15,000回ループ x N回

N=10:  240,000回（0.24ms）
N=100: 1,590,000回（1.6ms）
```

**許容範囲**: 60fps = 16.6ms/frame、1.6ms < 16.6ms（OK）

## 次ステップ実装

1. `enhance-processor.ts`作成
2. `processPixels()`修正（色変更系 enhance 時、十字透明化）
3. `drawOverlayLayersOnTile()`修正（描画時 enhance 適用）
4. 動作確認（各 mode）

## 未実装部分

- NOTE.md の各 mode ロジック実装
- dark-cross/complement-cross 色計算
- red-border 処理（周囲 8 ピクセル）
