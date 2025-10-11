# WPlace Studio 色統計システム

## Architecture
```
TileDrawManager.applyAuxiliaryColorPattern() → colorStatsMap更新
     ↓
TileOverlay.updateColorStatsForTile() → GalleryStorage保存
     ↓
Gallery UI / ColorPalette → 統計表示
```

## Data Structure

### TileDrawManager
```typescript
private colorStatsMap = new Map<string, {
  matched: Map<string, number>;  // 背景と一致した色（正しく塗れた）
  total: Map<string, number>;    // 全中央ピクセル色
}>();
```

### GalleryItem
```typescript
interface GalleryItem {
  currentColorStats?: Record<string, number>;  // matched（正しく塗れた色）
  totalColorStats?: Record<string, number>;    // total（全色）
}
```

## 統計計算フロー

### 1. ピクセル処理時（補助色モードのみ）
```typescript
// applyAuxiliaryColorPattern() 内
if (isCenterPixel) {
  const colorKey = `${r},${g},${b}`;
  stats.total.set(colorKey, count + 1);  // 全中央ピクセル
  
  if (isSameColor) {  // 背景と同色
    stats.matched.set(colorKey, count + 1);  // 正しく塗れた
    data[i + 3] = 0;  // 透明化
  }
}
```

### 2. タイル描画後保存
```typescript
// TileOverlay.drawPixelOnTile()
await drawOverlayLayersOnTile(...);
await updateColorStatsForTile(tileX, tileY);

// 該当タイル上の全Gallery画像の統計保存
for (const image of targetImages) {
  const stats = tileDrawManager.getColorStats(image.key);
  await galleryStorage.save({
    ...image,
    currentColorStats: stats.matched,
    totalColorStats: stats.total
  });
}
```

### 3. 統計集計（複数画像合算）
```typescript
// TileDrawManager.getAggregatedColorStats()
const aggregated: Record<string, {matched: number, total: number}> = {};

for (const imageKey of imageKeys) {
  const stats = colorStatsMap.get(imageKey);
  // 色キーごとに matched/total 合算
  aggregated[colorKey].matched += count;
  aggregated[colorKey].total += count;
}
```

## UI統合

### Gallery進捗表示
```typescript
// ImageGridComponent
const matched = Object.values(currentColorStats).reduce((sum, count) => sum + count, 0);
const total = Object.values(totalColorStats).reduce((sum, count) => sum + count, 0);
const percentage = (matched / total) * 100;

// 横バー（青グラデ）+ %表示
```

### ColorPalette色ごと統計
```typescript
// color-filter/routes/list/ui.ts
const currentTiles = tileOverlay.getCurrentTiles();
const targetImageKeys = allImages
  .filter(img => 
    img.drawEnabled && 
    currentTiles.has(`${img.drawPosition.TLX},${img.drawPosition.TLY}`)
  )
  .map(img => img.key);

const colorStats = tileDrawManager.getAggregatedColorStats(targetImageKeys);

// ColorPalette に渡す
new ColorPalette(container, {
  showColorStats: true,
  colorStats  // Record<"r,g,b", {matched, total}>
});
```

### ColorPalette統計UI
```typescript
// 各色に進捗バー+残りピクセル表示
const remaining = stats.total - stats.matched;
const percentage = (stats.matched / stats.total) * 100;

// 横バー（青グラデ）+ "残り XX px"
```

## 制約・仕様

### 統計生成条件
- **補助色モードのみ**: red-cross/cyan-cross/dark-cross/complement-cross/red-border
- dot/cross/fill モード: 統計生成されない（背景比較ロジックなし）

### 統計対象
- **中央ピクセルのみ**: `x % 3 === 1 && y % 3 === 1`
- 十字腕・四隅: カウント対象外

### 統計更新タイミング
- **タイル描画のたび**: 背景変化で自動更新
- 複数タイルまたぐ画像: 各タイルで統計生成→自動合算

### ColorKey形式
```typescript
const colorKey = `${r},${g},${b}`;  // 例: "255,0,0"
```

### 表示対象（ColorPalette）
- **表示中タイル範囲内の画像のみ**: `TileOverlay.currentTiles` に含まれる
- 複数画像: 色ごとに統計合算
- データソース: TileDrawManager.colorStatsMap（メモリ内、リアルタイム）

## データフロー詳細

```
[補助色モード描画]
  → applyAuxiliaryColorPattern(imageKey)
  → colorStatsMap[imageKey] 更新
  → drawOverlayLayersOnTile()
  → updateColorStatsForTile()
  → GalleryStorage.save({currentColorStats, totalColorStats})

[Gallery表示]
  → GalleryStorage.getAll()
  → ImageGridComponent
  → 全色合計統計で進捗バー表示

[ColorPalette表示]
  → TileOverlay.getCurrentTiles()
  → 該当画像フィルタ
  → TileDrawManager.getAggregatedColorStats(imageKeys)
  → 色ごと統計で進捗バー+残りpx表示
```

## メソッド一覧

### TileDrawManager
```typescript
getColorStats(imageKey: string): {matched: Record<string, number>, total: Record<string, number>} | null
getAggregatedColorStats(imageKeys: string[]): Record<string, {matched: number, total: number}>
```

### TileOverlay
```typescript
getCurrentTiles(): Set<string>  // 表示中タイル（"x,y"形式）
private updateColorStatsForTile(tileX, tileY): Promise<void>
```

### GalleryItem/ImageItem
```typescript
interface GalleryItem {
  currentColorStats?: Record<string, number>;
  totalColorStats?: Record<string, number>;
}
```

### ColorPalette
```typescript
interface ColorPaletteOptions {
  showColorStats?: boolean;
  colorStats?: Record<string, {matched: number, total: number}>;
}
```

## 典型的使用パターン

### パターン1: Gallery統計確認
```typescript
const images = await galleryStorage.getAll();
const image = images.find(i => i.key === 'xxx');
console.log('matched:', image.currentColorStats);
console.log('total:', image.totalColorStats);
```

### パターン2: 色ごと統計取得
```typescript
const tileOverlay = window.mrWplace.tileOverlay;
const currentTiles = tileOverlay.getCurrentTiles();

const targetImageKeys = images
  .filter(img => currentTiles.has(`${img.drawPosition.TLX},${img.drawPosition.TLY}`))
  .map(img => img.key);

const colorStats = tileDrawManager.getAggregatedColorStats(targetImageKeys);
// {"255,0,0": {matched: 10, total: 50}, ...}
```

### パターン3: 統計リセット
```typescript
// colorStatsMap は private → 統計削除不可
// removePreparedOverlayImageByKey() で overlayLayers 削除時も統計は残る
// 意図的設計: 統計は累積保持
```

## パフォーマンス考慮

### 統計計算コスト
- **補助色モード時のみ発生**: ピクセル全走査+背景比較
- **最適化済み**: 中央ピクセルのみカウント（全ピクセルの1/9）
- **メモリ内保持**: colorStatsMap → Chrome Storage 非依存

### 統計保存コスト
- **タイル描画後**: chrome.storage.local.set() 1回/画像
- **非同期**: UI ブロックなし

### ColorPalette表示コスト
- **開いた時のみ**: リアルタイム更新なし
- **集計処理**: O(画像数 × 色数) → 通常 <10ms

## 制限事項

### 統計データなし条件
- dot/cross/fill モード描画
- 補助色モード以外で描画
- 統計更新前の古い画像

### 統計精度
- **中央ピクセルのみ**: 実際の描画ピクセル数より少ない
- **matched の意味**: 背景と同色で透明化された = 正しく塗れた場所
- **total の意味**: 画像内の全中央ピクセル色

### 複数タイル画像
- タイルごとに統計生成
- 自動合算: colorStatsMap[imageKey] に累積
- 分離不可: タイル別統計は取得不可

## デバッグログパターン
```typescript
console.log("🧑‍🎨 : applyAuxiliaryColorPattern imageKey:", imageKey);
console.log("🧑‍🎨 : Stats for", imageKey, "matched:", size, "total:", size);
console.log("🧑‍🎨 : getColorStats", imageKey, {matched, total});
console.log("🧑‍🎨 : updateColorStatsForTile(x,y)");
console.log("🧑‍🎨 : Saving stats for", imageKey, stats);
console.log("🧑‍🎨 : Color stats - currentTiles: N, targetImages: M");
console.log("🧑‍🎨 : Aggregated color stats:", colorStats);
```

## 関連ファイル
```
src/features/tile-draw/
  tileDrawManager.ts          # colorStatsMap, 統計計算・集計
src/features/tile-overlay/
  index.ts                    # getCurrentTiles, updateColorStatsForTile
src/features/gallery/
  storage.ts                  # GalleryItem定義
  routes/list/
    components/ImageGridComponent.ts  # 進捗バー表示
    ui.ts                     # GalleryItem→ImageItem変換
src/features/color-filter/
  routes/list/ui.ts           # 統計集計・ColorPalette統合
src/components/
  color-palette.ts            # 色ごと統計UI
```

## 技術的背景

### なぜmatched/total?
- **matched**: 正解位置（背景と画像が一致）
- **total**: 画像の全色
- **remaining = total - matched**: 未達成ピクセル数
- **percentage = matched / total**: 達成率

### なぜ補助色モードのみ?
- 背景比較ロジックが存在するのは補助色モードのみ
- dot/cross/fill: 背景無関係に描画（統計意味なし）
- パフォーマンス: 不要な比較処理回避

### なぜ中央ピクセルのみ?
- pixelScale=3: 3x3グリッドで拡大描画
- 中央ピクセル = 実際の色情報
- 十字腕・四隅 = 補助色（統計対象外が自然）

### なぜcurrentTilesフィルタ?
- ユーザーが見ている範囲の統計のみ表示
- パフォーマンス: 全画像統計集計は重い
- 意味的明確性: 表示中の進捗

## Future拡張可能性

### 統計リセット機能
```typescript
clearColorStats(imageKey?: string): void {
  if (imageKey) {
    this.colorStatsMap.delete(imageKey);
  } else {
    this.colorStatsMap.clear();
  }
}
```

### タイル別統計
```typescript
private colorStatsMap = new Map<string, Map<string, {
  matched: Map<string, number>;
  total: Map<string, number>;
}>>();
// imageKey → tileKey → stats
```

### リアルタイム統計更新
```typescript
// タイル描画のたび ColorPalette 再描画
// 重いのでデフォルト無効、オプションで有効化
```

### 統計エクスポート
```typescript
exportColorStats(imageKey: string): string {
  const stats = this.getColorStats(imageKey);
  return JSON.stringify(stats, null, 2);
}
```
