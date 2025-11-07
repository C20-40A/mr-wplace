# pixel art

```js
const mapInstance = document.querySelector("div.absolute.bottom-3.right-3.z-30")
  .childNodes[0].__click[3].v;

// === 定数（既存に合わせる） ===
const MOD_CHUNK = 4000;
const MOD_TILE = 1000;
const ZOOM_BASE = 9;
const SCALE = MOD_CHUNK * Math.pow(2, ZOOM_BASE); // = 2048000
const FIXED_ZOOM = 11;

// 既存関数（貼り付け済みなら不要）
function llzToWorldPixel(lat, lng) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const worldX = ((lng + 180) / 360) * SCALE;
  const worldY =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * SCALE;
  return { worldX, worldY };
}
function worldToLatLng(worldX, worldY) {
  const lng = (worldX / SCALE) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (worldY / SCALE);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

// === 中心（world単位での中心座標を指定） ===
// 例：東京駅を中心にする（必要なら center を変更）
const center = { lat: 35.6812, lng: 139.7671 };
const centerWorld = llzToWorldPixel(center.lat, center.lng);

// === 画像（Base64 PNG）をここに入れる ===
const pixelArtBase64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAfCAYAAAAfrhY5AAAByUlEQVR4AeyV0VEDMQxEbQqgDEqhFrpg6IJaKIUyaODQ89wqimKf75LM5AOY20harbWyf3gqD/z7N3/I49/j2RfbHFg49t1qvjx/vRVgtocXuMW8GZtp+Xn9JFR+jmCvObeKcI9gHPvkrhklM3OGLMv7S4mwYfAW/Btpss4PkIzMOeQDEQr149sX4dZaCl4aonjL2yyLF1/PvGvKSQwYSp4BT7/H0zOeJSycvmzejE/t+2W9BbL5pts6wDWz2oWDJJr7rXm+iMHZTTqeJ0e8LuvPH83pN6yilvPDYYF6BGmIUZPnqdc1V1NxWZYCqPNgOCAeHYCbYZd5HiIj8bkWP4tD8/hUtdZSa/VZ6slUNYJaa1dLL2NojjAOpQbiZKwoHo3Q49QjbpojYEAEHJhx9NFtYWqum/WGXNvTrGhe8zDVijpEFKcIJ4hTTHxVHc3FtaiDej7VNJUf7XE2Ipv77RkMECtiCiI368W+nfNbW16yOVxbQCYQQENynuuoo8ccYPmZsdVdc3iEF0swGCAA61BS/x/fCvuhB0hXWDj/ejePirMlGBZhQl8w8uT0VljofzNznWpLWJGjUSVzqultYq/55pBrm3/X/BcAAP//XVoCOwAAAAZJREFUAwCtKAFOt0LgOAAAAABJRU5ErkJgggAA"; // ← ここを差し替える

// === 変換パラメータ ===
const ALPHA_THRESHOLD = 16; // 0-255。透明度がこの値より大きければプロットする

// === 画像を読み込み、GeoJSON に変換して map に追加する関数 ===
function addPixelArtAsGeoJSON(base64Image, options = {}) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = base64Image;

  img.onload = () => {
    const w = img.width;
    const h = img.height;

    // canvas に描いてピクセル取得
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);

    const imgData = cx.getImageData(0, 0, w, h).data;

    const features = [];

    // 画像ピクセルを world(px) 座標系に展開するための左上原点(world)を計算
    // 画像の中心を centerWorld に合わせ、(0,0) を左上にする
    // worldX for pixel (i,j) = centerWorld.worldX + (i - w/2)
    // worldY for pixel (i,j) = centerWorld.worldY + (j - h/2)
    const offsetX = centerWorld.worldX - w / 2;
    const offsetY = centerWorld.worldY - h / 2;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const idx = (j * w + i) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];

        if (a <= ALPHA_THRESHOLD) continue; // 透明ならスキップ

        // world(px) 座標でピクセルの四角（左上ベース）
        const pxWorldX = offsetX + i; // 左上 corner x
        const pxWorldY = offsetY + j; // 左上 corner y

        // 四隅（world単位）：左上, 右上, 右下, 左下
        const worldCorners = [
          [pxWorldX, pxWorldY],
          [pxWorldX + 1, pxWorldY],
          [pxWorldX + 1, pxWorldY + 1],
          [pxWorldX, pxWorldY + 1],
          [pxWorldX, pxWorldY], // ポリゴン閉じるために最初に戻す
        ];

        // world -> latlng に変換
        const coords = worldCorners.map(([wx, wy]) => {
          const { lat, lng } = worldToLatLng(wx, wy);
          return [lng, lat];
        });

        // RGBA -> CSS hex with alpha handled as rgba() string for安全
        const color = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;

        features.push({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [coords],
          },
          properties: {
            color,
          },
        });
      }
    }

    const geojson = {
      type: "FeatureCollection",
      features,
    };

    // 既存のソース/レイヤーがあれば削除して差し替え（更新を簡単に）
    const SOURCE_ID = "pixel-art-geojson-source";
    const LAYER_ID = "pixel-art-geojson-fill";

    try {
      if (mapInstance.getLayer(LAYER_ID)) mapInstance.removeLayer(LAYER_ID);
    } catch (e) {}
    try {
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    } catch (e) {}

    // GeoJSON ソース追加
    mapInstance.addSource(SOURCE_ID, {
      type: "geojson",
      data: geojson,
    });

    // 塗りレイヤ追加：ピクセルの色を properties.color から取る
    mapInstance.addLayer({
      id: LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 1,
        // 可能ならアンチエイリアスを切る（効かない環境もある）
        "fill-antialias": false,
      },
    });

    // done
    console.log("pixel-art -> geojson added. features:", features.length);
  };

  img.onerror = (err) => {
    console.error("image load error", err);
  };
}

// 実行例（ここで base64 を渡す）
addPixelArtAsGeoJSON(pixelArtBase64);
dLayer(pixelLayer);
```

# パンプキン

```js
const BASE64_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAfCAYAAAAfrhY5AAAByUlEQVR4AeyV0VEDMQxEbQqgDEqhFrpg6IJaKIUyaODQ89wqimKf75LM5AOY20harbWyf3gqD/z7N3/I49/j2RfbHFg49t1qvjx/vRVgtocXuMW8GZtp+Xn9JFR+jmCvObeKcI9gHPvkrhklM3OGLMv7S4mwYfAW/Btpss4PkIzMOeQDEQr149sX4dZaCl4aonjL2yyLF1/PvGvKSQwYSp4BT7/H0zOeJSycvmzejE/t+2W9BbL5pts6wDWz2oWDJJr7rXm+iMHZTTqeJ0e8LuvPH83pN6yilvPDYYF6BGmIUZPnqdc1V1NxWZYCqPNgOCAeHYCbYZd5HiIj8bkWP4tD8/hUtdZSa/VZ6slUNYJaa1dLL2NojjAOpQbiZKwoHo3Q49QjbpojYEAEHJhx9NFtYWqum/WGXNvTrGhe8zDVijpEFKcIJ4hTTHxVHc3FtaiDej7VNJUf7XE2Ipv77RkMECtiCiI368W+nfNbW16yOVxbQCYQQENynuuoo8ccYPmZsdVdc3iEF0swGCAA61BS/x/fCvuhB0hXWDj/ejePirMlGBZhQl8w8uT0VljofzNznWpLWJGjUSVzqultYq/55pBrm3/X/BcAAP//XVoCOwAAAAZJREFUAwCtKAFOt0LgOAAAAABJRU5ErkJgggAA";
```

# 単純な円

```js
const mapInstance = document.querySelector("div.absolute.bottom-3.right-3.z-30")
  .childNodes[0].__click[3].v;

// ===== wplace座標変換 =====
const MOD_CHUNK = 4000;
const MOD_TILE = 1000;
const ZOOM_BASE = 9;
const SCALE = MOD_CHUNK * Math.pow(2, ZOOM_BASE); // = 2048000

function llzToWorldPixel(lat, lng) {
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const worldX = ((lng + 180) / 360) * SCALE;
  const worldY =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * SCALE;
  return { worldX, worldY };
}

function worldToLatLng(worldX, worldY) {
  const lng = (worldX / SCALE) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (worldY / SCALE);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

// ===== world(px) → GeoJSON Feature =====
// 例：タイル座標や内部ピクセル座標から点を生成
function makeWorldPointFeature(worldX, worldY, color = "#ff0000") {
  const { lat, lng } = worldToLatLng(worldX, worldY);
  return {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [lng, lat],
    },
    properties: { color },
  };
}

// ===== GeoJSON ソース作成 =====
const features = [];

// 例：wplace world座標で中心近辺をプロット
const center = { lat: 35.6812, lng: 139.7671 }; // 東京駅
const centerWorld = llzToWorldPixel(center.lat, center.lng);

for (let dx = -2000; dx <= 2000; dx += 1000) {
  for (let dy = -2000; dy <= 2000; dy += 1000) {
    features.push(
      makeWorldPointFeature(centerWorld.worldX + dx, centerWorld.worldY + dy)
    );
  }
}

const geojsonData = {
  type: "FeatureCollection",
  features,
};

// ===== マップに追加 =====
mapInstance.addSource("pixel-sync-points", {
  type: "geojson",
  data: geojsonData,
});

// ===== Circle Layerを追加（zoom補正付き）=====
mapInstance.addLayer({
  id: "pixel-sync-layer",
  type: "circle",
  source: "pixel-sync-points",
  paint: {
    // pixel-art-layerはzoom=11固定 → その倍率に合わせてradius補正
    "circle-radius": [
      "interpolate",
      ["exponential", 2],
      ["zoom"],
      0,
      0.1,
      11,
      2,
      20,
      256,
    ],
    "circle-color": ["get", "color"],
    "circle-stroke-width": 0,
    "circle-opacity": 0.9,
  },
});
```
