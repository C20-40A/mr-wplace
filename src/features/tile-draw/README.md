# Template System - Refactored Architecture

## 流れ

1. inject.js から window.postMessage で タイルの blob と座標が飛んでくる(source:"wplace-studio-tile")
2. content.js で作られた src/features/tile-overlay/index.ts が描画の仲介役を担う
3.

## Core Architecture

```
TemplateManager(統合管理) → getEnhancedConfig(設定管理) + CanvasPool(リソース管理) → template-functions(ピクセル処理)
```

## File Structure

```
src/features/template/
├── index.ts                      # export { TemplateManager }
├── constants.ts                  # 定数・型定義 (TEMPLATE_CONSTANTS, TemplateCoords)
├── templateManager.ts            # 統合管理クラス (管理・描画責任)
├── template-functions.ts         # ピクセル処理関数群
├── canvas-pool.ts               # Canvas再利用システム
└── README.md                    # このファイル
```

## API - 外部利用

```typescript
import { TemplateManager } from "./templateManager";

const manager = new TemplateManager();
await manager.createTemplate(file, coords, imageKey);
const result = await manager.drawTemplateOnTile(tileBlob, tileCoords);
manager.toggleDrawEnabled(imageKey);
```

## Technical Implementation

### Canvas Pool System

```typescript
// canvas-pool.ts - リソース管理
CanvasPool.acquire(w, h): OffscreenCanvas  // プールから取得 or 新規作成
CanvasPool.release(canvas): void           // プールに返却 (最大5個保持)

// 効果: 1回描画4+N個Canvas生成 → 再利用でメモリ効率化
```

### Pixel Processing Functions

```typescript
// template-functions.ts - 責任分離済み
processBasicPixels(); // #deface変換 + 中央ピクセル抽出
processEnhancedPixels(); // 選択色周り赤ドット追加
processPixels(); // 上記2つ統合

createTemplateTiles(); // メイン処理: 分析→タイル分割→処理
```

## Error Handling Pattern

- No try-catch: throw 統一、上層 catch 前提
- Canvas 取得失敗: throw Error
- リソースクリーンアップ: CanvasPool.release 必須

## Performance Optimizations

- Canvas Pool: 4+N 個 → 再利用でメモリ効率化
- willReadFrequently: getImageData 警告解決
- 3x3 pixel scale: 中央ピクセル抽出 (固定値)
- ImageBitmap: GPU 最適化 bitmap 処理

## Enhanced Feature Flow

```
ColorFilter UI Toggle → EnhancedConfigProvider → TemplateManager → processEnhancedPixels
                                ↓
                        selectedColors取得 → 中央ピクセル判定 → 上下左右赤ドット
```

## Integration Points

- TileOverlay: drawImageAt() → TileDrawManager.createTemplate()
- inject.js: タイル傍受 → drawTemplateOnTile()
- ColorFilter: applyColorFilter() → Enhanced 機能連携
- Gallery: TemplateInstance.drawEnabled 管理

## Known Constraints

- Enhanced 色固定: 赤[255,0,0]のみ
- 座標系固定: zoom=11、3x3 グリッド中央抽出
- ColorFilter 依存: window.mrWplace.colorFilterManager
- Single Template: 1 ファイル単位処理
