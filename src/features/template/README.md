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
- **drawImageWithCoords**: ImageItem → File変換 → TemplateManager呼出
- **drawPixelOnTile**: inject.js傍受 → restoreImagesOnTile → drawTemplateOnTile

### TemplateManager (orchestrator)
- **createTemplate**: File+coords+imageKey → Template生成 → TemplateInstance登録
- **drawTemplateOnTile**: [tileX,tileY] → 該当TemplateInstance検索 → 合成描画
- **toggleDrawEnabled**: imageKey指定でdrawEnabled切替（TemplateInstance単位）

### Template (state holder)
- **createTemplateTiles**: Template状態(file,coords,allowedColorsSet) → 関数型処理へ委譲
- **colorPalette**: pixel分析結果保持
- **affectedTiles**: 影響タイル座標Set
- **tiles**: タイル別ImageBitmap

### template-functions.ts (pure functions)
- **createTemplateTiles**: main処理 - pixel分析 → タイル分割 → 個別処理
- **processTile**: canvas描画 → processPixels → ImageBitmap+buffer返却
- **processPixels**: 中央pixel抽出 + #deface透過 + enhanced処理

## Enhanced Feature Architecture

### Enhanced処理仕様
```typescript
// processPixels内
if (enhanced.enabled && 中央pixel && 非透明) {
  上下左右 = enhanced.color // [255,0,0]赤固定
  x   red  x
  red 中央  red
  x   red  x
}
```

### Enhanced設定フロー
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
- **pixelScale**: 3固定 - 中央pixel = x%3===1 && y%3===1
- **renderScale**: 3固定 - canvas描画時のスケール倍率
- **allowedColorsSet**: utils.createAllowedColorsSet()で生成
- **#deface特殊処理**: チェッカーボード透過(白黒交互、alpha=32)
- **座標系**: [TLX, TLY, PxX, PxY] - タイル左上基準pixel offset

## Storage Integration
- **TemplateInstance.drawEnabled**: Gallery描画ON/OFF（画像ごと）
- **Enhanced.enabled**: グローバル設定（全体適用）
- **color-filter**: ColorFilterManager管理、(window).colorFilterEnhanced保存

## Performance Considerations
- **OffscreenCanvas**: worker外でも利用可、imageSmoothingEnabled=false
- **ImageBitmap**: GPU最適化、createImageBitmap非同期
- **タイル単位処理**: 1000x1000分割 → メモリ効率化
- **インデックス削除**: clearAllTemplates()削除で他タイル状態保持

## Error Handling Pattern
- **throw Error**: 上層catch前提、try-catchなし
- **console.log**: 🧑‍🎨 prefix統一
- **フェイルセーフ**: pixel分析失敗 → 空Map返却

## Enhanced Feature Implementation Status ⚠️ 要デバッグ

**NOTE**: 以下の問題は別途デバッグ・修正が必要。リファクタリングでは未対応。

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
const isSelectedColor = !enhanced.selectedColors || enhanced.selectedColors.has(centerColorKey);
if (centerAlpha > 0 && isSelectedColor) {
  // 上下左右赤設定
}

// TileOverlay.getEnhancedConfig()
const selectedColorIds = colorFilterManager.getSelectedColors(); // [1,2,3...]
const selectedColorsRgb = new Set<string>();
for (const id of selectedColorIds) {
  const color = colorpalette.find(c => c.id === id);
  if (color) {
    selectedColorsRgb.add(`${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}`); // "0,0,0"
  }
}
return { enabled: true, selectedColors: selectedColorsRgb };
```

### 🔴 現在の問題
**症状**: enable all時のみenhance表示、1色でもdisableするとenhance消失

**期待動作**:
- 黒選択 + enhance ON → 黒中央pixel周りのみ赤enhance
- 白disable → 白中央pixel周り赤表示なし

**実際**:
- enable all → enhance表示 ✅
- 1色disable → enhance全消失 ❌

### デバッグポイント

**1. selectedColorsRgb Set確認**
```typescript
// TileOverlay.getEnhancedConfig()に追加
console.log("🧑‍🎨 : selectedColorIds:", selectedColorIds);
console.log("🧑‍🎨 : selectedColorsRgb:", Array.from(selectedColorsRgb));
```

**2. processPixels内確認**
```typescript
// 2nd pass内に追加
if (x % pixelScale === 1 && y % pixelScale === 1 && centerAlpha > 0) {
  console.log("🧑‍🎨 : centerColorKey:", centerColorKey);
  console.log("🧑‍🎨 : isSelectedColor:", isSelectedColor);
  console.log("🧑‍🎨 : selectedColors:", Array.from(enhanced.selectedColors || []));
}
```

**3. Transparent問題可能性**
- `colorpalette[0]`: Transparent [0,0,0]
- `colorpalette[1]`: Black [0,0,0]
- 同じRGB → Set重複なし
- Template.allowedColorsSet: Transparent除外済み
- しかしgetEnhancedConfig()はTransparent含む可能性

**確認**: ColorFilterManager初期状態
```typescript
// color-filter-manager.ts constructor
this.selectedColorIds = new Set(colorpalette.map(c => c.id)); // Transparent含む？
```

**4. RGB文字列フォーマット確認**
- template-functions.ts: `` `${centerR},${centerG},${centerB}` ``
- TileOverlay: `` `${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}` ``
- 一致するはず

**5. enhanced.selectedColors undefined問題**
```typescript
const isSelectedColor = !enhanced.selectedColors || enhanced.selectedColors.has(centerColorKey);
```
- `!enhanced.selectedColors` = selectedColors未定義時true（全色enhance）
- これが原因？ undefined時の挙動確認

### 修正候補

**案1**: Transparent除外
```typescript
// TileOverlay.getEnhancedConfig()
for (const id of selectedColorIds) {
  if (id === 0) continue; // Transparent除外
  const color = colorpalette.find(c => c.id === id);
  // ...
}
```

**案2**: `!enhanced.selectedColors`ロジック修正
```typescript
// processPixels
// undefined時はenhance無効にすべき？
const isSelectedColor = enhanced.selectedColors?.has(centerColorKey) ?? false;
```

**案3**: ColorFilter全選択時enhanced.selectedColors = undefined
```typescript
// TileOverlay.getEnhancedConfig()
if (selectedColorIds.length === colorpalette.length) {
  return { enabled: true }; // selectedColors未指定 = 全色
}
```

### 次AIへの指示
1. 上記デバッグポイントでconsole.log追加
2. ブラウザコンソール確認
3. selectedColorsRgb Setの中身確認
4. centerColorKey vs selectedColors不一致原因特定
5. 修正候補から選択実装

### 技術制約再確認
- enhanced色: 赤[255,0,0]固定
- selectedColors: "r,g,b"文字列Set
- 1st pass透明化 → 2nd pass enhanced
- centerAlpha > 0 必須
- ColorFilter選択色のみenhance対象

## Future Extension Points
- enhanced.color動的変更（現状赤固定）
- enhanced.pattern拡張（十字以外、斜め、周囲8方向）
- TemplateInstance.enhanced個別設定（現状グローバル）
- multi-template同時描画最適化
