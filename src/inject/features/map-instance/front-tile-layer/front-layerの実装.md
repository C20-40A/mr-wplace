src/inject/index.ts
src/inject/features/map-instance/index.ts
src/inject/features/map-instance/front-tile-layer/
あたりが影響範囲

## 作業ログ

### 2026-02-11 (実装完了)
- ファイル構造をfront-tile-layer/フォルダに整理
  - index.ts: レイヤー/ソース管理
  - fetch-handler.ts: カスタムプロトコル処理
  - front-tile-layer.ts: 再export
- 独自ソース追加実装 (FRONT_SOURCE_ID: "mr-wplace-overlay-source")
- カスタムプロトコル実装 (mr-wplace-overlay://{z}/{x}/{y}.png)
- fetch interceptorに統合 (isFrontLayerTileRequest, handleFrontLayerTileRequest)
- drawOverlayLayersOnTile を利用して透明背景上にオーバーレイ描画
- inject/index.ts に統合済み（コメントアウト状態）

**有効化方法:**
src/inject/index.ts の line 98 をコメント解除:
```ts
setupFrontTileLayerOnMapReady(mapInstance);
```

**注意点:**
- 既存のtile-draw処理との切り替えは未実装
- この方式では背景タイルとの合成が不要
- パフォーマンス向上が期待される（fetch intercept回数削減）

# 実装概要

## アーキテクチャ

従来の方式:
```
WPlace tile fetch → intercept → 背景タイル + オーバーレイ合成 → 返却
```

新方式 (Front Layer):
```
WPlace tile fetch → そのまま返却（背景用）
Custom protocol → intercept → 透明背景 + オーバーレイ合成 → 独立レイヤーとして表示
```

## 実装詳細

### 1. レイヤー構造
MapLibreGLのレイヤー順序:
```
pixel-art-layer (背景タイル)
  ↓
pixel-hover (ホバー表示)
  ↓
pixel-art-layer-overlay (新レイヤー、オーバーレイ専用)
```

### 2. カスタムソース
- ID: `mr-wplace-overlay-source`
- Protocol: `mr-wplace-overlay://{z}/{x}/{y}.png`
- TileSize: 1000px (zoom 11のみ対応)

### 3. Fetch Intercept
- カスタムプロトコルのリクエストを検出
- 透明な1000x1000pxの背景を生成
- `drawOverlayLayersOnTile`でオーバーレイを描画
- PNG Blobとして返却

## 要件（元の計画）

- 現在は、maplibregl の tile fetch を intercept して、tile 画像に新しい画像を上書きしたものを返している
- addLayer で新しいラスターレイヤーを追加することで、fetch の intercept ではなく、より直接画像を表示することが可能になる
- tiles: ['https://backend.wplace.live/files/s0/tiles/{x}/{y}.png'] これを別の仮の fake の url にして、transform request による置き換え or fetch intercept で、画像を返せばよい

```js
map.addSource(SOURCE_ID, {
  type: "raster",
  tiles: ["fake-tile://{x}/{y}.png"], // ダミーURL
  tileSize: 550, // 元のレイヤーに合わせて設定
  minzoom: 11,
  maxzoom: 11,
});
```

このようなソースを追加するのがいいかもしれない

- もし、この tile x y に存在する画像 template(ギャラリーの画像)があれば、それを、「tile サイズに合わせた画像として」return する必要があるかもしれない
- もし、なければ、ただの透明な png でも返せばよかろう

## 今後の課題

### 切り替え機能（未実装）
- [ ] 従来方式とfront layer方式のconfig切り替え
- [ ] 設定UIの追加（developer menuなど）
- [ ] 切り替え時のレイヤー/ソース自動管理

### パフォーマンス検証
- [ ] 従来方式との描画速度比較
- [ ] メモリ使用量の測定
- [ ] キャッシュ戦略の最適化

### 機能統合
- この機能を on にした場合、既存の tile draw とは方式が変わる
- 特に、背景 tile との合成が不要になる
- しかし、ほかの機能（color filter, stats計算など）は残す and 共通にしたい
- config on/off で既存の tile の合成機能との切り替えができるとよい
