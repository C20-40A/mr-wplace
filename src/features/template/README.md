# Template System - Refactored Architecture

## Core Architecture

```
TemplateManager → getEnhancedConfig + CanvasPool + Template → template-functions
     ↓                   ↓                    ↓            ↓              ↓
   統合管理            設定管理           リソース管理    状態保持      ピクセル処理
```

## File Structure

```
src/features/template/
├── index.ts                      # export { TemplateManager }
├── constants.ts                  # 定数・型定義 (TEMPLATE_CONSTANTS, TemplateCoords)
├── Template.ts                   # 状態保持クラス
├── templateManager.ts            # 統合管理クラス (管理・描画責任)
├── template-functions.ts         # ピクセル処理関数群
├── utils.ts                      # createAllowedColorsSet
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

### Constants & Types

```typescript
// constants.ts
TEMPLATE_CONSTANTS = { PIXEL_SCALE: 3, RENDER_SCALE: 3, TILE_SIZE: 1000 };
type TemplateCoords = [tileX, tileY, pixelX, pixelY];
type TileCoords = [tileX, tileY];
```

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

- TileOverlay: drawImageAt() → TemplateManager.createTemplate()
- inject.js: タイル傍受 → drawTemplateOnTile()
- ColorFilter: applyColorFilter() → Enhanced 機能連携
- Gallery: TemplateInstance.drawEnabled 管理

## Development Status

- 型安全化完了 (TemplateCoords)
- 関数分割完了 (processPixels→3 関数)
- Canvas 最適化完了 (Pool + willReadFrequently)
- SRP 改善完了 (設定管理分離)
- エラーハンドリング統一完了

## Known Constraints

- Enhanced 色固定: 赤[255,0,0]のみ
- 座標系固定: zoom=11、3x3 グリッド中央抽出
- ColorFilter 依存: window.mrWplace.colorFilterManager
- Single Template: 1 ファイル単位処理

## Future Extension Points

- Enhanced 色動的変更
- Multi-template 同時最適化
- TemplateRenderer 完全分離 (描画責任)
- 関数型リファクタリング
