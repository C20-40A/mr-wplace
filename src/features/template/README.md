# Template System Data Flow & Architecture

## Core Data Flow

```
TileOverlay.drawImageAt(lat, lng, imageItem)
  → drawImageWithCoords(coords, imageItem)
    → TemplateManager.createTemplate(file, coords, imageKey)
      → new Template(file, coords)
      → template.createTemplateTiles()
        → createTemplateTilesFn({file, coords, tileSize, allowedColorsSet})
          → processTile(..., pixelScale, enhanced)
            → processPixels(imageData, pixelScale, enhanced)
```

## Key Components

### TileOverlay (entry point)

- **drawImageAt**: 緯度経度 → タイル座標変換
- **drawImageWithCoords**: ImageItem → File 変換 → TemplateManager 呼出
- **drawPixelOnTile**: inject.js 傍受 → restoreImagesOnTile → drawTemplateOnTile

### TemplateManager (orchestrator)

- **createTemplate**: File+coords+imageKey → Template 生成 → TemplateInstance 登録
- **drawTemplateOnTile**: [tileX,tileY] → 該当 TemplateInstance 検索 → 合成描画
- **toggleDrawEnabled**: imageKey 指定で drawEnabled 切替（TemplateInstance 単位）

### Template (state holder)

- **createTemplateTiles**: Template 状態(file,coords,allowedColorsSet) → 関数型処理へ委譲
- **colorPalette**: pixel 分析結果保持
- **affectedTiles**: 影響タイル座標 Set
- **tiles**: タイル別 ImageBitmap

### template-functions.ts (pure functions)

- **createTemplateTiles**: main 処理 - pixel 分析 → タイル分割 → 個別処理
- **processTile**: canvas 描画 → processPixels → ImageBitmap+buffer 返却
- **processPixels**: 中央 pixel 抽出 + #deface 透過 + enhanced 処理

## Enhanced Feature Architecture

### Enhanced 処理仕様

```typescript
// processPixels内
if (enhanced.enabled && 中央pixel && 非透明) {
  上下左右 = enhanced.color // [255,0,0]赤固定
  x   red  x
  red 中央  red
  x   red  x
}
```

### Enhanced 設定フロー

```
ColorPalette (showEnhancedToggle: true)
  → onEnhancedChange(enabled)
    → ColorFilterManager.setEnhanced(enabled)
      → (window).colorFilterEnhanced保存
        → TileOverlay読取 → TemplateManager伝播 → processPixels適用
```

### Enhanced Parameter Propagation

```typescript
// TemplateProcessingInput
interface TemplateProcessingInput {
  enhanced?: { enabled: boolean; color: [number, number, number] };
}

// createTemplateTiles → processTile → processPixels
// デフォルト: { enabled: false, color: [255, 0, 0] }
```

## Technical Constraints

- **pixelScale**: 3 固定 - 中央 pixel = x%3===1 && y%3===1
- **renderScale**: 3 固定 - canvas 描画時のスケール倍率
- **allowedColorsSet**: utils.createAllowedColorsSet()で生成
- **#deface 特殊処理**: チェッカーボード透過(白黒交互、alpha=32)
- **座標系**: [TLX, TLY, PxX, PxY] - タイル左上基準 pixel offset

## Storage Integration

- **TemplateInstance.drawEnabled**: Gallery 描画 ON/OFF（画像ごと）
- **Enhanced.enabled**: グローバル設定（全体適用）
- **color-filter**: ColorFilterManager 管理、(window).colorFilterEnhanced 保存

## Performance Considerations

- **OffscreenCanvas**: worker 外でも利用可、imageSmoothingEnabled=false
- **ImageBitmap**: GPU 最適化、createImageBitmap 非同期
- **タイル単位処理**: 1000x1000 分割 → メモリ効率化
- **インデックス削除**: clearAllTemplates()削除で他タイル状態保持

## Error Handling Pattern

- **throw Error**: 上層 catch 前提、try-catch なし
- **console.log**: 🧑‍🎨 prefix 統一
- **フェイルセーフ**: pixel 分析失敗 → 空 Map 返却

## Enhanced Feature Implementation Status ✅ 解決済

### 実装済み処理フロー

```
ColorFilter UI Enhanced Toggle ON
  → ColorFilterManager.setEnhanced(true)
    → chrome.storage保存
      → TileOverlay.getEnhancedConfig()
        → selectedColorIds取得
        → colorpalette → RGB Set変換 ("r,g,b")
        → { enabled: true, selectedColors: Set<"r,g,b"> }
          → TemplateManager.createTemplate(enhancedConfig)
            → Template.createTemplateTiles(enhancedConfig)
              → createTemplateTilesFn({ enhanced })
                → processSingleTile(enhanced)
                  → processImageDataPixels(enhanced)
                    → 2nd pass: 選択色中央pixel判定
                      → centerColorKey = "r,g,b"
                      → isSelectedColor = selectedColors.has(centerColorKey)
                      → if (centerAlpha > 0 && isSelectedColor) { 上下左右赤[255,0,0] }
```

### 実装コード

```typescript
// processImageDataPixels (template-functions.ts)
const centerColorKey = `${centerR},${centerG},${centerB}`;
const isSelectedColor =
  !enhanced.selectedColors || enhanced.selectedColors.has(centerColorKey);
if (centerAlpha > 0 && isSelectedColor) {
  // 上下左右赤設定
}

// TileOverlay.getEnhancedConfig()
const selectedColorIds = colorFilterManager.getSelectedColors(); // [1,2,3...]
const selectedColorsRgb = new Set<string>();
for (const id of selectedColorIds) {
  const color = colorpalette.find((c) => c.id === id);
  if (color) {
    selectedColorsRgb.add(`${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}`); // "0,0,0"
  }
}
return { enabled: true, selectedColors: selectedColorsRgb };
```

### 🔴 問題・解決済

症状: enable all時enhance表示、1色disableで消失
原因: Enhanced赤[255,0,0]がcolorpaletteに含まれない→ColorFilter.isColorMatch=false→透明化

フロー:
- createTemplateTiles: selectedColors中央pixel周り赤ドット追加
- drawTemplateOnTile: ColorFilter適用→赤[255,0,0]≠colorpalette色→透明化
- enable all: isFilterActive=false→ColorFilter無効→赤保護
- 1色disable: isFilterActive=true→ColorFilter有効→赤透明化

解決: color-filter-manager.ts applyColorFilter内で赤[255,0,0]を透明化除外
```typescript
const isEnhancedRed = r === 255 && g === 0 && b === 0;
if (!isEnhancedRed && !this.isColorMatch(r, g, b)) {
  data[i + 3] = 0;
}
```

### ✅ タイル比較Enhanced実装

仕様: tile既存色≠template色の場合のみenhanced赤ドット表示（未描画部分の可視化）

実装:
```typescript
// template-functions.ts
applyTileComparisonEnhanced(templateData, tileData, selectedColors)
  → 中央pixel(x%3===1, y%3===1)比較
  → template色≠tile色 → 上下左右赤ドット追加

// templateManager.ts
getEnhancedConfig() → selectedColors取得
applyTileComparison(templateBitmap, tileContext, coords)
  → template+tile両ImageData取得
  → applyTileComparisonEnhanced実行
  → 変更済みImageBitmap返却

drawTemplateOnTile
  → 元タイル状態保存用canvas作成 ← 重要
  → ColorFilter適用
  → タイル比較Enhanced適用（元タイルcanvas参照）
  → メインcanvas描画
```

問題修正: 複数template時2つ目以降が前template描画後canvasと比較される
原因: tileContext.getImageData→canvas現在状態取得→前template含む→誤比較
解決: originalTileCanvas作成→全templateで元タイル参照→正常比較

座標計算: tileContext.getImageData(coords[2]*renderScale, coords[3]*renderScale)
動作: 未描画=赤表示、既描画=赤非表示、selectedColors選択色のみ対象

### 技術制約

- enhanced色: 赤[255,0,0]固定（colorpaletteに存在しない色）
- selectedColors: "r,g,b"文字列Set
- 1st pass透明化→2nd pass enhanced
- centerAlpha>0必須
- ColorFilter選択色のみenhance対象
- ColorFilter: colorpalette外の色は透明化→Enhanced赤は例外処理で保護

## Future Extension Points

- enhanced.color 動的変更（現状赤固定）
- enhanced.pattern 拡張（十字以外、斜め、周囲 8 方向）
- TemplateInstance.enhanced 個別設定（現状グローバル）
- multi-template 同時描画最適化
