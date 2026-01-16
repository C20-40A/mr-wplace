src/inject/index.ts
src/inject/features/map-instance/index.ts
src/inject/features/map-instance/front-tile-layer.ts
あたりが影響範囲

# 要件

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

- この機能を on にした場合、既存の tile draw とは方式が変わる。特に、背景 tile との合成が不要になる。しかし、ほかの機能は残す and 共通にしたい。
- config on/off で既存の tile の合成機能との切り替えができるとよい
