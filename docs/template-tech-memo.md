# WPlace Studio 技術メモ - 圧縮版

## 座標変換システム (coordinate.ts)

```typescript
// 緯度経度 → タイル座標変換 (zoom=11固定, tileSize=1000px)
llzToTilePixel(lat, lng): {TLX, TLY, PxX, PxY, worldX, worldY}
// Web Mercator投影、scale = 1000 * 2^11 = 2,048,000
```

## fetch ハイジャック (inject.js)

```javascript
// 全タイル傍受: tiles/(\d+)/(\d+).png正規表現
const tileX = parseInt(match[1]);
const tileY = parseInt(match[2]);
// → postMessage → TileOverlay → TileDrawManager
```

## 画像描画フロー

```
ButtonObserver → ImageSelectorModal → drawImageAt → drawImageOnTiles → 全タイル傍受
```

## 重要制約

- zoom=11 固定、3x3 グリッド中央ピクセル抽出
- #deface 色[222,250,206]→ チェッカーボード透過
- Enhanced 赤[255,0,0]固定、ColorFilter 例外処理

## 統合パターン

- coordinate.ts: getCurrentPosition() → llzToTilePixel()
- Gallery: ImageStorage<GalleryImageItem>インデックス最適化
- Router: 3route system (list/image-editor/image-detail)
