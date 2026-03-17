# 調査運用プロンプト

- この課題の調査結果は、以後このファイルにその都度追記すること
- 実装はまだ行わず、再現条件・観測ログ・仮説・確度を短く残すこと
- dev console で試したコマンドも、重要なものはそのまま残すこと
- 「何が分かったか」と「次に何を試すか」を毎回 1 セットで書くこと

# WPlace 公式更新: overlay 調査ログ

## 2026-03-17 初回切り分け

### 観測

- 独立 overlay と grid 表示の両方でエラーが出る
- どちらも `map.addSource(...)` を使う
- 独立 overlay 本体は raster source
- grid と paint guide は geojson source

### dev console で確認したこと

#### 1. GeoJSON source 単体追加

実行:

```js
const map = window.mrWplace.wplaceMap;

map.addSource("mrw-test-source", {
  type: "geojson",
  data: {
    type: "FeatureCollection",
    features: [],
  },
});
```

結果:

- `app.*.js` 側で `Error {message: 'er is not defined'}` が発生
- stack に `addSource` → `_updateWorkerData` → `_dispatchWorkerUpdate` が出る
- GeoJSONSource の worker 更新経路で Wplace 側 bundle が壊れている可能性が高い

#### 2. Raster source 単体追加

実行:

```js
map.addSource("mrw-test-raster", {
  type: "raster",
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  tileSize: 256,
});
```

結果:

- エラーなし

意味:

- `addSource` 全体が壊れているわけではない
- 少なくとも raster source は通る

#### 3. Image source 単体追加

実行:

```js
const map = window.mrWplace.wplaceMap;

map.addSource("mrw-test-image", {
  type: "image",
  url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  coordinates: [
    [139, 36],
    [140, 36],
    [140, 35],
    [139, 35],
  ],
});
```

結果:

- `AJAXError: unreachable (0): data:image/gif;base64,...`
- その後 `Map.refreshTiles` を経由して通常タイルの再読込も走り、背景タイル表示が崩れる

意味:

- Wplace 側 image source loader は `data:` URL を扱えない可能性が高い
- source 追加を契機に style/source の再評価や tile refresh が走る

### 現時点の仮説

- 公式更新で custom `geojson` source 周辺が壊れた、または監視処理と競合している
- 独立 overlay 本体の raster source は本質原因ではない
- grid / paint guide のような geojson source 依存機能が特に危険
- custom source 追加時の公式側 `styledata` / `refreshTiles` 系処理も不安定化している可能性がある

### 次に試すこと

- `geojson` source 追加後に `addLayer` なしでも必ず落ちるかを再確認する
- Wplace 公式 overlay を開いた状態 / 開いていない状態で差があるかを見る
- custom source 追加直後に `map.getStyle().sources` の変化を確認する
- 可能なら公式 bundle 側で `GeoJSONSource` worker update 付近の参照変数欠落を当たる

## 2026-03-17 仮説整理メモ

### GeoJSON がダメになった理由の仮説

観測事実:

- `geojson` source 追加時のみ `er is not defined` が発生
- stack は `addSource` → `_updateWorkerData` → `_dispatchWorkerUpdate`
- `raster` source 追加では同種エラーが出ない

有力仮説:

- 公式側が GeoJSON source を使う overlay / guide 系機能を追加し、その更新処理や worker 連携処理にバグが入った
- その処理が custom source 追加時にも走り、minify 後の欠落変数参照で落ちている

補足:

- 「意図的にブロックした」というより、「公式が自前 GeoJSON source 前提でコードを足し、その副作用で custom GeoJSON source が壊れた」可能性の方が高い
- もし意図的ブロックなら、通常は明示的な validation error や拒否メッセージになりやすい
- 今回は `is not defined` なので、禁止というより実装バグの匂いが強い

### image source と data: URL の意味

観測事実:

- `image` source に `data:image/...` を渡すと `AJAXError: unreachable (0)` が出る
- その後 `refreshTiles` が走り、既存タイルの再読込も巻き込まれる

解釈:

- Wplace 側の image source ローダーは `data:` URL を普通の画像 URL と同じ fetch/AJAX 経路で読もうとしている可能性がある
- その経路は `https://...` のような通常 URL を前提にしていて、`data:` scheme を扱えない

影響:

- `data:` URL を使ってその場生成した画像を image source に直接載せる方法は使えない可能性が高い
- image source を検証に使うなら、`https://...` の実 URL か `blob:` URL も別途確認が必要
- source 追加失敗時に style / tile refresh を巻き込むため、地図表示全体が不安定化することがある

## 2026-03-17 追加観測

### 1. GeoJSON source は style 登録自体は通る

実行:

```js
const map = window.mrWplace.wplaceMap;
console.log("before", Object.keys(map.getStyle().sources || {}));
try {
  map.addSource("mrw-test-geojson-2", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });
} catch (e) {
  console.error("addSource throw", e);
}
console.log("after", Object.keys(map.getStyle().sources || {}));
```

結果:

- `before` に既存 source が表示される
- `after` では `mrw-test-geojson-2` が sources 一覧に増えている
- その後に非同期で `Error {message: 'tr is not defined'}` が出る
- `addSource` 呼び出し自体は同期 throw しない

意味:

- GeoJSON source は style への登録フェーズまでは通る
- その後の worker update / source load フェーズで Wplace 側が落ちる
- 「validation で拒否」ではなく「登録後の内部更新処理バグ」の可能性がさらに高い

### 2. image source は blob: URL でも失敗する

実行:

```js
const map = window.mrWplace.wplaceMap;
const blob = new Blob(
  ['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>'],
  { type: "image/svg+xml" }
);
const url = URL.createObjectURL(blob);

map.addSource("mrw-test-image-blob", {
  type: "image",
  url,
  coordinates: [
    [139, 36],
    [140, 36],
    [140, 35],
    [139, 35],
  ],
});
```

結果:

- `AJAXError: unreachable (0): blob:https://wplace.live/...`
- stack に `getImage` / `load` / `onAdd` / `addSource` が出る
- その後、既存 tile の再読込も崩れてタイルが返らなくなる

意味:

- image source loader は `data:` だけでなく `blob:` も扱えていない可能性が高い
- つまり custom image source の URL scheme 制約がかなり強いか、loader 実装が通常の image source より特殊
- custom source 追加失敗が既存 tile fetch の不安定化につながる

### 現時点の整理

- `geojson`: style 登録までは成功、非同期 worker 更新で死亡
- `raster`: 少なくとも source 追加は成功
- `image`: `data:` と `blob:` の両方で失敗

### 暫定結論

- custom source 全般が完全禁止というより、source type ごとに壊れ方が違う
- 特に `geojson` は worker 更新経路、`image` は image load 経路が壊れている
- 独立 overlay の fallback を考えるなら、最も生存可能性があるのは raster ベースのみ

## 2026-03-17 暫定運用方針

### 何が分かったか

- 安全側に倒すなら、`geojson` source を使う機能を起動時に通さないのが最も単純
- 現状の Mr. Wplace で該当するのは以下
  - pixel grid
  - area display / area edit
  - front tile layer の paint guide 丸
- 独立 overlay 本体は `raster` source なので、ここだけは継続可能

### 実装した暫定措置

- inject 側に一時フラグを追加し、custom GeoJSON layer 系を起動時 disable
- `grid-display.ts`
- `area-display.ts`
- `front-tile-layer/index.ts` の paint guide source/layer
- UI 側では map filter の以下を `off` 固定かつ disabled にした
  - `📍 エリア表示`
  - `🔲 ピクセルグリッド`
- ただし `エリア管理` モーダル導線は残す

### 意味

- 「壊れる経路に入らない」ことを優先した暫定安定化
- source type 単位でみると、今は `geojson` を避け、`raster` のみ生かす方針

### 次に何を試すか

- 公式側の GeoJSON worker 更新バグが直るまで、この暫定停止を維持する
- 復旧時は feature ごとの復帰ではなく、まず最小 GeoJSON source 追加再検証から始める

## 2026-03-17 `.wplace` 互換の実装メモ

### 何が分かったか

- 公式 `.wplace` は画像本体を `image.dataUrl` に内包している
- そのため import では公式 IndexedDB を読む必要がない
- 配置座標は `bounds.north` / `bounds.west` を左上として `latLngToTilePixel()` に通せば既存 gallery 座標へ変換できる
- export も既存 gallery の `dataUrl + drawPosition + width/height` から十分再構成できる

### 実装したこと

- image editor で `.wplace` import に対応
- 既存 Bluemarble JSON import は専用ファイルへ切り出し、`.wplace` 判定と共存させた
- image detail の download ボタンは format 選択ダイアログ式に変更
- download 時に `PNG` か `.wplace` を選べるようにした
- `.wplace` export では以下を出力する
  - `schemaVersion: "1"`
  - `image.dataUrl`
  - `bounds`
  - `order`
  - `visible`
  - 固定値の `opacity/colorMetric/dithering/locked/hasPlaced`

### 注意点

- `.wplace` export の `colorMetric` / `dithering` / `locked` は現行 gallery metadata に保持していないため固定値で出している
- `bounds -> drawPosition` は `north/west` 基準なので、公式実装との差で 1px 丸め差が残る可能性がある
- 今回は相互運用の最小線を優先し、完全再現はまだ狙っていない

### 次に何を試すか

- 実データで `.wplace` の import → export → 再import を往復確認する
- 座標が 1px ずれるケースがあるかだけ重点確認する
- 必要なら export 側に元の `dithering` などを持てる metadata 拡張を検討する
