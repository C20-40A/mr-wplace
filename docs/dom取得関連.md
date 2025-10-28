# maplibregl マップインスタンス取得方法

```javascript
const mapInstance = document.querySelector("div.absolute.bottom-3.right-3.z-30")
  .childNodes[0].__click[3].v;

document.querySelector(
  "body > div:nth-child(1) > div.disable-pinch-zoom.relative.h-full.overflow-hidden.svelte-6wmtgk > div.absolute.left-2.top-2.z-30.flex.flex-col.gap-3 > div.flex.flex-col.gap-1.max-sm\\:hidden > button:nth-child(1)"
).__click[1].v; // でもok
```

# レイヤー構造

mapInstance.getStyle().layers

ID: background, Type: background
ID: natural_earth, Type: raster
...
ID: pixel-art-layer, Type: raster
ID: "paint-preview-0.6338469378613869-1817,808" raster(塗り始めると現れる)
↑ paint: {raster-opacity : 1 raster-resampling : "nearest"}
iD: pixel-hover, Type: raster
ID: "paint-crosshair-9088,4041" raster(塗り始めると現れる)

# ピクセルアートのあるレイヤーの取得や変更

```javascript
mapInstance.getLayer("pixel-art-layer");
// こうすると非表示
mapInstance.setLayoutProperty("pixel-hover", "visibility", "none");
// source取得
mapInstance.getSource("pixel-art-layer");
// タイル入れ替え
mapInstance.getSource("pixel-art-layer").setTiles("画像URL");
```

# "pixel-art-layer"の詳細

- ID: "pixel-art-layer"
- タイプ: "raster"
- タイル URL: tiles: ["https://backend.wplace.live/files/s0/tiles/{x}/{y}.png"] バックエンド URL からラスタータイル画像を取得している
- ズームレベル: minzoom: 11, maxzoom: 11 (ズームレベル 11 でのみ表示・利用される)
- タイルサイズ: tileSize: 550
- イベント: \_eventedParent が存在し、このソースがイベントシステムに統合されている
- scheme: "xyz" y=0 のタイルがマップの左上にある

# インターセプト

```javascript
// これでリクエストをインターセプトできる
mapInstance.setTransformRequest((url) => {
  console.log(url);
  return { url };
});
```

# source 一覧

mapInstance.getStyle()の sources より

```
ne2_shaded:
  maxzoom : 6
  tileSize : 256
  tiles : ['https://maps.wplace.live/natural_earth/ne2sr/{z}/{x}/{y}.png']
  type : "raster"
openmaptiles :
  type : "vector"
  url : "https://maps.wplace.live/planet"
paint-crosshair-3015,3848:(塗っている途中に現れる)
  coordinates:[
    [-74.00390625, 40.76722964451849],
    [-73.96875000000001, 40.76722964451849],
    [-73.96875000000001, 40.74059806880479],
    [-74.00390625, 40.74059806880479]
  ]
paint-preview-0.284658944908746-603,769:(塗っている途中に現れる)
  coordinates: [
     [-74.00390625, 40.713955826286046],
     [-73.82812500000001, 40.713955826286046],
     [-73.82812500000001, 40.847060356071246],
     [-74.00390625, 40.847060356071246]
  ]
  type: "canvas"
pixel-art-layer :
  maxzoom : 11
  minzoom : 11
  tileSize : 550
  tiles : ['https://backend.wplace.live/files/s0/tiles/{x}/{y}.png']
  type : "raster"
pixel-hover :
  coordinates : [
    0: [0, 0]
    1: [0.00001, 0]
    2: [0.00001, -0.00001]
    3: [0, -0.00001]
  ]
  type : "canvas"
```

# カラーパレット取得（スポイト機能）

```javascript
const extractPalette = () => {
  return qsa('[id^="color-"]') // id="color-*"の要素を全て取得
    .filter((el) => !el.querySelector("svg"))
    .map((el) => {
      const id = parseInt(el.id.replace("color-", ""), 10);
      const m = (el.style.backgroundColor || "").match(/\d+/g);
      const rgb = m ? m.map(Number).slice(0, 3) : [0, 0, 0];
      return { id, rgb, element: el };
    });
};
```

**ポイント**: サイトの DOM 構造に依存。`backgroundColor`スタイルから正規表現で RGB 値を抽出。wplace の内部関数は**呼び出していません**。純粋に DOM スクレイピング。

# 色選択の自動化

```javascript
const selectColor = (id) => {
  const el = document.getElementById(`color-${id}`);
  if (el) {
    el.click(); // カラーパレットのボタンをクリック
    return true;
  }
};
```

# ホバーしたときの色の変化

黒(0,0,0)->(82, 82, 82)になった
白(255,255,255)->(235,235,235)になった
ピンク(236, 31, 128) ->(r: 224, g: 101, b: 159)になった
rgb: [210, 210, 210]　 →(r: 210, g: 210, b: 210, )になった

# カーソルの現在の位置情報の取得方法

```javascript
map.on("mousemove", (e) => {
  // 緯度と経度の情報が格納された LngLat オブジェクト
  const lngLat = e.lngLat;
  // 経度 (Longitude) を取得
  const lng = lngLat.lng;
  // 緯度 (Latitude) を取得
  const lat = lngLat.lat;
  console.log(
    `現在のカーソル位置: 経度 ${lng.toFixed(5)}, 緯度 ${lat.toFixed(5)}`
  );

  // あるいは、キャンバス上のピクセル座標 (X/Y) を取得
  const point = e.point;
  // console.log(`キャンバス上のピクセル位置: X ${point.x}, Y ${point.y}`);
});
```

# MapLibre GL JS 上でのオーバーレイ画像の色情報取得

ホバーするときに色が変わるから、キャンバス上の色を直接取る方法だと、違う色を取得してしまう。
↓
「Map に登録した元の画像データ」と「カーソル位置」から座標変換を行い、画像ファイルのピクセルデータを直接参照する

# クリックしたときに、その位置の色を選択する

Map インスタンスのインターセプトは、map.on('click', ...)の時点で、デフォルト処理が終わっているので、不可能？
DOM イベントのキャプチャすれば可能かもしれない

# Map インスタンスの利用方法

inject.js で instance 取得している。これは content.js には直接渡せない。window.wplaceMap に定義してみたが、無意味だった
なので、content.js で postMessage して、受け取った inject.js が処理をするのがベストかもしれない
