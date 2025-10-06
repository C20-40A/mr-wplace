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
