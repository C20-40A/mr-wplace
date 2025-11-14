# pixel art

- wplace という map 上に pixelart を表示/paint するサービスがある。 dev console で動くコードを作っている
- wplace は web メルカトルのズームレベル 11 固定でマップをタイル分割している。そこからオフセットをつけた計算をしている。東京駅なら、「座標 TILE_X: 1819, TILE_Y: 806, PIXEL_X: 118, PIXEL_Y: 457」のようになる。
- GeoJSON を使うこと（各ピクセルをジオメトリに変換する）
- 画像の 1px = zoom=11 の world(px) の 1 単位 に固定すること（＝画像を world(px) 座標系に展開）
- 地図上では 四角いピクセル（正方形ポリゴン） として描画し、ズームすると荒く拡大して見えること（＝ピクセルアートの見た目を保持）
- シンプルなコード構成（Canvas で読み込んで一度変換して GeoJSON を作る → GeoJSON を source にして fill レイヤで描画）

```js
// === マップインスタンス取得 ===
const mapInstance = document.querySelector("div.absolute.bottom-3.right-3.z-30")
  ?.childNodes?.[0]?.__click?.[3]?.v;
if (!mapInstance) throw new Error("mapInstance が見つかりません。");

// === 定数 ===
const TILE_SIZE = 1000;
const ZOOM = 11;
const SCALE = TILE_SIZE * Math.pow(2, ZOOM); // = 2048000

// === 既存座標系変換関数 ===
function llzToTilePixel(lat, lng) {
  const scale = TILE_SIZE * Math.pow(2, ZOOM);
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const worldX = ((lng + 180) / 360) * scale;
  const worldY =
    (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;

  const TLX = Math.floor(worldX / TILE_SIZE);
  const TLY = Math.floor(worldY / TILE_SIZE);
  const PxX = Math.floor(worldX - TLX * TILE_SIZE);
  const PxY = Math.floor(worldY - TLY * TILE_SIZE);
  return { TLX, TLY, PxX, PxY, worldX, worldY };
}

function tilePixelToLatLng(tileX, tileY, pxX = 0, pxY = 0) {
  const N = TILE_SIZE * Math.pow(2, ZOOM);
  const worldX = tileX * TILE_SIZE + pxX;
  const worldY = tileY * TILE_SIZE + pxY;
  const lng = (worldX / N) * 360 - 180;
  const lat =
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * worldY) / N))) * 180) / Math.PI;
  return { lat, lng };
}

// === 東京駅を中心に設定 ===
const centerTile = { TILE_X: 1819, TILE_Y: 806, PIXEL_X: 118, PIXEL_Y: 457 };
const centerWorldX = centerTile.TILE_X * TILE_SIZE + centerTile.PIXEL_X;
const centerWorldY = centerTile.TILE_Y * TILE_SIZE + centerTile.PIXEL_Y;

// === Base64 PNG（1px = world 1px） ===
const pixelArtBase64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAfCAYAAAAfrhY5AAAByUlEQVR4AeyV0VEDMQxEbQqgDEqhFrpg6IJaKIUyaODQ89wqimKf75LM5AOY20harbWyf3gqD/z7N3/I49/j2RfbHFg49t1qvjx/vRVgtocXuMW8GZtp+Xn9JFR+jmCvObeKcI9gHPvkrhklM3OGLMv7S4mwYfAW/Btpss4PkIzMOeQDEQr149sX4dZaCl4aonjL2yyLF1/PvGvKSQwYSp4BT7/H0zOeJSycvmzejE/t+2W9BbL5pts6wDWz2oWDJJr7rXm+iMHZTTqeJ0e8LuvPH83pN6yilvPDYYF6BGmIUZPnqdc1V1NxWZYCqPNgOCAeHYCbYZd5HiIj8bkWP4tD8/hUtdZSa/VZ6slUNYJaa1dLL2NojjAOpQbiZKwoHo3Q49QjbpojYEAEHJhx9NFtYWqum/WGXNvTrGhe8zDVijpEFKcIJ4hTTHxVHc3FtaiDej7VNJUf7XE2Ipv77RkMECtiCiI368W+nfNbW16yOVxbQCYQQENynuuoo8ccYPmZsdVdc3iEF0swGCAA61BS/x/fCvuhB0hXWDj/ejePirMlGBZhQl8w8uT0VljofzNznWpLWJGjUSVzqultYq/55pBrm3/X/BcAAP//XVoCOwAAAAZJREFUAwCtKAFOt0LgOAAAAABJRU5ErkJgggAA";

const ALPHA_THRESHOLD = 16;

// === 実行関数 ===
function addPixelArtAsGeoJSON(base64Image) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = base64Image;

  img.onload = () => {
    const w = img.width;
    const h = img.height;

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    const imgData = cx.getImageData(0, 0, w, h).data;

    const features = [];

    // 半ピクセルずれを打ち消すために、左上基準で配置
    const offsetX = centerWorldX - w / 2 - 0.5;
    const offsetY = centerWorldY - h / 2 - 0.5;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const idx = (j * w + i) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];
        if (a <= ALPHA_THRESHOLD) continue;

        const pxWorldX = offsetX + i;
        const pxWorldY = offsetY + j;

        const worldCorners = [
          [pxWorldX, pxWorldY],
          [pxWorldX + 1, pxWorldY],
          [pxWorldX + 1, pxWorldY + 1],
          [pxWorldX, pxWorldY + 1],
          [pxWorldX, pxWorldY],
        ];

        const coords = worldCorners.map(([wx, wy]) => {
          const { lat, lng } = tilePixelToLatLng(
            Math.floor(wx / TILE_SIZE),
            Math.floor(wy / TILE_SIZE),
            wx % TILE_SIZE,
            wy % TILE_SIZE
          );
          return [lng, lat];
        });

        const color = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;

        features.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: { color },
        });
      }
    }

    const geojson = { type: "FeatureCollection", features };

    const SOURCE_ID = "pixel-art-source";
    const LAYER_ID = "pixel-art-overlay-layer";

    try {
      if (mapInstance.getLayer(LAYER_ID)) mapInstance.removeLayer(LAYER_ID);
      if (mapInstance.getSource(SOURCE_ID)) mapInstance.removeSource(SOURCE_ID);
    } catch {}

    mapInstance.addSource(SOURCE_ID, { type: "geojson", data: geojson });
    mapInstance.addLayer({
      id: LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": ["get", "color"],
        "fill-opacity": 1,
        "fill-antialias": false,
      },
    });

    console.log("✅ pixel-art GeoJSON added:", features.length, "features");
  };
}

// 実行
addPixelArtAsGeoJSON(pixelArtBase64);
```
